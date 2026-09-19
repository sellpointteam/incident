# Incident Tracker — Shareable Safe Copy

This package contains the tracker source code plus a static export of the records visible on the public tracker on 17 September 2026.

## Privacy changes

- The original `.env` and live Supabase connection values are not included.
- The live Supabase project ID is replaced with a placeholder.
- Seed migrations containing administrator email addresses and passwords are omitted.
- Contributor-account attribution and internal planning files are omitted.
- Git history, authentication records, user roles, drafts, visitor fingerprints, audit logs, and backend ownership fields are not included in the data export.
- File timestamps are normalized when the ZIP is built.

Public source citations are retained because they are part of the published incident records.

## Included public data

The `data/` directory contains equivalent JSON and CSV exports:

- `incidents.*` — 750 published incident records.
- `kia_registry.*` — 1,094 published security-force and pro-state irregular KIA records.
- `militant_casualties.*` — 544 published militant casualty records.

The export deliberately excludes database IDs, account identifiers, author fields, internal timestamps, moderation state, private source notes, and unpublished records.

## Run locally

1. Install Node.js and npm.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Create your own Supabase project and fill in the three `VITE_SUPABASE_*` values.
5. Run `npm run dev`.

The included files in `data/` are an offline public-data snapshot. The application still expects a separately configured Supabase backend for its live features.

## Security

Do not add real passwords, service-role keys, API secrets, personal email addresses, or production project identifiers to a distributable archive. Keep server-side secrets in the deployment platform's secret manager.
