# MotoLab Receiver — Railway setup

This service receives MotoLab RAW and multi-phone research sessions.

## Railway service

Use the GitHub repository `anttivanttinen-max/v-n-_autodyno` and configure the service as:

- Root Directory: `/raw_sync_server`
- Config as Code path: `/raw_sync_server/railway.toml`
- Public Networking: enabled; Generate Domain
- Volume mount path: `/data`

Railway injects `PORT`; `server.js` already listens on it.

## Variables

Set these in the Railway service Variables tab. Never commit the real secret values.

- `INGEST_KEY`: long random secret shared only with MotoLab phones
- `READ_KEY`: separate long random secret for server-side/read access
- `ALLOWED_ORIGIN=https://anttivanttinen-max.github.io`
- `DATA_DIR=/data`
- `MAX_BODY_BYTES=8388608`

## Verification

After deploy, open `https://<railway-domain>/health`. Expected JSON includes:

```json
{"ok":true,"service":"vana-motolab-raw-sync","researchSync":true}
```

## MotoLab phones

On every test phone, open Settings → AUTO RESEARCH SYNC and use:

- Receiver URL: `https://<railway-domain>`
- Ingest key: the same `INGEST_KEY`
- Driver: unique driver label
- Phone: unique phone label
- Auto Research Sync: ON

The phone keeps research data local-first and retries uploads after network loss.

## Read access

Research sessions are available through the protected API:

- `GET /api/research/v1/sessions`
- `GET /api/research/v1/session?deviceId=<id>&sessionId=<id>&timeline=1`

Use header `X-MotoLab-Read-Key: <READ_KEY>`.

RAW chunks remain available through `GET /api/raw/v1/chunks` with the same read header.
