# VÄNÄ MotoLab v34.8 BETA finalization

Build: `2026-08-18c-final-ui-gear-auth`
Branch: `dev/v34-rebuild`
Validated commit: `21c396cbb0a55bc33ea65f85db2c9b53bf4fced1`
Validation run: `32111288808`

## Completed

- Approved splash is now part of the app startup path and is shown on the first uncontrolled load as well as Service Worker controlled reloads.
- Splash uses local `assets/motorlab_splash_approved.webp`, has a minimum display time, safe centered login card and guest fallback.
- On the first uncontrolled load, the splash bootstrap can load `user_identity.js` before the Service Worker takes control, so owner/session lookup can begin behind the splash instead of waiting for the first SW reload.
- Existing owner/admin device session recovery remains wired through `owner_device_session_server.js`; `beta_auth_server.js` explicitly loads that module.
- User menu remains the home for Feedback & Messages, community, shared runs, Tester Merit, LIVE and invites.
- Legacy floating feedback/admin-feedback buttons are suppressed by `v34_runtime_fixes.js`.
- Gear-change suspicion now opens a centered safe-area modal. Other choices are gray, suspected gear is red and user-confirmed gear turns green before closing.
- Confirmed gear is exposed as `MOTOLAB_CONFIRMED_GEAR` and is applied to saved research/new run metadata instead of allowing the legacy manual-gear default to overwrite a confirmed research gear.
- Post-run metadata editing now also supports gear correction. It marks gear edits as post-run metadata and does not rewrite `run.data`, RAW/source samples or learning data.
- Run A / Run B comparison, tuning metadata comparison and comparability warnings from v34.7 are retained.
- Bike/profile selection fix from v34.7 is retained.
- Phone Smart RPM candidate data is bridged into the existing `motolab-audio-candidates` research stream so third-gear research candidate-frame counting receives the current phone RPM candidate set.
- GPS MASTER authority, camera-RPM disabled state, explicit-user-gesture microphone startup and LIVE observational-only rules remain unchanged.
- Service Worker still does not regex-rewrite inline JavaScript.

## Validation

GitHub Actions run `32111288808` completed successfully. Passed steps:

- application JavaScript syntax
- server and validation-script syntax
- static rebuild validation x3
- identity/server integration x3
- measurement invariant markers
- Browser + Service Worker smoke x2
- Full user UI walk

Browser regression coverage includes first-load splash, splash/login safe area, Run A/B comparison, post-run metadata persistence, gear metadata editing without measurement-data mutation, centered gear confirmation colors/confirmation, phone candidate bridge, user-menu placement of feedback, profile selection, LIVE navigation and main menu runtime behavior.

## Safety / release state

- `main` is intentionally unchanged and remains `v32.9.1 FIELD / 2026-08-17u-field-recovery`.
- Backup branch `backup/v34-7-before-finalization` was created before the v34.8 finalization changes.
- Browser automation cannot prove real iPhone GPS/MIC/IMU routing. Physical iPhone validation is still required before promotion to `main`.
- Railway production must contain the owner-device-session backend module before owner/admin recovery can be considered production-validated.
