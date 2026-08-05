"""
cargar_cds.py — Pipeline de carga de resultados CDS
====================================================
Uso:
    python3 cargar_cds.py --cds 4 --xlsx PLANILLA_IV_CDS.xlsx
    python3 cargar_cds.py --cds 4 --pdf resultados_IV_CDS.pdf   (ZIP disfrazado)
    python3 cargar_cds.py --cds 4 --xlsx PLANILLA.xlsx --pdf resultados.pdf

El script:
1. Lee los resultados de la fuente indicada
2. Aplica la lógica de puntuación (7-5-4-3-2-1-0)
3. Imprime un JSON listo para agregar al ranking dashboard
4. También exporta un .csv por categoría para revisión

Lógica de puntuación (Reglamento Técnico Nacional Salto 2026):
    1° = 7 pts | 2° = 5 pts | 3° = 4 pts | 4° = 3 pts | 5° = 2 pts | 6°+ = 1 pt
    0 pts: ELM, RET, NSP, o faltas totales > 12
"""

import argparse
import json
import os
import sys
import zipfile
import tempfile
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    sys.exit("ERROR: pandas no instalado. Ejecuta: pip install pandas openpyxl --break-system-packages")

# ── Constantes ──────────────────────────────────────────────────────────────

PUNTOS = {1: 7, 2: 5, 3: 4, 4: 3, 5: 2}   # 6+ = 1
ESTADOS_CERO = {"ELM", "RET", "NSP"}

# Tab name → nombre oficial de categoría
TAB_TO_CATEGORIA = {
    "FC":       "Futuros Campeones",
    "ESC-MEN":  "Escuela Menores",
    "ESC-MAY":  "Escuela Mayores",
    "PRE-INF":  "Pre Infantil",
    "FOMENTO":  "Fomento Deportivo",
    "INF-C":    "Infantil C",
    "5TA-CAT":  "Quinta Categoría",
    "CAB-NOV":  "Caballos Novicios",
    "INF-B":    "Infantil B",
    "4TA-CAT":  "Cuarta Categoría",
    "CAB-JS1":  "Caballos Jóvenes S1",
    "INF-A":    "Infantil A",
    "3RA-CAT":  "Tercera Categoría",
    "CAB-JS2":  "Caballos Jóvenes S2",
    "PRE-JUV":  "Pre Juveniles",
    "2DA-CAT":  "Segunda Categoría",
    "JUV":      "Juveniles",
    "1RA-CAT":  "Primera Categoría",
    "ABIERTA":  "Abierta",
}

# ── Función de puntuación ────────────────────────────────────────────────────

def calcular_puntos(posicion, estado, faltas_totales):
    """
    Devuelve los puntos de ranking según el reglamento.
    - posicion: int o None
    - estado: str ("OK", "ELM", "RET", "NSP", etc.)
    - faltas_totales: float (faltas de obstáculos + penaliz. tiempo)
    """
    estado = str(estado).strip().upper() if estado else "OK"
    if estado in ESTADOS_CERO:
        return 0
    try:
        ft = float(faltas_totales)
    except (TypeError, ValueError):
        ft = 0.0
    if ft > 12:
        return 0
    if posicion is None:
        return 0
    try:
        pos = int(posicion)
    except (TypeError, ValueError):
        return 0
    return PUNTOS.get(pos, 1)  # 6+ = 1


# ── Lector de planilla Excel ─────────────────────────────────────────────────

def leer_xlsx(path_xlsx, num_cds):
    """
    Lee la PLANILLA_RESULTADOS_CDS_2026.xlsx y devuelve dict:
        { "NombreCategoria": [ {jinete, caballo, pos, faltas, pts}, ... ] }

    Layout de cada tab (DATA_START = fila 10, índice 9):
        Col A: Nro
        Col B: Jinete
        Col C: Caballo
        Col D: Nac (nacionalidad)
        Col E: Estado (OK/ELM/RET/NSP)
        Col F: Faltas Obstáculos
        Col G: Tiempo (seg)
        Col H: Penaliz.T (calculado, pero lo re-calculamos)
        Col I: Total Faltas
        Col J: Posición
        Col K: Puntos (fórmula — lo recalculamos)
    """
    print(f"\n[xlsx] Leyendo {path_xlsx} ...")
    resultados = {}

    try:
        sheets = pd.read_excel(path_xlsx, sheet_name=None, header=None, engine="openpyxl")
    except Exception as e:
        print(f"  ERROR abriendo xlsx: {e}")
        return resultados

    for tab_name, df in sheets.items():
        categoria = TAB_TO_CATEGORIA.get(tab_name)
        if not categoria:
            print(f"  Tab '{tab_name}' no reconocida, saltando.")
            continue
        if categoria == "Abierta":
            print(f"  Tab ABIERTA: no entra al ranking, saltando.")
            continue

        # Leer config de la prueba (fila 4, índice 3)
        try:
            tipo_prueba = str(df.iloc[3, 2]).strip()   # C4
            tiempo_acordado = df.iloc[3, 7]              # H4
        except Exception:
            tipo_prueba = ""
            tiempo_acordado = None

        # Datos desde fila 10 (índice 9)
        DATA_START = 9
        filas = []
        for i in range(DATA_START, len(df)):
            row = df.iloc[i]
            jinete = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
            caballo = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ""
            if not jinete or jinete in ("nan", "None", ""):
                continue  # fila vacía

            estado = str(row.iloc[4]).strip().upper() if pd.notna(row.iloc[4]) else "OK"
            faltas_obs = float(row.iloc[5]) if pd.notna(row.iloc[5]) else 0.0
            tiempo = float(row.iloc[6]) if pd.notna(row.iloc[6]) else None
            total_faltas = float(row.iloc[8]) if pd.notna(row.iloc[8]) else faltas_obs
            posicion = row.iloc[9] if pd.notna(row.iloc[9]) else None

            pts = calcular_puntos(posicion, estado, total_faltas)

            filas.append({
                "jinete": jinete,
                "caballo": caballo,
                "estado": estado,
                "faltas_obs": faltas_obs,
                "tiempo": tiempo,
                "total_faltas": total_faltas,
                "posicion": int(posicion) if posicion is not None else None,
                "puntos": pts,
                "fuente": "xlsx",
            })

        if filas:
            resultados[categoria] = filas
            print(f"  ✓ {tab_name:12s} → {categoria:30s}  ({len(filas)} binomios)")

    return resultados


# ── Lector de PDF (ZIP disfrazado) ───────────────────────────────────────────

def leer_pdf_zip(path_pdf, num_cds):
    """
    Los PDFs de ADESCRUZ son archivos ZIP que contienen páginas .txt + manifest.json.
    Este lector extrae el texto y hace un parseo básico.
    Para edición manual posterior.
    """
    print(f"\n[pdf] Leyendo {path_pdf} ...")
    resultados_raw = {}

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            with zipfile.ZipFile(path_pdf, 'r') as z:
                z.extractall(tmpdir)
            txt_files = sorted(Path(tmpdir).glob("*.txt"), key=lambda p: p.name)
            if not txt_files:
                print("  No se encontraron archivos .txt dentro del ZIP/PDF.")
                return resultados_raw

            print(f"  Encontradas {len(txt_files)} páginas de texto.")
            all_text = []
            for tf in txt_files:
                all_text.append(tf.read_text(encoding="utf-8", errors="replace"))

            # Guardar texto extraído para revisión manual
            out_txt = Path(path_pdf).stem + "_extraido.txt"
            with open(out_txt, "w", encoding="utf-8") as f:
                f.write("\n\n--- PÁGINA SIGUIENTE ---\n\n".join(all_text))
            print(f"  Texto extraído guardado en: {out_txt}")
            print("  NOTA: El parseo automático de PDF requiere revisión manual.")
            print("        Revisa el archivo .txt y usa la planilla Excel como fuente principal.")

    except zipfile.BadZipFile:
        print("  ERROR: El archivo no es un ZIP válido. ¿Es realmente un PDF de ADESCRUZ?")
    except Exception as e:
        print(f"  ERROR: {e}")

    return resultados_raw


# ── Generar JSON para el dashboard ──────────────────────────────────────────

def generar_json(resultados_por_categoria, num_cds):
    """
    Genera el bloque de datos listo para agregar al ranking_cds_2026.html
    """
    output = {
        f"cds{num_cds}": {}
    }
    for categoria, filas in resultados_por_categoria.items():
        output[f"cds{num_cds}"][categoria] = []
        for f in filas:
            output[f"cds{num_cds}"][categoria].append({
                "jinete": f["jinete"],
                "caballo": f["caballo"],
                "pos": f["posicion"],
                "faltas": f["total_faltas"],
                "pts": f["puntos"],
                "estado": f["estado"],
            })
    return output


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Pipeline de carga de resultados CDS ADESCRUZ")
    parser.add_argument("--cds", type=int, required=True, help="Número del CDS (ej: 4 para IV CDS)")
    parser.add_argument("--xlsx", type=str, help="Ruta al archivo Excel de planilla de resultados")
    parser.add_argument("--pdf",  type=str, help="Ruta al PDF/ZIP de resultados oficiales")
    args = parser.parse_args()

    if not args.xlsx and not args.pdf:
        sys.exit("ERROR: Debes indicar al menos --xlsx o --pdf")

    resultados = {}

    # Fuente primaria: xlsx
    if args.xlsx:
        if not os.path.exists(args.xlsx):
            print(f"ADVERTENCIA: No se encontró el archivo xlsx: {args.xlsx}")
        else:
            resultados_xlsx = leer_xlsx(args.xlsx, args.cds)
            resultados.update(resultados_xlsx)

    # Fuente secundaria: pdf (para categorías no cubiertas por xlsx, o verificación)
    if args.pdf:
        if not os.path.exists(args.pdf):
            print(f"ADVERTENCIA: No se encontró el archivo pdf: {args.pdf}")
        else:
            resultados_pdf = leer_pdf_zip(args.pdf, args.cds)
            # Solo agrega categorías no ya cargadas por xlsx
            for cat, filas in resultados_pdf.items():
                if cat not in resultados:
                    resultados[cat] = filas

    if not resultados:
        sys.exit("No se pudieron cargar resultados de ninguna fuente.")

    # Generar JSON
    datos_json = generar_json(resultados, args.cds)
    json_path = f"resultados_cds{args.cds}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(datos_json, f, ensure_ascii=False, indent=2)

    print(f"\n✅ JSON generado: {json_path}")
    print(f"   {sum(len(v) for v in resultados.values())} binomios en {len(resultados)} categorías")
    print(f"\nPróximo paso: abre {json_path} y revisa los datos antes de cargarlos al dashboard.\n")

    # Resumen por categoría
    print("── Resumen ──────────────────────────────────────────────────────")
    for cat, filas in sorted(resultados.items()):
        pts_max = max((f["puntos"] for f in filas), default=0)
        print(f"  {cat:30s}  {len(filas):2d} binomios  pts_max={pts_max}")
    print()


if __name__ == "__main__":
    main()
