#!/usr/bin/env python3
"""
comprimir.py — reproduce en Python/PIL la compresión que hoy corre en el navegador
(ADESCRUZ-site/site/comprimir.js) para que el harness mida sobre lo que el OCR
recibe en producción, no sobre los originales del bucket (el set es anterior a
la compresión, publicada el 21-sep-2026).

    python3 scripts/ocr-harness/comprimir.py [--orig DIR] [--comp DIR] [--out comprimidos.json]

Reglas copiadas de comprimir.js:
  · solo JPG/PNG/WebP; PDF (y cualquier otra cosa) se copia tal cual
  · si pesa ≤ 300 KB y el lado largo es ≤ 2000 px, no se toca
  · si no: lado largo → 2000 px (factor k = min(1, 2000/lado), redondeo tipo
    Math.round), fondo blanco (un PNG transparente no sale negro), JPEG 0,85,
    respeta la orientación EXIF; el nombre pasa a .jpg
  · si el resultado NO pesa menos que el original, se usa el original

Diferencias con el navegador (no se pueden eliminar en Node/PIL):
  · remuestreo: canvas «imageSmoothingQuality: high» (bilineal/bicúbico según el
    motor) vs PIL LANCZOS. Mismo tamaño en px, píxeles ligeramente distintos.
  · encoder JPEG: libjpeg-turbo del navegador vs libjpeg de PIL; misma calidad
    nominal (85) y mismo submuestreo por defecto (4:2:0), bytes distintos.
"""
import argparse, json, os, shutil, sys
from PIL import Image, ImageOps

LADO_MAX = 2000
CALIDAD = 85
UMBRAL = 300 * 1024
COMPRIMIBLES = {'.jpg', '.jpeg', '.png', '.webp'}

def js_round(x):           # Math.round: .5 hacia arriba (Python round es al par)
    return int(x + 0.5)

def dir_trabajo():
    return os.environ.get('HARNESS_DIR') or os.path.join(os.environ.get('TMPDIR', '/tmp'), 'adescruz-ocr-harness')

def comprimir_uno(src, dst_dir):
    nombre = os.path.basename(src)
    raiz, ext = os.path.splitext(nombre)
    ext = ext.lower()
    tam = os.path.getsize(src)
    info = {'orig_bytes': tam, 'recodificado': False}
    if ext not in COMPRIMIBLES:
        dst = os.path.join(dst_dir, nombre)
        shutil.copyfile(src, dst)
        info.update(comp=nombre, comp_bytes=tam, motivo='no_comprimible (se copia tal cual)')
        return info
    try:
        im = Image.open(src)
        im = ImageOps.exif_transpose(im)      # createImageBitmap({imageOrientation:'from-image'})
        w, h = im.size
        info['orig_px'] = [w, h]
        lado = max(w, h)
        if tam <= UMBRAL and lado <= LADO_MAX:
            dst = os.path.join(dst_dir, nombre)
            shutil.copyfile(src, dst)
            info.update(comp=nombre, comp_bytes=tam, comp_px=[w, h], motivo='chico y de tamaño normal (no se toca)')
            return info
        k = min(1.0, LADO_MAX / lado)
        cw, ch = js_round(w * k), js_round(h * k)
        if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
            fg = im.convert('RGBA')
            if (cw, ch) != (w, h):
                fg = fg.resize((cw, ch), Image.LANCZOS)
            lienzo = Image.new('RGB', (cw, ch), (255, 255, 255))   # ctx.fillStyle = '#fff'
            lienzo.paste(fg, (0, 0), fg)
            out = lienzo
        else:
            out = im.convert('RGB')
            if (cw, ch) != (w, h):
                out = out.resize((cw, ch), Image.LANCZOS)
        dst_nombre = raiz + '.jpg'
        dst = os.path.join(dst_dir, dst_nombre)
        out.save(dst, 'JPEG', quality=CALIDAD)
        nuevo = os.path.getsize(dst)
        if nuevo >= tam:                       # blob.size >= file.size → se sube el original
            os.remove(dst)
            dst = os.path.join(dst_dir, nombre)
            shutil.copyfile(src, dst)
            info.update(comp=nombre, comp_bytes=tam, comp_px=[w, h], motivo='el JPEG no pesaba menos (se usa el original)')
            return info
        info.update(comp=dst_nombre, comp_bytes=nuevo, comp_px=[cw, ch], recodificado=True,
                    motivo='recodificado a JPEG 0,85' + (f', {lado} px → {max(cw, ch)} px' if k < 1 else ', mismo tamaño en px'))
        return info
    except Exception as e:                     # comprimir nunca puede frenar un pago: va el original
        dst = os.path.join(dst_dir, nombre)
        shutil.copyfile(src, dst)
        info.update(comp=nombre, comp_bytes=tam, motivo=f'error al comprimir, se usa el original: {type(e).__name__}: {e}')
        return info

def main():
    ap = argparse.ArgumentParser()
    base = dir_trabajo()
    ap.add_argument('--orig', default=os.path.join(base, 'orig'))
    ap.add_argument('--comp', default=os.path.join(base, 'comp'))
    ap.add_argument('--out', default=os.path.join(base, 'comprimidos.json'))
    a = ap.parse_args()
    os.makedirs(a.comp, exist_ok=True)
    archivos = sorted(f for f in os.listdir(a.orig) if not f.startswith('.'))
    if not archivos:
        sys.exit(f'No hay archivos en {a.orig}. Corré bajar.mjs primero.')
    res = {}
    tot_o = tot_c = 0
    n_rec = 0
    for f in archivos:
        info = comprimir_uno(os.path.join(a.orig, f), a.comp)
        res[f] = info
        tot_o += info['orig_bytes']; tot_c += info['comp_bytes']; n_rec += info['recodificado']
        px = f"{info.get('orig_px', ['?', '?'])[0]}x{info.get('orig_px', ['?', '?'])[1]}"
        print(f"{f[:60]:60s} {info['orig_bytes']/1024:8.0f} KB {px:>10s} → {info['comp_bytes']/1024:7.0f} KB  {info['motivo']}")
    with open(a.out, 'w') as fh:
        json.dump({'reglas': {'lado_max': LADO_MAX, 'calidad': CALIDAD, 'umbral_bytes': UMBRAL, 'remuestreo': 'PIL LANCZOS (canvas usa otro)'},
                   'archivos': res}, fh, indent=1, ensure_ascii=False)
    print(f"\n{len(archivos)} archivos, {n_rec} recodificados; {tot_o/1024/1024:.1f} MB → {tot_c/1024/1024:.1f} MB. → {a.out}")

if __name__ == '__main__':
    main()
