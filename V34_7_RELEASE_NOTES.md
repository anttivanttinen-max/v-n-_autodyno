# VäNä MotorLab v34.7 BETA — release handoff

Updated: 2026-08-18
Build: `2026-08-18a-run-analysis`

## Conversation decisions consolidated into this release

- The approved v34 dark black/deep-red phone UI remains the visual baseline; functional fixes must not redesign it.
- Bike/profile selection must immediately make the selected bike active and persist the selected profile id.
- Analysis must allow explicit selection of two different runs: **Run A** and **Run B**.
- A/B analysis must compare both measured performance and recorded tuning/setup differences.
- Run tuning/setup values may be completed or corrected after the run.
- Post-run edits are metadata only. Original `run.data`, RAW/source-specific data, learning data and measurement samples are never rewritten by the metadata editor.
- A/B analysis separates measured result from tuning metadata and does not claim a tuning change caused a performance change when runs are poorly comparable.
- The old stable field version is kept separately in `anttivanttinen-max/ty-` for fallback/testing. Active `ty-` main is intentionally minimal and no longer hosts the old v34 tester collection.
- Obsolete one-off patch workflows and old v31 zip/patch artifacts were removed from active release trees. Technical documentation, RAW/measurement logic and regression validation remain.

## v34.7 implementation

`run_analysis_v34.js` adds:

- dedicated Run A / Run B selectors in Analysis;
- overlay power/torque curve comparison;
- B−A peak power and torque deltas;
- approximate overlapping RPM-region comparison;
- side-by-side main/pilot jet, needle, clip, air screw, slide, ignition map/timing, YPVS, fuel, temperature, pressure, AFR, EGT, setup tag and notes;
- comparability warnings for different profile, gear, quality or setup signature;
- post-run tuning metadata editor;
- `metadataEditedAfterRun`, timestamp and origin markers for later edits;
- extra profile-selection event guard and visible active-bike state.

Browser smoke validation was extended to create two synthetic UI-only runs, compare A/B tuning, edit post-run metadata, verify measurement point count remains unchanged, and verify bike/profile selection actually updates the active profile.

## Measurement invariants retained

- GPS MASTER remains authoritative in GPS + microphone learning modes where selected by the measurement strategy.
- Raw/source-specific observations remain separate from fused/derived data.
- Camera RPM remains disabled.
- Explicit user MIC OFF authority and serialized MIC control are retained.
- Diagnostics, user/community/merit/i18n and this A/B analysis layer do not gain authority over dyno/RPM calculations.

## Identity / origin check

The v34 frontend uses the Railway production endpoint directly. Server CORS defaults to `https://anttivanttinen-max.github.io`, including user/admin preflight support for GET/POST/PUT and `X-MotoLab-Beta-Token`. The prior CDN-origin test issue is avoided by publishing the app and fallback shell under GitHub Pages origin.

## Fallback

The previous v32.9.1 FIELD application is available through the separate `anttivanttinen-max/ty-` repository. Pre-cleanup and pre-v34 safety branches are retained in GitHub history for recovery.

## Validation gate

Automated static, identity/server, measurement invariant and Chromium + Service Worker smoke tests must be green before promotion to `main`. Real iPhone GPS/MIC/IMU behavior still requires a physical-device field check; browser automation cannot prove hardware routing.
