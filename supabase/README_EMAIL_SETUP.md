# ADESCRUZ Email Notifications Setup

This document provides instructions for deploying Supabase Edge Functions and configuring webhooks for transactional emails via Resend API.

---

## Overview

Three Supabase Edge Functions send transactional emails in Spanish:

1. **notify-afiliacion** — Triggered on INSERT to `afiliaciones` table
   - Sends confirmation email to jinete
   - Sends notification email to admin (daniel.roca.s@gmail.com)

2. **notify-inscripcion** — Triggered on INSERT to `inscripciones` table
   - Sends confirmation email to jinete
   - Sends notification email to admin

3. **notify-acceso** — Triggered on INSERT to `solicitudes_acceso` table
   - Sends notification email to admin with access request details

All emails:
- Sent via Resend API (`no-reply@adescruz.com`)
- Use table-based HTML layout with ADESCRUZ green (#1a4731)
- Include horse emoji 🐴 and professional styling
- Fully translated to Spanish

---

## Prerequisites

1. **Supabase Project**: `https://djuelrvcjuqvwxvumvzd.supabase.co`
2. **Resend API Key**: Must be stored as a secret in Supabase
3. **Edge Functions**: Deno runtime (provided by Supabase)
4. **Supabase CLI**: Install locally for deployment

---

## Step 1: Create Required Tables

Execute the following SQL in Supabase SQL Editor:

### Table: `afiliaciones`
```sql
CREATE TABLE afiliaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  temporada TEXT NOT NULL,
  jinete_id UUID REFERENCES jinetes(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  celular TEXT NOT NULL,
  club TEXT NOT NULL,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  nombre_caballo TEXT NOT NULL,
  comprobante_url TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  notas_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_afiliaciones_temporada ON afiliaciones(temporada);
CREATE INDEX idx_afiliaciones_estado ON afiliaciones(estado);
CREATE INDEX idx_afiliaciones_email ON afiliaciones(email);

-- Enable RLS
ALTER TABLE afiliaciones ENABLE ROW LEVEL SECURITY;

-- Public can insert (open form)
CREATE POLICY "afiliaciones_public_insert" ON afiliaciones FOR INSERT WITH CHECK (true);

-- Admin can read/update all
CREATE POLICY "afiliaciones_admin_all" ON afiliaciones FOR ALL USING (current_user_role() = 'admin');
```

### Table: `inscripciones`
```sql
CREATE TABLE inscripciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concurso_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  celular TEXT NOT NULL,
  cat_oficial TEXT NOT NULL,
  club TEXT NOT NULL,
  equino TEXT NOT NULL,
  cat_concurso TEXT NOT NULL,
  dias TEXT NOT NULL CHECK (dias IN ('ambos', 'sabado', 'domingo')),
  comprobante_url TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'rechazado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inscripciones_concurso ON inscripciones(concurso_id);
CREATE INDEX idx_inscripciones_estado ON inscripciones(estado);

-- Enable RLS
ALTER TABLE inscripciones ENABLE ROW LEVEL SECURITY;

-- Public can insert (open form)
CREATE POLICY "inscripciones_public_insert" ON inscripciones FOR INSERT WITH CHECK (true);

-- Admin can read/update all
CREATE POLICY "inscripciones_admin_all" ON inscripciones FOR ALL USING (current_user_role() = 'admin');
```

### Table: `solicitudes_acceso`
```sql
CREATE TABLE solicitudes_acceso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'jurado', 'jinete')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solicitudes_acceso_estado ON solicitudes_acceso(estado);
CREATE INDEX idx_solicitudes_acceso_email ON solicitudes_acceso(email);

-- Enable RLS
ALTER TABLE solicitudes_acceso ENABLE ROW LEVEL SECURITY;

-- Public can insert (open form)
CREATE POLICY "solicitudes_acceso_public_insert" ON solicitudes_acceso FOR INSERT WITH CHECK (true);

-- Admin can read/update all
CREATE POLICY "solicitudes_acceso_admin_all" ON solicitudes_acceso FOR ALL USING (current_user_role() = 'admin');
```

---

## Step 2: Create Storage Buckets

Create these storage buckets in Supabase Dashboard → Storage:

1. **`inscripciones`** (Private)
   - For storing inscripcion form proofs-of-payment
   - Path: `IV-CDS-2026/{timestamp}-{random}.{ext}`

2. **`afiliaciones`** (Private)
   - For storing affiliation proofs-of-payment
   - Path: `{temporada}/{timestamp}-{random}.{ext}`

---

## Step 3: Set Resend API Secret

In Supabase Dashboard → Project Settings → Secrets:

1. Create a new secret:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_xxxxxxxxxxxxx` (your Resend API key)

---

## Step 4: Deploy Edge Functions

### Local Setup (if not already done):

```bash
# Install Supabase CLI
npm install -g supabase

# Link your Supabase project
supabase link --project-ref djuelrvcjuqvwxvumvzd

# Login to Supabase
supabase login
```

### Deploy Functions:

```bash
cd /path/to/supabase

# Deploy notify-afiliacion
supabase functions deploy notify-afiliacion --no-verify-jwt

# Deploy notify-inscripcion
supabase functions deploy notify-inscripcion --no-verify-jwt

# Deploy notify-acceso
supabase functions deploy notify-acceso --no-verify-jwt

# Verify deployment
supabase functions list
```

**Note**: `--no-verify-jwt` allows public webhook triggers. For production, consider requiring signed webhooks.

---

## Step 5: Configure Webhooks in Supabase Dashboard

### Webhook 1: afiliaciones INSERT

1. Go to **Database → Webhooks**
2. Click **Create webhook**
   - **Name**: `notify-afiliacion-webhook`
   - **Table**: `afiliaciones`
   - **Event**: `Insert`
   - **Function**: `notify-afiliacion`
   - **Enabled**: Toggle ON

### Webhook 2: inscripciones INSERT

1. **Create webhook**
   - **Name**: `notify-inscripcion-webhook`
   - **Table**: `inscripciones`
   - **Event**: `Insert`
   - **Function**: `notify-inscripcion`
   - **Enabled**: Toggle ON

### Webhook 3: solicitudes_acceso INSERT

1. **Create webhook**
   - **Name**: `notify-acceso-webhook`
   - **Table**: `solicitudes_acceso`
   - **Event**: `Insert`
   - **Function**: `notify-acceso`
   - **Enabled**: Toggle ON

---

## Step 6: Verify Email Sending

Test the webhooks by inserting test records:

### Test afiliacion email:
```sql
INSERT INTO afiliaciones (temporada, nombre, email, celular, club, categoria_id, nombre_caballo)
VALUES ('2026', 'Test Rider', 'test@example.com', '70012345', 'Club Hípico Santa Cruz', 1, 'Test Horse');
```

### Test inscripcion email:
```sql
INSERT INTO inscripciones (concurso_id, nombre, celular, cat_oficial, club, equino, cat_concurso, dias)
VALUES ('IV-CDS-2026', 'Test Rider', '70012345', 'Infantil A', 'Club Hípico Santa Cruz', 'Test Horse', 'Infantil A', 'ambos');
```

### Test acceso email:
```sql
INSERT INTO solicitudes_acceso (nombre, email, rol)
VALUES ('Test User', 'test@example.com', 'jurado');
```

Check:
1. **Supabase Dashboard → Webhooks → Recent Invocations** for function execution status
2. **Resend Dashboard** for delivered emails
3. Test email inbox for receipt

---

## Step 7: Configure inscripcion_cds.html

The file `/mnt/Dashboards & Websites/inscripcion_cds.html` has been updated to:

1. Load Supabase JS library from CDN
2. Initialize Supabase client with project URL and anon key
3. On form submission:
   - Upload comprobante file to `inscripciones` storage bucket
   - Insert inscription record to `inscripciones` table
   - Trigger webhook → notify-inscripcion email

**Key variables** (avoid CDN name collision):
- `_INSC_URL`: Supabase project URL
- `_INSC_KEY`: Supabase anon key
- `_inscClient`: Supabase client instance

---

## Email Template Customization

### Language
All emails are in Spanish (es-ES).

### Branding
- Primary color: `#1a4731` (ADESCRUZ green)
- Accent color: `#2d6a4f` (darker green)
- Background: `#f0f7f4` (light green)

### To customize:

1. Edit function files in `supabase/functions/{function-name}/index.ts`
2. Modify `generateXxxEmail()` functions
3. Redeploy: `supabase functions deploy {function-name}`

---

## Environment Variables

Required secrets in Supabase:

| Secret Name | Value | Example |
|------------|-------|---------|
| `RESEND_API_KEY` | Resend API key | `re_xxxxxxxxxxxxx` |

Optional (hardcoded, can be moved to config):

| Variable | Value |
|----------|-------|
| `ADMIN_EMAIL` | `daniel.roca.s@gmail.com` |
| `SENDER_EMAIL` | `no-reply@adescruz.com` |

To make admin email configurable, read from `site_config` table:

```sql
SELECT value->>'admin_email' FROM site_config WHERE key = 'email_settings';
```

---

## Troubleshooting

### Webhook not triggering
- Check **Database → Webhooks → Recent Invocations** for errors
- Verify function is deployed: `supabase functions list`
- Check RLS policies allow INSERT on table
- Ensure webhook is toggled ON

### Email not sending
- Check Resend dashboard for failed deliveries
- Verify `RESEND_API_KEY` secret is set correctly
- Check function logs: `supabase functions download {function-name}`
- Look for error details in webhook invocations

### File upload fails
- Ensure storage bucket exists and is not private
- Check bucket policies allow anon uploads
- Verify file size < 50MB
- Check file MIME type is allowed

### CDN conflict with supabase
- Use `_inscClient` instead of `supabase` variable
- Wrap Supabase initialization in a separate `<script>` tag
- Avoid `const supabase = ...` in inline scripts

---

## Migration Path

When moving to production:

1. Populate admin email from `site_config` table
2. Add email verification flow (optional)
3. Implement re-try logic for failed emails
4. Add email templates to database (versioning)
5. Set up email analytics via Resend API
6. Create dashboard to view sent emails history

---

## References

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Resend Email API](https://resend.com/docs/send-emails)
- [ADESCRUZ Project](https://adescruz.com)

---

**Last Updated**: April 2026  
**Maintainer**: Daniel Roca  
**Status**: Ready for deployment
