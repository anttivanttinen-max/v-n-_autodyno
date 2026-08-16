# VÄNÄ MotoLab closed beta — build 2026-08-16o

## Implemented
- `beta_release.js` is loaded by the PWA Service Worker.
- Normal beta user mode hides advanced RAW/research/developer panels.
- Developer mode toggles by tapping the visible version indicator 7 times quickly (within ~2.6 seconds).
- Continuous learning data is forced ON and cannot remain disabled in beta mode.
- First-run onboarding explains GPS, microphone, continuous learning/RAW collection and automatic sync behavior before requesting OS permissions.
- After consent MotoLab attempts to enable GPS and the phone microphone automatically. The phone microphone remains learning/shadow data; GPS remains the RPM control authority.
- Audible speech is not part of normal learning RAW; technical microphone features are the beta learning target. Separate explicit research-audio tools remain developer-only.
- If RAW sync is configured, beta consent keeps automatic RAW sync enabled.
- New closed-beta installs support personal invitation activation through `betaServer` + `invite` invitation links. Existing installs are migration-bypassed so the current development device is not locked out.
- Invitation activation is device-bound; receiver default is max 2 devices per invite.
- `raw_sync_server/beta_auth_server.js` adds server-side invite validation and signed 90-day beta tokens without exposing the real ingest secret to beta clients.
- Beta token auth can be used for RAW/research uploads; the auth layer internally injects the server ingest credential after token validation.
- Railway must define `BETA_INVITE_CODES`, `BETA_TOKEN_SECRET` and optionally `BETA_MAX_DEVICES` before new invitation links work.
- Vehicle search has an explicit HAE button and clear HAETAAN / LÖYTYI / EI LÖYTYNYT states.
- Missing vehicle queries are stored as `vehicle_lookup_missing_request` learning events with state `TARKISTUS_KESKEN`; when RAW sync is active they reach the development receiver automatically.
- Vehicle results display a verification-state badge when catalog metadata provides one; otherwise they are marked as database data.

## Preserved invariants
- GPS MASTER remains RPM authority in GPS+MIC learning.
- Microphone learning must not affect displayed RPM, run acceptance or gear learning.
- Working single-pull dyno curve logic is untouched.
- Temporary GPS power calibration remains 1.07.
- RAW remains local-first and automatic cloud upload does not delete local data.
- DT Athena 170 remains the startup/reference bike.

## Still requires service configuration / later work
- Railway beta invitation environment variables must be configured before distributing invite links.
- Fully automatic internet research of a missing vehicle model is not yet connected to a search/research provider. The request now reliably reaches the learning/RAW pipeline for later processing, and confidence states are ready for returned catalog data.
