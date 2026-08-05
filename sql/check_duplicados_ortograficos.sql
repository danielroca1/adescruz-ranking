-- ═══════════════════════════════════════════════════════════════════════
-- Diagnóstico — duplicados por variaciones ortográficas (tildes, espacios, mayúsculas)
-- Fecha: 2026-04-20
-- Motivo: Sofía Gallardo / Sofia Gallardo aparecen como 2 binomios en Escuela Menores.
--         Buscar todos los casos similares (jinetes y caballos).
-- Nota: usa TRANSLATE en lugar de unaccent (evita requerir la extensión).
-- ═══════════════════════════════════════════════════════════════════════

-- Consulta 1 — JINETES con variantes ortográficas en resultados_pdf
SELECT LOWER(TRANSLATE(TRIM(jinete),
                       'áéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
                       'aeiouaeiounnuuaeiouaeiouaeiouaeiou')) AS jinete_norm,
       COUNT(DISTINCT jinete)                                  AS n_variantes,
       ARRAY_AGG(DISTINCT jinete ORDER BY jinete)              AS variantes,
       COUNT(*)                                                AS filas_totales
FROM resultados_pdf
GROUP BY LOWER(TRANSLATE(TRIM(jinete),
                         'áéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
                         'aeiouaeiounnuuaeiouaeiouaeiouaeiou'))
HAVING COUNT(DISTINCT jinete) >= 2
ORDER BY jinete_norm;

-- Consulta 2 — CABALLOS con variantes ortográficas en resultados_pdf
SELECT LOWER(TRANSLATE(TRIM(caballo),
                       'áéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
                       'aeiouaeiounnuuaeiouaeiouaeiouaeiou')) AS caballo_norm,
       COUNT(DISTINCT caballo)                                 AS n_variantes,
       ARRAY_AGG(DISTINCT caballo ORDER BY caballo)            AS variantes,
       COUNT(*)                                                AS filas_totales
FROM resultados_pdf
GROUP BY LOWER(TRANSLATE(TRIM(caballo),
                         'áéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
                         'aeiouaeiounnuuaeiouaeiouaeiouaeiou'))
HAVING COUNT(DISTINCT caballo) >= 2
ORDER BY caballo_norm;

-- Consulta 3 — BINOMIOS (jinete+caballo) donde la combinación normalizada se repite con distintas grafías
SELECT LOWER(TRANSLATE(TRIM(jinete),
                       'áéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
                       'aeiouaeiounnuuaeiouaeiouaeiouaeiou'))  AS jinete_norm,
       LOWER(TRANSLATE(TRIM(caballo),
                       'áéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
                       'aeiouaeiounnuuaeiouaeiouaeiouaeiou'))  AS caballo_norm,
       ARRAY_AGG(DISTINCT jinete  ORDER BY jinete)             AS variantes_jinete,
       ARRAY_AGG(DISTINCT caballo ORDER BY caballo)            AS variantes_caballo,
       ARRAY_AGG(DISTINCT categoria ORDER BY categoria)        AS categorias,
       COUNT(*) AS filas
FROM resultados_pdf
GROUP BY LOWER(TRANSLATE(TRIM(jinete),
                         'áéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
                         'aeiouaeiounnuuaeiouaeiouaeiouaeiou')),
         LOWER(TRANSLATE(TRIM(caballo),
                         'áéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
                         'aeiouaeiounnuuaeiouaeiouaeiouaeiou'))
HAVING COUNT(DISTINCT jinete) >= 2 OR COUNT(DISTINCT caballo) >= 2
ORDER BY jinete_norm, caballo_norm;
