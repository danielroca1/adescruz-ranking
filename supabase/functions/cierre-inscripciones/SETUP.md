# Cierre Automático de Inscripciones — Edge Function

Per-CDS auto-close. Cron-driven, idempotent, gated by DB state.

**Last refactor:** 2026-05-03 (migrated from global `site_config` to per-CDS columns in `campeonatos`).

---

## Architecture

### Table: `campeonatos` (per-CDS columns)

| column                | type         | meaning                                                                 |
|-----------------------|--------------|-------------------------------------------------------------------------|
| `cierre_fecha`        | timestamptz  | When auto-close fires (UTC). Default = Friday-before-CDS at 15:00 BOT.  |
| `cierre_activo`       | boolean      | If false, function ignores this CDS even past its cierre_fecha.         |
| `cierre_emails`       | text         | CSV of recipients for the order-of-entry Excel.                         |
| `cierre_ejecutado_en` | timestamptz  | NULL = pending. Set to NOW() when the function processes the CDS. Gates re-runs. |

### Site-wide global (still in `site_config`)

| key                | meaning                                                  |
|--------------------|----------------------------------------------------------|
| `insc_cierre_msg`  | Banner text shown publicly when a CDS's inscripciones are closed. Same text for every CDS. |

### Helper function (Postgres)

```sql
public.calcular_cierre_default(fecha_sab date, fecha_dom date) RETURNS timestamptz
```
Returns Friday-before-first-day at 15:00 BOT. Used at backfill time and can be reused by the admin UI when creating a new CDS.

---

## Function flow (`index.ts`)

```
runCierre()
 └── SELECT campeonatos
       WHERE cierre_activo = true
         AND inscripciones_abiertas = true
         AND cierre_ejecutado_en IS NULL
         AND cierre_fecha <= NOW()
 └── for each pending CDS:
       processCampeonato(c):
         1. UPDATE campeonatos
              SET inscripciones_abiertas = false,
                  cierre_ejecutado_en = NOW()
              WHERE id = c.id
            (mark closed FIRST so failures mid-flight don't allow more registrations)
         2. concurso_id = "{roman(numero)}-CDS-{temporada}"   e.g. "VI-CDS-2026"
         3. SELECT inscripciones WHERE concurso_id = concurso_id
         4. Generate Excel grouped by cat_concurso (alternating row colors)
         5. Email Excel to recipients = c.cierre_emails.split(',')
```

Idempotent: the `cierre_ejecutado_en IS NULL` filter prevents double-processing. To force a re-close, an admin must manually clear `cierre_ejecutado_en`.

---

## Schedule (pg_cron)

```sql
SELECT cron.schedule(
  'cierre-inscripciones-tick',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://djuelrvcjuqvwxvumvzd.supabase.co/functions/v1/cierre-inscripciones',
       headers := jsonb_build_object(
         'Authorization', 'Bearer <PUBLISHABLE_KEY>',
         'Content-Type',  'application/json'
       ),
       body := '{}'::jsonb
     ); $$
);
```

Tick every 5 minutes. Function returns `{processed: 0, message: "no pending closures"}` on no-op ticks (cheap).

---

## Environment variables (Supabase → Edge Functions Secrets)

- `SUPABASE_URL` — auto
- `SUPABASE_SERVICE_ROLE_KEY` — required (the function updates `campeonatos` and reads all `inscripciones`)
- `RESEND_API_KEY` — required for email delivery via Resend

Sender domain `no-reply@adescruz.com` must be verified in Resend.

---

## Manual testing

```bash
curl -s --ssl-no-revoke -X POST \
  https://djuelrvcjuqvwxvumvzd.supabase.co/functions/v1/cierre-inscripciones \
  -H "Authorization: Bearer <PUBLISHABLE_KEY>"
```

To force a closure now:
```sql
UPDATE campeonatos
SET cierre_fecha = NOW() - interval '1 minute',
    cierre_ejecutado_en = NULL,
    inscripciones_abiertas = true
WHERE numero = <N> AND temporada = 2026;
```
Then either wait for the next cron tick or curl manually.

---

## Admin UI integration

`admin.html` page Inscripciones, card "⏰ Cierre automático":

- Top section (per-CDS): activo toggle, fecha, hora, emails. Bound to selected CDS in the header dropdown. Saves via `saveAutocloseConfig()` → UPDATE `campeonatos`.
- Bottom section (global): mensaje al cerrar. Saves via `saveCierreMsg()` → UPSERT `site_config[insc_cierre_msg]`.
- "📧 Destinatarios pre-cargados del [CDS anterior]" banner appears when the current CDS has no `cierre_emails` and a previous CDS does — admin sees the inherited list, can edit before saving.
- "✓ Cierre ya ejecutado el …" banner appears when `cierre_ejecutado_en` is set.

---

## Troubleshooting

### "No pending closures" on every tick
- Verify the target CDS has `inscripciones_abiertas = true` AND `cierre_activo = true` AND `cierre_ejecutado_en IS NULL` AND `cierre_fecha <= NOW()`.
- Check `cron.job` for the schedule: `SELECT * FROM cron.job WHERE jobname = 'cierre-inscripciones-tick';`
- Recent tick history: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

### Function logs
Supabase Dashboard → Edge Functions → `cierre-inscripciones` → Logs.

### Email not sending
- Verify `RESEND_API_KEY` secret is set
- Check Resend dashboard for delivery status
- `cierre_emails` must be comma-separated and non-empty
