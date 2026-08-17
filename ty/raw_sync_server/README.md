# VÄNÄ MotoLab RAW Sync Receiver

Small zero-dependency Node receiver for MotoLab RAW chunks.

## Required environment variables

- `INGEST_KEY` — long random secret used only by the phone when uploading RAW chunks.
- `READ_KEY` — separate long random secret used by the analyst/read API.
- `ALLOWED_ORIGIN` — default `https://anttivanttinen-max.github.io`.
- `DATA_DIR` — persistent storage path. For Railway Volume use the mounted volume path, e.g. `/data/motolab-raw`.
- `PORT` — normally supplied by the host automatically.

Never commit either key to GitHub.

## Railway

Create a separate service from this repository and set its Root Directory to `raw_sync_server`. Add a persistent Volume and point `DATA_DIR` to its mount path. Set `INGEST_KEY`, `READ_KEY`, and `ALLOWED_ORIGIN` as service variables. Generate a public HTTPS domain for the service.

MotoLab's receiver field is then:

`https://YOUR-DOMAIN/api/raw/v1/chunk`

## API

`GET /health` — health check, no secret required.

`POST /api/raw/v1/chunk` — receives one `motolab_raw_sync_envelope_v1`. Requires header `X-MotoLab-Ingest-Key`.

`GET /api/raw/v1/chunks?after=<ISO>&limit=25` — returns RAW envelopes in upload order. Requires `X-MotoLab-Read-Key`; for tools that cannot set custom headers, `readKey=<READ_KEY>` is also accepted. Query-string keys can appear in access logs, so header authentication is preferred whenever possible.

Uploads are idempotent by device/session/chunk id: a retry of an already stored chunk returns success and does not create a duplicate.

## Privacy

RAW data can contain precise measurement metadata and may later include location-related fields. Keep the receiver private, use strong independent ingest/read keys, and do not store RAW files in the public application repository.
