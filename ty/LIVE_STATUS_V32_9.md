# VÄNÄ MotoLab v32.9 — LIVE telemetry / technical status screen

Updated: 2026-08-17

## Release
- Version: **v32.9**
- Build: **2026-08-17d-live-status**
- New modules: `live_status.js` / `motolab-live-status-v1` and `live_status_guard.js` / `motolab-live-status-guard-v1`.

## Product decision
MotoLab must keep the normal measurement/home view focused on riding and dyno work. Deep technical state is moved behind a dedicated bottom-navigation **LIVE** page so sensor, learning, sync and diagnostics state can be inspected without cluttering the primary measurement UI.

## Bottom navigation
Visible normal-user order becomes effectively:
- MITTAUS
- VEDOT
- LIVE
- ANALYYSI
- ASETUKSET

Developer-only AUTOTUNE remains controlled by the existing developer mode.

## LIVE page sections
The page provides a compact traffic-light summary for **GPS / MIC / IMU / RAW / SYNC** and expandable technical cards for:
- GPS
- MIC / RPM
- IMU
- GEAR
- DYNO / RUN
- RAW / SYNC / EVENT QUEUES
- DIAGNOSTICS / EVENT LOG
- SYSTEM

## Data shown
The screen is observational and reads existing state only. Depending on availability it exposes current speed and GPS RPM, microphone intent/track state/device, audio/raw RPM, confidence, f0/candidate gap/runner-up, IMU acceleration, detected gear and confidence, fusion/slip state, live dyno values, ARM/manual states, RAW learning counters, sync queue counts/errors, persistent diagnostic event counts/recent events, build/version, visibility/network/secure-context and Service Worker state.

## Queue / diagnostics integration
- LIVE reads queue summaries from the existing persistent diagnostics API when available.
- RAW sync queue status is also read directly from the existing local persistent queue state.
- The newest diagnostic events can be inspected from the LIVE page.
- LIVE itself emits only a lightweight `live_status_loaded` diagnostic event and does not create a new control queue.

## Safety / measurement isolation
LIVE must never influence:
- GPS MASTER authority,
- displayed RPM,
- run acceptance,
- gear learning,
- smart RPM candidate selection,
- microphone recovery decisions,
- adaptive RPM learning,
- dyno power/torque calculations,
- RAW persistence/sync decisions.

The module refreshes the visible LIVE screen only and remains passive when another screen is active.

## Core-screen compatibility
`live_status_guard.js` keeps the dynamically injected LIVE screen outside the legacy `.screen` count used by the existing internal self-test. Existing normal navigation removes LIVE active state when leaving the page, while the LIVE button can still invoke the existing screen-switch function. This avoids changing the large legacy `index.html` measurement implementation solely to add the new inspection page.

## Validation
Real-device validation should confirm:
1. LIVE appears in the bottom navigation and opens/closes correctly.
2. Existing MITTAUS / VEDOT / ANALYYSI / ASETUKSET navigation remains normal.
3. Existing internal self-test does not fail because of the extra inspection page.
4. GPS/MIC/IMU indicators follow real sensor state.
5. RAW/sync queue counts and diagnostic event list update without affecting measurement performance.
6. v32.8 microphone stability behavior remains unchanged.
