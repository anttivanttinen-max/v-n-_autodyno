# VÄNÄ MotoLab — conversation archive and durable project memory

Updated: 2026-08-18

## Purpose and archiving rule
This file is the durable GitHub memory for MotoLab development conversations. Important decisions, test results, constraints, implementation notes, unfinished work, data-analysis findings and cross-thread handoff notes must be retained here so they are not lost when a chat ends.

- Treat GitHub as the source of truth for durable MotoLab project memory.
- Before implementation, read latest `main`, `MOTOLAB_SYNC_STATUS.md`, this archive and relevant technical notes.
- After implementation, retain important decisions, tests, regressions, builds and remaining work.
- Raw measurement data belongs in private `Motolab-data`; implementation/project memory belongs in `v-n-_autodyno`.
- The recurring memory job is documentation-only: it must not modify application code or create no-op commits.

## Current core constraints
- GPS MASTER remains authoritative during GPS + microphone learning. Microphone data must not alter displayed RPM, run acceptance or gear learning while GPS MASTER is selected.
- Preserve raw/source-specific measurements separately from derived/fused values so old data can be reprocessed later.
- Camera RPM remains disabled unless explicitly reopened.
- Microphone RPM development must retain candidate/harmonic information, continuity information and reference comparisons, not only final RPM.
- Measurement continuity and logging reliability take priority over UI smoothness.
- Always inspect current `main` HEAD before editing; parallel MotoLab work must not create competing “latest” states.

## Important RAW / microphone findings
- v32.4 / build `2026-08-16h` is the earlier RAW baseline for GPS-master and BT/contact microphone comparisons.
- A prior RAW set contained 70 chunks and 14,709 samples.
- GPS-master structure behaved correctly: `rpmControlAuthority = gps`; microphone stayed out of displayed RPM, acceptance and gear-learning authority.
- BT/contact microphone contains real engine-RPM information but candidate/harmonic selection was not yet stable enough to trust alone.
- Useful examples: GPS 5191 rpm vs mic 5512 rpm (~6.2% error), GPS 4261 rpm vs mic 3807 rpm (~10.6%, lower confidence).
- Harmonic jumping motivated retaining multiple candidate alternatives and continuity tracking.
- Preferred contact mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong contact reference: ~6600 rpm truth, 6591 rpm audio average, ~92.2% confidence, f0 ~109–112 Hz, harmonics ~220/330/440/550/660 Hz.

## iOS microphone recovery finding and fixes
- Session `learn-1786918521880-f44c5b485d4888` showed repeatable microphone recovery failure while GPS/IMU stayed active: wanted `gps=true, imu=true, mic=true`, but repeated checks reported mic false and `track_not_live`.
- GPS MASTER safety remained correct in those RAW rows: mic did not influence displayed RPM, run acceptance or gear learning.
- v32.6 added fresh-stream recovery via `stopAudio()`/`startAudio()`, bounded ~0.5 s → 1 s → 2 s → 5 s retry, telemetry and a manual user-gesture recovery action.
- Field report after v32.6 showed an OFF/ON reconnect storm. Root cause was destructive use of `MOTOLAB_AUDIO_LAST?.t` as a stale-frame trigger without a reliable producer-backed timestamp.
- v32.8 / build `2026-08-17c-mic-stability`, `sensor-persistence-v5`, removed `audio_frames_stale` as a destructive reconnect trigger. A live enabled track on an active stream is authoritative; destructive recovery remains only for genuinely non-live/ended tracks.
- Real-device validation remains required: prove both no false OFF/ON storm and recovery of a genuinely ended track.

## Persistent diagnostics — v32.7
- MotoLab has an always-on observational diagnostics design (`diagnostics.js` / `motolab-diagnostics-v1`).
- It captures window errors, unhandled rejections, console errors/warnings, failed/non-OK fetches, network/visibility/page/media-device/SW lifecycle state and mirrors central learning events.
- Records include release/build, diagnostic session and sensor snapshots. A 500-event local ring, heartbeat and session marker survive restart/crash.
- iOS `pagehide` is not proof of clean shutdown. An unfinished previous session can emit `previous_session_unclean` on next boot.
- Queue diagnostics retain safe count/status/error metadata without secrets or arbitrary payloads.
- Pending diagnostics can replay into RAW as `diagnostic_replay` once the normal learning path is available.
- Diagnostics must never gain authority over GPS MASTER, RPM, run acceptance, gear learning, candidate choice, dyno calculations or sensor recovery.

## LIVE technical inspection — v32.9 base
- Product decision: deep technical operating state belongs on a dedicated **LIVE** bottom-navigation page, not crowded into normal measurement/home or Settings.
- Normal navigation is effectively MITTAUS / VEDOT / LIVE / ANALYYSI / ASETUKSET; developer AUTOTUNE remains developer-only.
- `live_status.js` / `motolab-live-status-v1` adds observational GPS / MIC / IMU / RAW / SYNC traffic-light status and expandable cards for sensor, gear, dyno/run, queues, diagnostics/events and system state.
- `live_status_guard.js` keeps LIVE outside legacy self-test screen counts and handles leaving LIVE through normal navigation.
- LIVE refreshes only while active (~750 ms) and must not control measurement or recovery logic.

## Adaptive RPM learning
- `rpm-learning-model.json` uses schema `motolab_rpm_learning_model_v1`; baseline has no learned bands and explicit acceptance limits.
- Adaptive GPS-taught RPM learning and RAW replay were added in commits `58c1feb`, `fd6cfe4`, `fe66331`.
- Learning uses 500 rpm regions and can prefer 0.5x / 1x / 2x harmonic branches when GPS-supervised evidence supports it; continuity/prediction discourages one-frame harmonic jumps.
- Existing RAW history can be replayed through newer logic.
- Auto Gear Learn remains available but GPS MASTER + MIC LEARN must never give microphone shadow RPM gear-learning authority.
- Overnight trainer may publish only validated improving models, with rollback history retained in `Motolab-data`.

## Historical root field line — v32.9.1
- The earlier root published application line was **v32.9.1 FIELD / build `2026-08-17u-field-recovery`**.
- Field-recovery identity did not change measurement logic; Service Worker recovery forced a clean cache and removed old MotoLab/MotorLab caches.
- v32.8 microphone stability and v32.7 diagnostics were preserved under that line.
- Third-gear research included confirmation/guard flow and gear-guard transitions; phone RAW research capture was non-invasive.
- Finland vehicle database v2 and beta-auth RAW sync were already present.
- This line is now historical: `main` was later explicitly promoted to v34.8 BETA.

## v34 development and locked appearance
- Older `release/v34.0-2026-08-17` points to `58d270274b979847fd760f7681818d9e7034b2ec` / build `2026-08-17o-rebuild-ui-i18n`.
- User-approved v34 direction includes rebuilt UI/navigation, user identity/cloud work, language support and agreed v34 systems.
- User decision: the completed visual appearance is **finished and locked as the approved visual baseline**. Functional work should preserve it unless UI design is explicitly reopened.
- Install/deploy/merge actions require explicit approval; this memory job itself never performs application promotion or deployment.

## v34.6 DEV browser/Service Worker validation
- Validated rebuild point `f203b3e2fb95afbbd0a04ff27319b5f40d7f8dcb` used identity **v34.6 DEV / build `2026-08-17w-v34-rebuild-swfix`**.
- Chromium + real Service Worker smoke testing found a reload-only bug: SW HTML injection regex rewrote inline `navigator.serviceWorker.register(...)` and truncated JS at an inner `encodeURIComponent(build)` parenthesis, preventing navigation handlers from initializing after reload.
- Fix `f203b3e`: stop regex-rewriting inline JS/register calls and bump build/cache identity.
- GitHub Actions run `32044453957` passed app/server syntax, static validation x3, identity/server integration x3, measurement invariant markers and Browser + Service Worker smoke x2.
- Browser/SW validation does not replace real iPhone GPS/microphone validation.

## 2026-08-17 test publication and auth-origin regression
- `main` gained commit `6493bd0384e3e9ef2a9cf0bb1571f6321d79edf9`, publishing a v34 test copy under `ty/`; it did not promote v34 to root at that time.
- `ty/version.js` identified v34.6 DEV / `2026-08-17w-v34-rebuild-swfix`.
- Real test report: login did not work.
- `user_identity.js` targeted Railway production while backend CORS allowed GitHub Pages origin. A different/CDN test origin could therefore block auth before Railway activation/session logic.
- Treat this as a test-host/origin integration regression, not proof that registry/token logic itself was broken.
- Required recovery was to run under the allowed GitHub Pages origin or deliberately change backend CORS, then validate owner/session/activation end-to-end against Railway.
- A separate phone UI report identified KÄYTTÄJÄ submenu overlap with notification/status area.

## v34 submenu/notification overlap fix
- `cd244ecad4902229d0c4d17a3460e3ab2e1e7d5e` changed `beta_menu.js` to `motolab-beta-menu-v4`, added safe-area-aware top clearance, bounded menu height with `100dvh`, and kept toast/status layering above the menu without redesigning the approved UI.
- `ae6f10036be8152f14ddef1b5afe1c8d1c2229d0` extended 390×844 browser smoke and fails if submenu clearance is violated (`menuBox.y < 88`).
- This converted the overlap report into an explicit regression assertion; actual-phone viewport validation remained desirable.

## 2026-08-18 repository cleanup and v34.7 BETA handoff
- Cleanup removed obsolete duplicate `ty/` tester copy, obsolete one-off patch workflows and old v31 patch/zip artifacts. These were repository-maintenance changes, not a measurement build.
- `dev/v34-rebuild` advanced to **v34.7 BETA / build `2026-08-18b-splash-run-analysis`**.
- v34.7 fixed bike/profile selection so the selected bike immediately updates and persists as active profile.
- Analysis added explicit **Run A / Run B** selectors for comparing two stored runs, including measured power/torque and recorded tuning/setup differences.
- Run tuning/setup metadata may be completed or corrected after a run. Post-run edits must never rewrite `run.data`, RAW/source-specific samples or learning data; edited metadata is marked with post-run origin/timestamp information.
- A/B comparison warns when bike profile, gear, quality or setup signatures make runs insufficiently comparable and must not claim tuning causation from weak/non-comparable pairs.
- v34.7 browser coverage added splash/login handoff, real profile selection, A/B analysis, post-run metadata persistence and a full UI walk.
- No new RAW measurement result was established by these UI/analysis changes.

## v34.8 BETA finalization and promotion — 2026-08-18
- v34.8 final identity is **v34.8 BETA / build `2026-08-18c-final-ui-gear-auth`**.
- Approved splash is part of startup on both first uncontrolled load and Service Worker-controlled reloads. The splash uses local `assets/motorlab_splash_approved.webp`, a minimum display time, centered safe login card and guest fallback.
- First uncontrolled load can bootstrap `user_identity.js` before Service Worker control, allowing owner/session lookup to begin behind the splash instead of waiting for the first SW reload.
- Owner/admin device-session recovery remains wired through `owner_device_session_server.js` and loaded by beta auth.
- User menu remains the home for Feedback & Messages, community, shared runs, Tester Merit, LIVE and invites; legacy floating feedback/admin-feedback buttons are suppressed.
- v34.8 includes the centered safe-area gear-suspicion confirmation flow, associated gear metadata handling and the phone candidate bridge covered by the final browser regressions.
- Final validated commit before promotion: `21c396cbb0a55bc33ea65f85db2c9b53bf4fced1`.
- GitHub Actions run `32111288808` completed successfully: application JS syntax, server/validation-script syntax, static rebuild validation x3, identity/server integration x3, measurement invariant markers, Browser + Service Worker smoke x2 and Full user UI walk all passed.
- Browser regression coverage includes first-load splash, splash/login safe area, Run A/B comparison, post-run metadata persistence, gear metadata editing without measurement-data mutation, centered gear confirmation colors/confirmation, phone candidate bridge, user-menu feedback placement, profile selection, LIVE navigation and main-menu runtime behavior.
- Commit `a37013ef85b4b089f7544a7a8753d8ca2d8670d9` explicitly **promoted v34.8 BETA to root `main` while preserving project-memory files**.
- Root `version.js` initially identified v34.8 BETA / `2026-08-18c-final-ui-gear-auth`; later startup/cache-reset maintenance advanced the build identity without changing the v34.8 release label.
- This promotion does not by itself prove physical iPhone GPS/MIC/IMU routing; hardware validation remains separate.

## VäNä owner/admin recovery after v34.8 promotion
- After the v34.8 promotion, `main` added a **one-time VäNä owner bootstrap** for admin recovery.
- Commit `167341692750b597ef99f691348aa42016303cc4` added `raw_sync_server/owner_bootstrap_server.js` with a hash-gated one-time activation path. A successful claim creates/restores nickname `VäNä`, sets `status=active` and `role=admin`, binds the claiming device, records owner-claim metadata, marks the bootstrap consumed and issues a signed one-year device token.
- Original bootstrap safety: initial bootstrap refuses after consumption, refuses when an admin already exists, requires configured `BETA_TOKEN_SECRET`, requires a deviceId, and ordinary nickname `VäNä` alone does not grant admin rights.
- Commit `9af0fcd900ca354c58e8d75eb3016b6165220a1e` explicitly loads the owner bootstrap through `beta_auth_server.js` while preserving the existing owner-device-session layer.
- Commit `a9551311c2b658c1a162cd7ab5a8ff1679fffc92` added `/api/users/v1/owner-bootstrap-status` for operational recovery checks.
- Commit `fc1ae50fd0c6eeca05f6df8016fe89a92fb0aded` changed the bootstrap hash to the current short one-time VäNä owner bootstrap code. **The plaintext recovery code must not be archived here or exposed in project memory.**
- Commit `df6e07477ccaf3e2a28c2c9deb82eed627ed660a` adds a separate **single post-bootstrap owner recovery** path for the case where bootstrap is already consumed and an admin exists. It rebinds/adds the claiming device to the existing admin, refreshes VäNä active/admin state, records recovery metadata and issues a new signed one-year device token.
- That recovery is itself one-time: `ownerBootstrapRecoveryConsumedAt`/device metadata is stored and a second recovery attempt returns an already-used error. The status endpoint now also exposes readiness-only `recoveryUsed` state; it does not expose the recovery secret.
- This changes the earlier safety wording: a consumed initial bootstrap no longer blocks the one explicitly allowed recovery attempt, but it still does not create a universal or repeatable admin backdoor.
- Remaining field check: confirm Railway is running the matching server commit/configuration, verify status including `recoveryUsed`, exercise recovery only if genuinely required, and verify the resulting owner device session persists across normal PWA updates. Do not treat repository code alone as proof that Railway deployment/state is correct.

## 2026-08-18 session-token loss regression and fix
- Real phone report after the owner/session work: the app lost the saved login state and ejected the owner/admin user.
- Root cause in `user_identity.js`: when `/api/users/v1/me` returned HTTP 401, `refresh()` immediately removed `motolab_v32_beta_token` from `localStorage` **before** proving that owner-device recovery could succeed. A transient/stale auth failure could therefore destroy the last locally retained session credential and leave the user logged out when recovery also failed.
- Commit `c47de47eb67a00a131e6eea5f829a9879ba62ccb` changes identity module version to `motorlab-user-identity-v10-session-safe` and makes the 401 path non-destructive: it no longer deletes the saved token before recovery.
- The same commit lets owner-device restoration be retried deliberately (`restoreOwnerDevice(true)`) instead of being permanently blocked by an earlier failed one-shot attempt in the same page lifetime.
- Successful owner-device recovery still replaces the local token only after the server has actually returned a new valid token; failed recovery leaves the prior local token intact for diagnostics/retry instead of erasing it.
- This is an auth/session persistence fix only; it did not alter measurement, RPM, RAW, run acceptance, gear learning or dyno logic.
- Required field validation: on the real iPhone/PWA, verify an existing owner/admin session survives normal reload/update, verify a deliberately invalid/401 session can recover on the same bound device, and verify failed recovery does not silently erase the locally retained token or user state.

## v34.8 startup image, invite-prefill and cache-reset maintenance — 2026-08-18
- After the session-safe auth fix, `main` advanced by six startup/PWA commits to `10e8802774475b3871aa66c7b86f9ea2dc4d68fa`.
- A new local start-screen asset is used from `assets/motolab-start-v34.png`; startup presents it sharply with `object-fit: contain` on black and a release badge sourced dynamically from `MOTOLAB_RELEASE`.
- `splash_boot.js` advanced to `motolab-splash-boot-v2`: an `?invite=` link or pending session invite now pre-fills the startup activation code and tells the user that the invite was found, instead of requiring manual re-entry.
- The release remains **v34.8 BETA**, but current `version.js` build identity is **`2026-08-18e-cache-reset`**.
- `32ec02580ad3264da91eaea10f7119ab65f9c199` rebuilt the Service Worker cache generation: new cache namespace, current start image in static cache, network-first/reload handling for JS/JSON/manifest/image assets, deletion of older MotoLab caches during activation, and an SW-active message to clients.
- `10e8802774475b3871aa66c7b86f9ea2dc4d68fa` aligns `version.js` with the `e-cache-reset` build, keeps displayed version/title labels dynamic, registers the Service Worker with `updateViaCache: 'none'`, requests an update, skips a waiting worker, and permits a single session-scoped reload after the matching new SW becomes active.
- These commits target stale-startup/cache/version-label behavior and invite usability; no measurement, RPM, RAW, gear-learning, run-acceptance or dyno algorithm change is present in the six-commit diff.
- Real-phone follow-up: verify that an installed iPhone/PWA actually leaves the older cache, shows the `2026-08-18e-cache-reset` v34.8 shell/start screen, performs at most one automatic refresh for this build, preserves the session-safe owner login, and correctly pre-fills invite activation links.
- No new RAW measurement finding was established by this startup/cache-reset interval.

## v34.8 password authentication — 2026-08-18
- `main` advanced to **v34.8 BETA / build `2026-08-18f-password-auth`**. Current checked HEAD before this archive update was `aa4914a52aecf753339b4cfc3d4742c93e313287`.
- Product decision: each MotoLab user may choose their own password. Existing device/session identity remains in place; password authentication is an additional login/recovery path rather than a replacement for device binding.
- `raw_sync_server/password_auth_server.js` adds authenticated password set/change and nickname + password login endpoints. Passwords are never stored as plaintext: server storage uses a random salt plus Node `scrypt` (`scrypt-v1`) and timing-safe comparison.
- Password length is currently 8–128 characters. A valid existing device session is required to set/change a password.
- Password login requires nickname, password and deviceId. A successful login can bind a previously unseen device to the same user and issues the normal signed device token; blocked users remain refused.
- `password_login.js` adds startup and account UI for password login, activation with chosen password, and password change. Activation still requires the normal invite flow; after activation the chosen password is stored through the authenticated password endpoint.
- `beta_auth_server.js` loads the password-auth server, `version.js` can load the password client before splash handoff, and `sw.js` includes `password_login` in the application module/cache set.
- Security rule: invite/admin/bootstrap/recovery plaintext codes and user passwords must not be copied into project-memory docs. The known owner/admin activation secret is intentionally omitted here even if mentioned in chat.
- This work is authentication/account management only. No measurement, RPM, RAW, run-acceptance, gear-learning or dyno algorithm change was introduced by the password-auth commits.
- Required field validation: confirm Railway actually deploys the matching server module, then test on real devices: initial invite activation + password creation, normal nickname/password login, password change, login on a second/new device, blocked-user refusal, persistence across PWA updates, and coexistence with the existing non-destructive owner/device-session recovery paths.
- No new RAW measurement finding was established by this password-auth interval.

## v34.8 invite-free self-registration — 2026-08-18
- Checked `main` HEAD before this archive update: `6c70afab88bcb7a10231560c89b1634e96bca79e`. Root `version.js` identifies **v34.8 BETA / build `2026-08-18g-self-register`**.
- Product decision changed first-time onboarding: ordinary users no longer need an invite link/code to create an account. They choose a nickname + password, register their current device, and enter `pending` state until the administrator approves them.
- Commit `e5520b01e3700c36853b35af0d9f25902b96e7d9` adds `/api/users/v1/password-register`. New self-registered users are created with `status=pending`, `role=user`, `registrationSource=password_self_registration`, a `scrypt-v1` password record and the registering device bound to the account.
- Registration validates/sanitizes nickname, enforces the existing 8–128 character password rule, requires `deviceId`, refuses duplicate nickname or a device already linked to another user, and adds in-memory rate limiting for registration/login attempts.
- Commits `3bfee05d3ce7276dd29b5f2aa2d8fc28e525a54e`, `32fbf1cd3642abbfad9d1abcb707c7c150eb5bbc` and `09ce814c1512799717b817afe53c90dfce59fe80` replace the normal invite activation UI with **KIRJAUDU / REKISTERÖIDY**, add the self-registration client flow and refresh the build/cache identity.
- Guest mode was removed from the startup flow in `6675c0d11eaf30acf0d0c0e34ac807d3ddbca618`; startup now requires an active account/session to leave the login gate. Owner/admin recovery remains a separate explicit recovery control and is not generalized to ordinary users.
- `6c70afab88bcb7a10231560c89b1634e96bca79e` compacts the startup login panel for smaller phone viewports without changing measurement logic.
- This onboarding/auth interval did **not** change measurement, RPM, RAW, run acceptance, gear learning or dyno algorithms, and established no new RAW measurement finding.
- Required deployment/field validation: confirm Railway is running the matching self-registration backend; verify a new user becomes visible as `pending`, cannot obtain normal active-user behavior before approval, becomes usable after admin approval, can subsequently log in on the registered/new device according to password/device rules, and remains blocked when administratively blocked. Also verify owner recovery and the session-safe 401 behavior still work after the onboarding change.
- UI field check: verify the compact login panel, keyboard/safe-area behavior and absence of the old guest/invite dependency on the actual installed phone/PWA.

## Data pipeline
- MotoLab stores RAW locally first and syncs new chunks to Railway when configured.
- Railway mirrors received RAW into private `anttivanttinen-max/Motolab-data`.
- Multi-phone/device data is separated by persistent device identity/labels.
- GitHub data can be analyzed manually; an overnight trainer checks new RAW/research data.
- Bad/non-improving models must not replace the accepted model; rollback history must be kept.

## Sensor / microphone UI decisions
- Sensor ON/OFF preferences should persist across restarts.
- Microphone choice should be directly reachable from home.
- Known audio inputs should be selectable; unavailable selected devices must not silently fall back to a different microphone and be treated as the same sensor.
- iOS may require a user gesture before opening audio; desired selection/state can persist while activation waits for a tap.
- Settings/maintenance sections should remain compact/collapsible; deep technical state belongs primarily under LIVE.

## Current implementation direction / unfinished validation
- Treat root `main` as **v34.8 BETA / `2026-08-18g-self-register`** unless a newer checked `version.js` says otherwise.
- Preserve the locked approved v34 appearance; fix functional regressions without redesign unless UI design is explicitly reopened.
- Confirm the GitHub Pages → Railway user/owner/password/self-registration auth path end-to-end on the actual deployed origin.
- Validate self-registration → `pending` → admin approval → active login end-to-end and verify duplicate nickname/device and rate-limit behavior does not strand legitimate users.
- Confirm the initial one-time owner bootstrap and the separate one-time post-bootstrap recovery each work only under their intended state conditions; verify the resulting VäNä admin/device session persists across normal updates and never generalize the mechanism into a reusable hidden admin backdoor.
- Validate the `c47de47e…` session-safe 401 path on the actual iPhone/PWA: normal update persistence, same-device owner recovery, and no destructive token removal when recovery fails.
- Validate the `2026-08-18g-self-register` PWA transition on the actual installed iPhone: old cache removal, correct build identity, at most one build-scoped automatic reload, password-login/self-registration module availability and compact login panel behavior.
- Validate password creation/login/change and new-device binding on real devices; ensure password auth coexists with existing device/session recovery and blocked users cannot log in.
- Re-check splash/login handoff, KÄYTTÄJÄ submenu/status-area clearance, centered gear popup, profile selector, Run A/B analysis and key buttons/menus on the actual phone viewport.
- Real-device validate v34.8 GPS/MIC/IMU behavior; browser automation cannot validate physical sensor routing.
- Real-device validate v32.8 microphone stability logic retained under newer lines: no false OFF/ON storm while still recovering a genuinely ended track.
- Validate LIVE telemetry and v32.7 diagnostics persistence/replay without measurement-performance regression.
- Validate adaptive candidate tracking, 500 rpm band learning and Auto Gear Learn interaction without weakening GPS MASTER.
- Reprocess the available historical sweep/test/ZIP RAW datasets through the newest accepted RPM detection/learning plan before treating model validation as complete.
- Preserve all raw/top-candidate/harmonic information for replay and trainer evaluation.
- No new RAW measurement finding was established during the v34.8 promotion/owner-recovery/session-token/startup-cache/password-auth/self-registration interval.

## Deferred work explicitly parked
- Automatic knock / ignition autotune.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator.
- Camera RPM remains disabled.
- Native AirPods motion remains experimental until validated on a real device.

## Project-wide durable-memory instruction
When a MotoLab conversation contains information that would matter after that conversation ends, archive accepted decisions/constraints, measured tests/reference values, algorithm changes and reasons, regressions/fixes, build/version identity, unresolved/deferred work, RAW interpretation, deployment/sync architecture and cross-thread handoff notes. Full verbatim chat transcripts are not automatically available through the GitHub connector; structured project-relevant memory is the durable source of truth.