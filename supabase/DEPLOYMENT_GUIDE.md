# Quick Deployment Guide — Email Functions

## TL;DR

```bash
# 1. Create tables (in Supabase SQL Editor)
# Copy-paste from: ../mnt/Dashboards\ \&\ Websites/adescruz-app/supabase/migrations/002_inscripciones_afiliaciones_acceso.sql

# 2. Set Resend API key as secret
# Supabase Dashboard → Project Settings → Secrets → Create: RESEND_API_KEY

# 3. Create storage buckets (Supabase Dashboard → Storage)
# - afiliaciones (private)
# - inscripciones (private)

# 4. Deploy functions
cd supabase
supabase link --project-ref djuelrvcjuqvwxvumvzd
supabase login

supabase functions deploy notify-afiliacion --no-verify-jwt
supabase functions deploy notify-inscripcion --no-verify-jwt
supabase functions deploy notify-acceso --no-verify-jwt

# 5. Set up webhooks (Supabase Dashboard → Database → Webhooks)
# Three webhooks pointing to the three functions above

# 6. Test
INSERT INTO inscripciones (concurso_id, nombre, celular, cat_oficial, club, equino, cat_concurso, dias)
VALUES ('IV-CDS-2026', 'Test', '70012345', 'Infantil A', 'CHSC', 'Test', 'Infantil A', 'ambos');
```

---

## Files Created

### Edge Functions (Deno/TypeScript)
- `supabase/functions/notify-afiliacion/index.ts`
- `supabase/functions/notify-inscripcion/index.ts`
- `supabase/functions/notify-acceso/index.ts`

### Database Migration
- `mnt/Dashboards & Websites/adescruz-app/supabase/migrations/002_inscripciones_afiliaciones_acceso.sql`

### Updated HTML Form
- `mnt/Dashboards & Websites/inscripcion_cds.html` (Supabase client added + form submission logic)

### Documentation
- `supabase/README_EMAIL_SETUP.md` (Full setup guide)
- `supabase/DEPLOYMENT_GUIDE.md` (This file)

---

## What Each Function Does

### `notify-afiliacion`
**Trigger**: INSERT to `afiliaciones` table  
**Emails**:
1. To jinete (form submitter) → Confirmation receipt
2. To admin → Full details for review

**Response**: Success/error with function execution details

---

### `notify-inscripcion`
**Trigger**: INSERT to `inscripciones` table  
**Emails**:
1. To jinete → Confirmation receipt
2. To admin → Full details for review

**Response**: Success/error with function execution details

---

### `notify-acceso`
**Trigger**: INSERT to `solicitudes_acceso` table  
**Emails**:
1. To admin → Access request details (name, email, requested role)

**Response**: Success/error with function execution details

---

## Form Integration Status

### inscripcion_cds.html
✅ **COMPLETE** — Supabase client initialized + file upload + database insert

- Loads `@supabase/supabase-js@2` from CDN
- Uses `_inscClient` variable (avoids CDN name collision)
- On form submit:
  1. Uploads comprobante to `inscripciones/{timestamp}.{ext}`
  2. Inserts inscription record to `inscripciones` table
  3. Webhook automatically triggers → `notify-inscripcion` email

### registro.html (Affiliation form)
⚠️ **TODO** — Not yet integrated. Should follow same pattern as `inscripcion_cds.html`

### login.html (Access request form)
⚠️ **TODO** — Not yet integrated. Should follow same pattern

---

## Environment Setup

### Local (for testing)

```bash
# Install Supabase CLI
npm install -g supabase

# Navigate to project
cd /path/to/project/supabase

# Link to project
supabase link --project-ref djuelrvcjuqvwxvumvzd

# Login
supabase login

# View functions
supabase functions list

# Deploy (one at a time)
supabase functions deploy notify-afiliacion --no-verify-jwt
supabase functions deploy notify-inscripcion --no-verify-jwt
supabase functions deploy notify-acceso --no-verify-jwt
```

### Supabase Dashboard

1. **SQL Editor** → Run migration script
2. **Storage** → Create buckets: `afiliaciones`, `inscripciones`
3. **Project Settings → Secrets** → Add `RESEND_API_KEY`
4. **Database → Webhooks** → Create 3 webhooks (one per function)

---

## Email Customization

All emails are Spanish with professional HTML templates.

### Colors
- **Primary**: `#1a4731` (ADESCRUZ green)
- **Secondary**: `#2d6a4f` (darker green)
- **Background**: `#f0f7f4` (light green)
- **Text**: `#111827` (dark gray)
- **Muted**: `#6b7280` (light gray)

### To update:
1. Edit `generateXxxEmail()` function in respective `.ts` file
2. Redeploy: `supabase functions deploy {function-name}`

### To add HTML signature:
Modify footer section in `generateXxxEmail()` function:

```html
<p style="...">
  ADESCRUZ — Asociación de Deportes Ecuestres de Santa Cruz<br>
  Santa Cruz de la Sierra, Bolivia<br>
  <a href="https://adescruz.com" style="...">adescruz.com</a>
</p>
```

---

## Testing

### Test Email 1: Afiliación
```sql
INSERT INTO afiliaciones (temporada, nombre, email, celular, club, categoria_id, nombre_caballo)
VALUES ('2026', 'Test Rider', 'your-email@example.com', '70012345', 'Club Test', 1, 'Test Horse');
```

### Test Email 2: Inscripción
```sql
INSERT INTO inscripciones (concurso_id, nombre, celular, cat_oficial, club, equino, cat_concurso, dias)
VALUES ('IV-CDS-2026', 'Test Rider', '70012345', 'Infantil A', 'Club Test', 'Test Horse', 'Infantil A', 'ambos');
```

### Test Email 3: Acceso
```sql
INSERT INTO solicitudes_acceso (nombre, email, rol)
VALUES ('Test User', 'your-email@example.com', 'jurado');
```

### Check Results
1. **Supabase** → Database → Webhooks → Recent Invocations
2. **Resend Dashboard** → View sent emails
3. **Email inbox** → Should receive test emails within 1-2 seconds

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not triggering | Check: RLS policies, function deployed, webhook enabled |
| Email not sending | Check: RESEND_API_KEY set, function logs, Resend dashboard |
| 401 Unauthorized | Resend API key invalid or expired |
| Form submit fails | Check: bucket exists, file < 50MB, RLS allows insert |
| Email styling broken | Email client may not support CSS; use inline styles only |

---

## Next Steps

1. **Deploy functions** using `supabase functions deploy ...`
2. **Create webhooks** in Supabase Dashboard
3. **Test each function** with SQL inserts
4. **Integrate registro.html** (affiliation form) with Supabase client
5. **Integrate login.html** (access request form) with Supabase client
6. **Set up email forwarding** (optional: admin@adescruz.com → daniel.roca.s@gmail.com)

---

**Status**: Ready for deployment  
**Tested**: ✅ Email templates, ✅ HTML forms, ⚠️ Live Resend integration (pending API key)  
**Last Updated**: April 2026
