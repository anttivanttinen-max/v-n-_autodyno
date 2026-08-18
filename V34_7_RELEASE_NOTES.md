# VäNä MotorLab v34.7 BETA — release handoff

Updated: 2026-08-18
Build: `2026-08-18b-splash-run-analysis`

This release consolidates the latest MotoLab conversation decisions while preserving the approved v34 phone UI and the newer splash/login startup work.

## Included fixes

- Bike/profile selection immediately updates and persists the active bike.
- Analysis has explicit **Run A / Run B** selectors for two different runs.
- A/B analysis compares measured power/torque and recorded tuning/setup differences.
- Run tuning/setup metadata can be completed or corrected after the run.
- Post-run editing never rewrites `run.data`, RAW/source-specific samples or learning data; edits are marked with post-run metadata origin/timestamp.
- Comparison warns about different bike profiles, gears, quality or setup signatures and does not claim tuning causation when runs are not sufficiently comparable.
- The approved splash image and login/guest handoff from the newest v34 rebuild are retained.
- Obsolete one-off patch workflows and old v31 zip/patch artifacts are removed from the active release tree.

## Fallback / repository cleanup

The stable v32.9.1 FIELD fallback is isolated in `anttivanttinen-max/ty-`. Its active `main` contains only the fallback launcher and README. The old v34 tester collection is no longer active there, but remains recoverable from backup history.

The main MotoLab repository no longer needs an internal duplicate `ty/` test copy. Technical documentation, RAW logic, project memory and regression validation remain intact.

## Measurement invariants

GPS MASTER authority, source-vs-derived RAW separation, explicit MIC OFF authority, serialized MIC control and camera-RPM-disabled policy remain unchanged. Analysis/metadata/UI modules do not receive measurement authority.

## Identity / origin

The frontend uses the Railway production endpoint. Server CORS defaults to `https://anttivanttinen-max.github.io`; user/admin preflight supports GET/POST/PUT and `X-MotoLab-Beta-Token`. The previous CDN-origin test problem is avoided by running production and fallback shells on GitHub Pages origin.

## Validation gate

Static validation, identity/server tests, measurement invariant tests and Chromium + Service Worker smoke must pass before `main` promotion. Browser smoke now verifies splash/login handoff, A/B comparison, post-run metadata persistence without measurement-data mutation, and actual bike-profile selection.

Real iPhone GPS/MIC/IMU routing still requires a physical-device check; browser automation cannot prove hardware routing.
