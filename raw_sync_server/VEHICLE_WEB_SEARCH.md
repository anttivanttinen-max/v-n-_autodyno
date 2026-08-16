# MotoLab vehicle web research — prepared, NOT enabled

This branch prepares the missing-vehicle research pipeline without running any web search.

## Safety gate

`VEHICLE_WEB_SEARCH_ENABLED=false` must remain set until Antti explicitly approves running the search.

No OpenAI/web request is made while that flag is false. The API returns `SEARCH_DISABLED` instead.

## Flow

1. User presses **HAE** in MotoLab.
2. Local `vehicle_catalog.json` is searched first.
3. If no match is found, MotoLab stores a `vehicle_lookup_missing_request` learning event.
4. RAW sync uploads the technical RAW chunk when configured.
5. Receiver extracts missing vehicle requests into `DATA_DIR/vehicle_research/requests.json` and deduplicates repeated searches.
6. Nothing is researched automatically while the safety gate is OFF.
7. After explicit approval, enable the server flag and run the pending queue endpoint.
8. Each research result is saved under `DATA_DIR/vehicle_research/` with source URLs, conflicts and confidence.

## Server variables

```text
VEHICLE_WEB_SEARCH_ENABLED=false
OPENAI_API_KEY=<server-side secret>
VEHICLE_WEB_SEARCH_MODEL=gpt-5
```

The API key stays on the receiver server and is never sent to the MotoLab browser app.

## Research quality rules

The research engine asks the web-search model to prefer manufacturer/service/manual/homologation sources, use multiple independent sources when possible, preserve conflicts, never invent missing values, and classify candidate/field confidence as:

- `verified` = strong official/manual source or matching credible independent sources
- `probable` = one credible source or several weaker matching sources
- `pending` = weak, conflicting or uncertain

Returned fields include engine dimensions/specs, carburetor, plug, primary/gear/final-drive data, fluids and tyre/wheel information when supported by sources.

## Admin endpoints

- `GET /api/vehicle/v1/search-status` — public status only; does not run research.
- `GET /api/vehicle/v1/requests` — requires `READ_KEY`; shows queued requests.
- `POST /api/vehicle/v1/research` — requires `READ_KEY`; body `{ "query": "Yamaha DT125R 2000" }`.
- `POST /api/vehicle/v1/research-pending` — requires `READ_KEY`; body `{ "limit": 1 }`, max 10 per request.

`research` and `research-pending` refuse to call the provider while `VEHICLE_WEB_SEARCH_ENABLED=false`.

## Activation sequence after explicit approval

1. Confirm Railway has `OPENAI_API_KEY` and `READ_KEY` configured.
2. Change `VEHICLE_WEB_SEARCH_ENABLED=true` in Railway Variables.
3. Deploy receiver.
4. Check `/health` or `/api/vehicle/v1/search-status` reports `enabled: true` and `configured: true`.
5. Run ONE pending query first (`limit: 1`).
6. Review source quality and returned confidence/conflicts.
7. Only then process more pending requests.

Do not automatically write research results into user-edited bike profiles. Research results must first feed the shared catalog/update layer; user overrides remain authoritative.
