---
titulo: Las inscripciones del XV (cancelado por mal tiempo) se movieron al XVI (6-oct-2026)
tags: [adescruz, inscripciones, calendario]
actualizada: 2026-10-06
estado: activa
enlaces_sugeridos: [calendario-2026, cobro-de-inscripciones]
---

# Las inscripciones del XV se movieron al XVI

El XV CDS (3-4 oct, CHSC) se canceló por mal tiempo. El 2026-10-06 Daniel decidió que sus inscripciones
pasaran al XVI (10-11 oct). Las tres decisiones las tomó él:

- **Del XV al XVI.** El XV se cancela; no se reprograma.
- **Mover, no copiar.** El anti-reúso (`operaciones_consumidas`) guarda el N° de operación apuntando al
  id de la inscripción. Al mover, el id no cambia y la reserva sigue valiendo. Una copia tendría otro id
  y el trigger la frenaría como «comprobante repetido» al aprobarla.
- **Todas menos las rechazadas.** No había ninguna rechazada.

## Qué se hizo (HECHO)

Daniel corrió el script en el SQL Editor de Supabase el 2026-10-06. El script está en
`sql/MOVER_INSCRIPCIONES_XV_A_XVI_2026-10-06.sql`, en la rama `sql/mover-inscripciones-xv-a-xvi` de
adescruz-ranking.

| Control | Resultado |
|---|---|
| Inscripciones a mover | 5 |
| Rechazadas que quedaban en el XV | 0 |
| Ya inscriptas en el XVI antes de mover | 1 |
| Duplicados (mismo jinete, caballo y categoría en los dos) | 0 |
| Después: quedan en el XV | 0 |
| Después: total en el XVI | 6 |

- Solo cambió `concurso_id` y se agregó una línea a `nota_admin` («Movida del XV al XVI el 6-oct-2026…»).
  No se tocaron `estado`, el comprobante, el N° de operación ni la glosa.
- **Respaldo:** la tabla `_respaldo_mover_xv_xvi_20261006` guarda el `concurso_id` y la `nota_admin`
  originales. Tiene RLS activado y sin políticas, para que no se pueda leer con la clave pública. El
  script trae la consulta para deshacer el movimiento.

## Para tener en cuenta

- **Los comprobantes movidos tienen la glosa «XV CDS 2026».** En el cierre económico del XVI pueden
  aparecer como glosa distinta. Son pagos válidos del XV.
- **Sin verificar en esta sesión:** si el XV quedó marcado como `cancelado` en `campeonatos` y si el
  cierre automático del XVI está activo y con la fecha correcta.

Relacionado: [[adescruz]]
