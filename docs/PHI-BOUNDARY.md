# PHI Boundary

MeaningBridge is moving to a HIPAA-appropriate architecture in which **our Replit
database and logs contain no Protected Health Information (PHI)**. All clinical data
lives in BAA-covered vendors and is read/written via their APIs at request time.

> Replit does not sign a BAA. Real patient data must never be stored on Replit's
> database or hosting. BAAs with every vendor that touches PHI, a security risk
> assessment, and a healthcare-attorney review are required before any real patient
> uses this system. These are business/legal steps outside the codebase.

## The rule

```
Replit (no PHI)                         BAA-covered vendors (all PHI)
- auth accounts                         - Healthie: patients, providers, charts,
- screen names                            forms, appointments, notes, documents,
- community chat                          insurance/billing (system of record)
- app settings                          - Daily.co: HIPAA video + recording + transcript
- non-clinical AI companion chats       - Stedi: insurance eligibility (270/271)
- foreign keys (healthie_user_id)
```

Our server calls vendor APIs server-side only. Vendor responses (PHI) are rendered in
the UI and **never** cached to our database, written to disk, or logged.

## What our Postgres may hold

Non-PHI only: auth accounts and their `healthie_user_id`, screen names, community chat,
app settings/preferences, and non-clinical companion transcripts. No names, DOB, email
tied to a patient, loss details, diagnoses, notes, insurance data, or documents.

## Entity mapping

| MeaningBridge concept        | Healthie object (GraphQL)              | Replit DB (non-PHI)          |
|------------------------------|----------------------------------------|------------------------------|
| Client/patient               | `User` (patient)                       | auth account ↔ healthie_user_id |
| Licensed professional        | `User` (provider/org member)           | auth account ↔ healthie_user_id |
| Intake/consent forms         | `CustomModuleForm` / `FormAnswerGroup` | —                            |
| Appointment                  | `Appointment`                          | —                            |
| Session note                 | `FormAnswerGroup` (charting note)      | —                            |
| Documents / ROI              | `Document`                             | —                            |
| Insurance policy             | `Policy` / billing objects             | —                            |
| Community chat, screen names | —                                      | Replit DB                    |
| AI companion chats (non-clinical) | —                                 | Replit DB                    |

## Logging policy

- `pino-http` logs only request `id`, method, and a **redacted** URL path; request and
  response **bodies are never logged**. See `artifacts/api-server/src/app.ts`.
- Path identifiers that could be PHI or bearer tokens (consent/withdrawal tokens,
  patient-scoped numeric ids) are redacted in the request serializer.
- Never log Healthie/Daily/Stedi request or response payloads. When adding vendor calls,
  log only non-PHI outcomes (status, vendor request id, latency) — never the PHI itself.

## AI companion separation

The AI companion is non-clinical and must never receive PHI from charts, forms, or
vendor responses. Keep it on the non-PHI side of this boundary. If it ever needs
clinical context, move inference to a BAA-covered host first.

## Migration path (phased — the running app must never break)

The app currently stores PHI **encrypted at rest** in Postgres (`lib/phi`, `*Enc`
columns, `patients`/`providers`/`appointments`/`referrals`/intakes). We transition
without downtime:

1. **Boundary + policy (this doc).** No schema changes yet.
2. **Stand up Healthie alongside.** New signups create a Healthie `User`; store only the
   id. New clinical writes go to Healthie. Feature-flag the Healthie path.
3. **Backfill/migrate** existing encrypted PHI into Healthie (sandbox first, fake data),
   then for real records under signed BAAs.
4. **Cut reads over** to Healthie; retire the encrypted-PHI read paths.
5. **Remove PHI columns/tables** from Postgres once nothing reads them; keep only
   non-PHI shells + `healthie_user_id`. Update `docs/DATA_RETENTION.md` accordingly.

Until step 5 completes, the encrypted-at-rest posture and `docs/DATA_RETENTION.md`
remain in force for any PHI still resident in our DB.

## Vendors and secrets

| Vendor    | Purpose                         | Secret             | Sandbox first |
|-----------|---------------------------------|--------------------|---------------|
| Healthie  | Headless EHR (system of record) | `HEALTHIE_API_KEY` | Yes           |
| Daily.co  | HIPAA video + recording         | `DAILY_API_KEY`    | Yes (dev)     |
| Stedi     | Insurance eligibility (270/271) | `STEDI_API_KEY`    | Yes (test)    |

Sign BAAs with each before real patient data. Test every phase in sandbox with fake
data only.
