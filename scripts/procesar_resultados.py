#!/usr/bin/env python3
"""
ADESCRUZ — Procesador de Resultados
====================================
Lee un archivo Excel (.xlsx) con resultados de una prueba de CDS y los
sube directamente a Supabase.

Formato esperado del Excel (columnas en orden):
  A: Posición    (número, vacío si ELM/RET/NSP)
  B: Jinete      (nombre completo, debe existir en tabla jinetes)
  C: Caballo     (nombre, debe existir en tabla caballos)
  D: Faltas      (número decimal, ej: 4, 8.25)
  E: Tiempo (s)  (número decimal)
  F: Estado      (completed / ELM / RET / NSP — vacío = completed)

Uso:
  python procesar_resultados.py \\
    --file resultados_cds1_dia1_prueba1.xlsx \\
    --prueba-id <UUID de la prueba> \\
    --supabase-url https://xxx.supabase.co \\
    --supabase-key <service_role_key>

Dependencias:
  pip install openpyxl supabase
"""

import argparse
import sys
import re
from typing import Optional

try:
    import openpyxl
except ImportError:
    print("ERROR: Instala openpyxl primero: pip install openpyxl")
    sys.exit(1)

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: Instala supabase-py primero: pip install supabase")
    sys.exit(1)


# ── Puntuación ADESCRUZ ─────────────────────────────────────────────────────

def calcular_puntos(posicion: Optional[int], faltas: Optional[float], estado: str) -> int:
    if estado in ('ELM', 'RET', 'NSP'):
        return 0
    if faltas is not None and faltas > 12:
        return 0
    if posicion is None:
        return 0
    tabla = {1: 7, 2: 5, 3: 4, 4: 3, 5: 2}
    return tabla.get(posicion, 1)


# ── Helpers ──────────────────────────────────────────────────────────────────

def find_jinete(supabase: Client, nombre: str) -> Optional[str]:
    """Busca jinete por nombre completo (case-insensitive)."""
    res = supabase.table('jinetes').select('id, full_name').execute()
    for j in res.data:
        if j['full_name'].strip().lower() == nombre.strip().lower():
            return j['id']
    return None


def find_caballo(supabase: Client, nombre: str, jinete_id: str) -> Optional[str]:
    """Busca caballo por nombre dentro de los caballos del jinete."""
    res = (supabase.table('caballos')
           .select('id, nombre')
           .eq('owner_id', jinete_id)
           .execute())
    for c in res.data:
        if c['nombre'].strip().lower() == nombre.strip().lower():
            return c['id']
    # Fallback: cualquier caballo con ese nombre
    res2 = (supabase.table('caballos')
            .select('id, nombre')
            .ilike('nombre', nombre.strip())
            .limit(1)
            .execute())
    return res2.data[0]['id'] if res2.data else None


def parse_estado(raw: str) -> str:
    val = str(raw).strip().upper()
    if val in ('ELM', 'RET', 'NSP'):
        return val
    return 'completed'


def parse_float(raw) -> Optional[float]:
    if raw is None or str(raw).strip() == '':
        return None
    try:
        return float(str(raw).replace(',', '.'))
    except ValueError:
        return None


def parse_int(raw) -> Optional[int]:
    if raw is None or str(raw).strip() == '':
        return None
    try:
        return int(float(str(raw)))
    except ValueError:
        return None


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Procesar resultados ADESCRUZ desde Excel')
    parser.add_argument('--file', required=True, help='Ruta al archivo .xlsx')
    parser.add_argument('--prueba-id', required=True, help='UUID de la prueba en Supabase')
    parser.add_argument('--supabase-url', required=True)
    parser.add_argument('--supabase-key', required=True, help='Service role key')
    parser.add_argument('--uploaded-by', required=True, help='UUID del usuario que sube')
    parser.add_argument('--dry-run', action='store_true', help='Simular sin insertar en BD')
    args = parser.parse_args()

    supabase: Client = create_client(args.supabase_url, args.supabase_key)

    # Open workbook
    try:
        wb = openpyxl.load_workbook(args.file, data_only=True)
        ws = wb.active
    except Exception as e:
        print(f"ERROR: No se pudo abrir {args.file}: {e}")
        sys.exit(1)

    rows_data = list(ws.iter_rows(min_row=2, values_only=True))  # skip header
    print(f"📄 {len(rows_data)} filas encontradas en {args.file}")

    resultados = []
    errores = []

    for i, row in enumerate(rows_data, start=2):
        if not any(row):
            continue  # skip empty rows

        posicion  = parse_int(row[0])
        jinete_nm = str(row[1]).strip() if row[1] else None
        caballo_nm = str(row[2]).strip() if row[2] else None
        faltas    = parse_float(row[3])
        tiempo    = parse_float(row[4])
        estado_raw = str(row[5]).strip() if row[5] else 'completed'
        estado    = parse_estado(estado_raw)

        if not jinete_nm or not caballo_nm:
            errores.append(f"  Fila {i}: faltan jinete o caballo")
            continue

        # Lookup jinete
        jinete_id = find_jinete(supabase, jinete_nm)
        if not jinete_id:
            errores.append(f"  Fila {i}: Jinete '{jinete_nm}' no encontrado en BD")
            continue

        # Lookup caballo
        caballo_id = find_caballo(supabase, caballo_nm, jinete_id)
        if not caballo_id:
            errores.append(f"  Fila {i}: Caballo '{caballo_nm}' no encontrado en BD")
            continue

        puntos = calcular_puntos(posicion, faltas, estado)

        resultado = {
            'prueba_id': args.prueba_id,
            'jinete_id': jinete_id,
            'caballo_id': caballo_id,
            'posicion': posicion,
            'faltas': faltas,
            'tiempo_seg': tiempo,
            'penalizacion_tiempo': 0,
            'estado_resultado': estado,
            'puntos_asignados': puntos,
            'uploaded_by': args.uploaded_by,
        }
        resultados.append(resultado)
        print(f"  ✓ Fila {i}: {jinete_nm} / {caballo_nm} — pos:{posicion} faltas:{faltas} → {puntos}pts [{estado}]")

    print(f"\n📊 {len(resultados)} resultados válidos, {len(errores)} errores")

    if errores:
        print("\n⚠️  Errores encontrados:")
        for e in errores:
            print(e)

    if not resultados:
        print("\nNada que insertar.")
        return

    if args.dry_run:
        print("\n🔵 Dry run — no se insertó nada en la BD.")
        return

    # Upsert to Supabase
    print(f"\n⬆️  Insertando {len(resultados)} resultados en Supabase…")
    res = supabase.table('resultados').upsert(
        resultados,
        on_conflict='prueba_id,jinete_id,caballo_id'
    ).execute()

    if hasattr(res, 'error') and res.error:
        print(f"ERROR al insertar: {res.error}")
        sys.exit(1)

    print(f"✅ {len(resultados)} resultados cargados exitosamente")

    # Mark prueba as completed
    supabase.table('pruebas').update({'estado': 'completed'}).eq('id', args.prueba_id).execute()
    print(f"✅ Prueba marcada como completada")

    print("\nRecordá recalcular el ranking desde el panel de Admin.")


if __name__ == '__main__':
    main()
