---
titulo: El «Mensaje al cerrar» no aparecía en la página de inscripción (2-oct-2026)
tags: [adescruz, inscripciones, sitio]
actualizada: 2026-10-06
estado: activa
enlaces_sugeridos: [arquitectura-web, pendientes]
---

# El «Mensaje al cerrar» no aparecía en la página de inscripción

El 2026-10-02 Daniel cerró las inscripciones porque el concurso se cancelaba por mal tiempo. Escribió el
motivo en el admin, en «Mensaje al cerrar», y reportó que el mensaje «no se guarda». No quedó confirmado de qué
CDS se trataba. Por las fechas, probablemente el XV (3-4 de octubre).

## Causa

El mensaje sí se guardaba. El botón «Guardar mensaje» del admin escribe `site_config.insc_cierre_msg`, y los
administradores tienen permiso para hacerlo. **La página pública nunca lo mostraba.**

Desde que la apertura y el cierre son por CDS (`campeonatos.inscripciones_abiertas`), cuando no hay ningún CDS
abierto `inscripcion_cds.html` muestra un texto fijo desde `renderSinInscripciones()`: «No hay ningún concurso
con inscripciones abiertas en este momento». El mensaje del admin solo se mostraba en otra pantalla, que
depende del interruptor global viejo `site_config.insc_abierto`. El admin ya no lee ni escribe ese
interruptor.

## Qué se hizo (HECHO)

- **Corrección** en la rama `fix/mensaje-cierre-inscripciones` de adescruz-site (commit `b26f55e`). Con las
  inscripciones cerradas, la página lee `insc_cierre_msg` y lo muestra como texto, respetando los saltos de
  línea. Si no hay mensaje o no se puede leer, queda el texto fijo. El enlace al calendario se mantiene debajo.
- **Probada en Chromium** con las respuestas de la base simuladas: con mensaje, sin mensaje, y con HTML dentro
  del mensaje. El HTML se muestra como texto, no se interpreta. No hubo errores de JavaScript.
- **Efecto aceptado:** el mensaje es uno solo para todos los CDS, como ya había decidido Daniel. Se va a ver
  cada vez que no haya inscripciones abiertas, hasta que se cambie o se borre en el admin.

## Qué quedó abierto

- 🔴 **No está publicada** (al 2026-10-02, cuando terminó esta sesión). Daniel no recuerda cómo se publica el
  sitio. El README dice que Vercel publica solo al subir a `main`, pero en `main` hay muchos commits marcados
  «(SIN publicar)» después de `38f1e4e`, del 2026-09-24. No se sabe si esos commits están en producción. Se
  le dejó a Daniel una tarea para una sesión local que averigua el proceso, le consulta antes de sacar a
  producción commits «SIN publicar», publica, y documenta el proceso en el README. Esta sesión no sabe si esa
  tarea se hizo.
- **Resto del sistema viejo:** `checkInscripcionesEstado()` en la misma página todavía lee
  `site_config.insc_abierto`, un interruptor que el admin ya no maneja. No se tocó.
- **Observación de esta sesión, sin decidir:** en el banner amarillo de «No hay inscripciones abiertas», el
  texto blanco sobre amarillo claro casi no se lee. No se cambió.

Relacionado: [[adescruz]]
