# VÄNÄ MotoLab — shared development sync status

Updated: 2026-08-18

## Current application line
- Active root line on `main`: **v34.8 BETA / build `2026-08-18h-auth-session-persist`**.
- `version.js` is the release-identity source; Service Worker/app shell/cache identity must stay aligned with it.
- v34.8 was explicitly promoted to root `main` by commit `a37013ef85b4b089f7544a7a8753d8ca2d8670d9` after the final validation gate; later startup/cache/auth/onboarding/session-persistence maintenance advanced the build identity while retaining the v34.8 BETA release label.
- Current application/server handoff before this documentation update: `c72a2c76213d59216889b5b5f330b31c1d1cc7ba`.
- The earlier **v32.9.1 FIELD / `2026-08-17u-field-recovery`** line is now historical, not the active root release.
- The locked approved v34 visual appearance remains the baseline. Functional fixes should preserve it unless UI design is explicitly reopened.
- This recurring memory job is documentation-only and must not promote, deploy or alter application/server code.

## v34.8 final validation and promotion
- Original finalized v34.8 identity at promotion: **v34.8 BETA / `2026-08-18c-final-ui-gear-auth`**.
- Final validated commit before promotion: `21c396cbb0a55bc33ea65f85db2c9b53bf4fced1`.
- GitHub Actions run `32111288808` completed successfully.
- Passed: application JavaScript syntax, server/validation-script syntax, static rebuild validation x3, identity/server integration x3, measurement invariant markers, Browser + Service Worker smoke x2, and Full user UI walk.
- Browser regression coverage includes first-load splash, splash/login safe area, Run A/B comparison, post-run metadata persistence, gear metadata editing without measurement-data mutation, centered gear confirmation colors/confirmation, phone candidate bridge, user-menu feedback placement, profile selection, LIVE navigation and main-menu runtime behavior.
- Approved splash is present on first uncontrolled load and SW-controlled reloads. First uncontrolled load can bootstrap `user_identity.js` before SW control so owner/session lookup can start behind the splash.
- User menu remains the home for Feedback & Messages, community, shared runs, Tester Merit, LIVE and invites; legacy floating feedback/admin-feedback controls are suppressed.
- Browser validation does **not** prove physical iPhone GPS/MIC/IMU routing; that remains a separate field gate.

## v34.8 startup/cache-reset handoff
- The earlier startup/cache-reset root identity was **v34.8 BETA / `2026-08-18e-cache-reset`**.
- Startup uses local `assets/motolab-start-v34.png`, displayed sharply on black with a release badge derived from `MOTOLAB_RELEASE` rather than stale hard-coded UI text.
- `splash_boot.js` is `motolab-splash-boot-v2`: startup activation pre-fills a pending `?invite=` code from the link/session and tells the user when that invite was detected.
- `32ec02580ad3264da91eaea10f7119ab65f9c199` rebuilt the Service Worker cache generation: a new cache namespace, current start image in the static set, network-first/reload treatment for JS/JSON/manifest/images, deletion of older MotoLab caches on activation, and an `MOTOLAB_SW_ACTIVE` message to clients.
- `10e8802774475b3871aa66c7b86f9ea2dc4d68fa` aligned the release build with `e-cache-reset`, reapplied dynamic release labels/title, registered SW with `updateViaCache: 'none'`, requested update/skip-waiting, and allowed one session-scoped reload after the matching worker activates.
- The six commits after the session-safe auth archive touched only startup/PWA assets and logic (`assets/motolab-start-v34.png`, `splash_boot.js`, `sw.js`, `version.js`); no measurement/RPM/RAW/gear-learning/run-acceptance/dyno algorithm file changed in that interval.
- The `e-cache-reset` field gate remains relevant under newer builds: installed iPhone/PWA must leave stale caches, show current shell/start image, reload at most once per build and preserve login state.

## v34.8 password authentication handoff
- Earlier password-auth identity was **v34.8 BETA / build `2026-08-18f-password-auth`** at application HEAD `aa4914a52aecf753339b4cfc3d4742c93e313287`.
- Product decision: every MotoLab user may choose an individual password. Device/session identity remains active in parallel; password auth is an additional login/recovery path, not a replacement for device binding.
- `raw_sync_server/password_auth_server.js` adds password set/change and nickname + password login. Password storage uses random salt + Node `scrypt` (`scrypt-v1`), never plaintext, with timing-safe verification.
- Password length is currently 8–128 characters. Setting/changing a password requires a valid linked device session.
- Successful nickname/password login issues the normal signed device token and may attach a new deviceId to the same user. Blocked users remain denied.
- Security rule: user passwords and plaintext invite/admin/bootstrap/recovery codes must never be stored in public project-memory files.

## v34.8 self-registration handoff
- Earlier self-registration root identity was **v34.8 BETA / build `2026-08-18g-self-register`**; checked handoff was `6c70afab88bcb7a10231560c89b1634e96bca79e`.
- Ordinary first-time users no longer require an invite code. They register with nickname + password + current device and are created in `pending` state until administrator approval.
- `e5520b01e3700c36853b35af0d9f25902b96e7d9` adds `/api/users/v1/password-register`. Self-registered accounts use `role=user`, `registrationSource=password_self_registration`, `scrypt-v1` password storage and a bound registering device.
- Registration sanitizes nickname, requires 2+ characters, enforces 8–128 character password length, requires `deviceId`, refuses duplicate nickname or a device already linked to another account, and rate-limits registration/login attempts.
- `3bfee05d3ce7276dd29b5f2aa2d8fc28e525a54e` changes the normal startup/account flow to **KIRJAUDU / REKISTERÖIDY** and hides the old invite activation controls for ordinary onboarding.
- `32fbf1cd3642abbfad9d1abcb707c7c150eb5bbc` and `09ce814c1512799717b817afe53c90dfce59fe80` advance build/cache identity for the onboarding change.
- `6675c0d11eaf30acf0d0c0e34ac807d3ddbca618` removes guest mode from startup. Owner/admin recovery remains an explicit separate recovery path rather than a normal registration privilege.
- `6c70afab88bcb7a10231560c89b1634e96bca79e` compacts the login panel for phone viewports.
- This line is onboarding/auth-only: no measurement, RPM, RAW, run-acceptance, gear-learning or dyno algorithm change and no new RAW measurement finding.

## Persistent Railway user storage / auth-session guard / user RAW handoff
- Field inspection confirmed the Railway service sees `DATA_DIR=/data` on the mounted persistent volume. `/data/users/registry.json` exists there and user state storage is present; the inspected root-level `/data/registry.json` did not exist.
- The inspected registry contained the active VäNä owner/admin account bound to the current iPhone. A searched earlier ordinary user (`Daniel`) was absent, so missing historical accounts must not be invented manually; they must be recreated or recovered only from genuine retained data.
- `36126a412c7013f17df41044c3c95d9bb6362242` adds `raw_sync_server/storage_guard_server.js`, which creates `/data/users` and can atomically migrate a valid legacy `/data/registry.json` into `/data/users/registry.json` only when the new registry is absent.
- `d50ffba641a0902861b094ecbfdcd0db350ad047` loads that storage guard before the authentication stack.
- `096eaf37c83ed9cc4d47cb6df21030740510db10` adds `auth_session_guard.js`: failed user refresh is retried after approximately 300 ms and 900 ms, and overlapping refresh recovery attempts share one promise. This supplements the earlier non-destructive 401 handling instead of deleting the local token.
- `7cf018e4e3f80b38a48211fd983f6d6bbf7184ab` and `98d9e7c9e554fc8223573828dbfaae8e1fde2022` advance release/cache loading to **v34.8 BETA / build `2026-08-18h-auth-session-persist`** and place the session guard before password login.
- `c72a2c76213d59216889b5b5f330b31c1d1cc7ba` adds `/api/users/v1/raw-chunk`. Only an active signed user/device session may write; chunks are stored atomically under `/data/users/raw/<userId>/` with user/device metadata and the original chunk payload preserved.
- New product requirement: owner/admin should receive an **alert for newly registered users**, especially `pending` accounts waiting for approval. Delivery channel is still open; any implementation must avoid exposing passwords, session tokens or owner recovery secrets.
- This interval changes auth/storage/sync infrastructure only. It does not change GPS MASTER, microphone authority, RPM calculation, run acceptance, gear learning or dyno algorithms and establishes no new RAW measurement finding.

## VäNä owner/admin recovery state
- After v34.8 promotion, `main` added a one-time owner bootstrap for safe VäNä admin recovery.
- `167341692750b597ef99f691348aa42016303cc4`: adds hash-gated `owner_bootstrap_server.js`. Successful claim creates/restores `VäNä`, sets `status=active`, `role=admin`, binds the claiming device, marks the bootstrap consumed and issues a signed one-year device token.
- `9af0fcd900ca354c58e8d75eb3016b6165220a1e`: loads owner bootstrap through `beta_auth_server.js` while retaining owner-device-session recovery.
- `a9551311c2b658c1a162cd7ab5a8ff1679fffc92`: adds `/api/users/v1/owner-bootstrap-status` with readiness-only bootstrap state.
- `fc1ae50fd0c6eeca05f6df8016fe89a92fb0aded`: updates the bootstrap hash to the current short one-time owner code. The plaintext code must not be committed to memory/docs or exposed outside the intended recovery flow.
- `df6e07477ccaf3e2a28c2c9deb82eed627ed660a`: allows one separate post-bootstrap owner recovery when the original bootstrap is already consumed and an admin already exists. Recovery rebinds/adds the requesting device to the existing admin, refreshes VäNä active/admin state and issues a new signed one-year device token.
- The post-bootstrap recovery is itself one-time. It records `ownerBootstrapRecoveryConsumedAt` and the recovery device, and later attempts are refused. `/api/users/v1/owner-bootstrap-status` now also reports readiness-only `recoveryUsed`.
- Bootstrap safety remains state-bound: ordinary nickname `VäNä` never grants admin rights; initial bootstrap still requires the configured secret and a deviceId; the recovery path does not create a repeatable or universal hidden admin backdoor.
- Real phone regression found after this work: `user_identity.js` could erase `motolab_v32_beta_token` immediately on `/api/users/v1/me` HTTP 401 before confirming that owner-device recovery succeeded, leaving the owner logged out if recovery also failed.
- `c47de47eb67a00a131e6eea5f829a9879ba62ccb` fixes that path in `motorlab-user-identity-v10-session-safe`: 401 no longer deletes the saved token before recovery, owner-device restoration can be retried deliberately, and a replacement token is stored only after a successful server recovery response.
- The `c47de47e…` change is auth/session-only; it does not alter measurement, RPM, RAW, run acceptance, gear learning or dyno logic.
- Current operational follow-up: verify Railway owner/session endpoints remain deployed/configured correctly and validate on the actual iPhone/PWA that normal updates preserve the owner session, same-device 401 recovery succeeds when appropriate, and failed recovery does not silently erase the locally retained token/state.
- Do not add or accept a universal hidden admin backdoor.

## v34.7 profile / analysis / post-run metadata work retained in v34.8
- Bike/profile selection is fixed so the chosen bike immediately becomes and remains the active profile.
- Analysis exposes explicit **Run A / Run B** selectors so two stored runs can be selected directly.
- A/B comparison evaluates measured power/torque together with stored tuning/setup differences.
- Run tuning/setup metadata may be completed or corrected after the run.
- Post-run editing is metadata-only: it must never rewrite `run.data`, RAW/source-specific samples or learning data. Edited fields carry post-run origin/timestamp information.
- Comparison warns about different bike profiles, gears, quality or setup signatures and must not claim tuning causation when the pair is not sufficiently comparable.
- The previous-run 100% comparison rule remains useful for development; direct Run A/B comparison is complementary.

## v34 UI/runtime fixes retained
- The KÄYTTÄJÄ submenu/status-area overlap was fixed by `cd244ecad4902229d0c4d17a3460e3ab2e1e7d5e`; menu clearance is safe-area-aware, bounded by `100dvh`, and toast/status layering stays above it.
- `ae6f10036be8152f14ddef1b5afe1c8d1c2229d0` added a 390×844 regression assertion so submenu placement cannot silently regress into the notification/status clearance.
- Earlier SW reload-only runtime breakage was fixed at `f203b3e2fb95afbbd0a04ff27319b5f40d7f8dcb`: inline Service Worker registration JS is no longer regex-rewritten/truncated after controlled reload.
- Earlier different-origin/CDN auth-CORS failure mode must not be reintroduced; production/fallback app shells should use the allowed GitHub Pages → Railway path unless the backend CORS contract is deliberately changed.

## Measurement strategy
- Road-test / learning work uses **GPS MASTER + MIC LEARN** unless a specific explicit test mode says otherwise.
- GPS/speed + selected gear remains the control RPM authority.
- Phone microphone RPM remains shadow/learning data in GPS MASTER and must not alter displayed RPM, run acceptance or normal gear-learning authority.
- GPS reference RPM may come from saved gear calibration or calculated drivetrain data.
- Camera RPM remains disabled.
- Measurement continuity/logging reliability is higher priority than UI smoothness.
- Preserve raw/source-specific measurements independently from derived/fused values so historical data can be replayed through newer algorithms.

## Phone microphone RPM basis
- Standalone Phone RPM Tester v3.6 produced a complete long sweep: **34.642 s / 1040 frames / displayed 1620–9890 rpm**.
- All 1040 frames were captured with chunked IndexedDB storage.
- Practical target accuracy is roughly **±200 rpm**, temporary ±300 rpm tolerable; continuity and x2/÷2 branch rejection matter more than exact single-frame equality.
- No single-frame ≥1000 rpm jumps were found in the displayed v3.6 track.
- Raw/harmonic data repeatedly contains usable RPM information even when the strongest spectral candidate is not the correct branch.
- Preserve complete candidate/harmonic information; do not discard frames only because confidence is low.

## Smart phone RPM sensor
- Active smart-phone module: `phone_rpm_smart.js` / `phone-rpm-smart-v1`.
- Evaluates H1–H6 harmonic structure and simultaneous **0.5x / 1x / 2x RPM hypotheses**.
- Candidate selection uses spectral strength, harmonic count, previous RPM, predicted RPM/velocity, temporal continuity, candidate gap and soft GPS reference when available.
- Large implausible branch jumps require confirmation; tracker may hold/follow prediction instead of accepting a one-frame harmonic jump.
- Rich telemetry is retained: smart/raw/corrected/predicted RPM, chosen ratio, confidence, gap, runner-up, f0, RMS, harmonics, top candidates and GPS assist.

## Adaptive GPS-taught RPM learning
- `rpm-learning-model.json` uses schema `motolab_rpm_learning_model_v1`; checked-in baseline has no learned bands and defines acceptance limits.
- Adaptive GPS-taught learning and local RAW replay were added in `58c1feb`, `fd6cfe4`, `fe66331`.
- Learning uses **500 rpm regions** and may prefer 0.5x / 1x / 2x harmonic branches when GPS-supervised evidence supports them.
- Candidate continuity/prediction is part of selection.
- Existing RAW history can be replayed through newer logic; new road data is not the only source for algorithm evaluation.
- Auto Gear Learn remains present, but GPS MASTER + MIC LEARN must not let microphone shadow RPM gain gear-learning authority.
- Overnight trainer may publish only validated improving models; bad/non-improving models must be rejected and rollback history kept in private `Motolab-data`.
- Historical sweep/test/ZIP datasets must be reprocessed through the newest accepted detection/learning plan before model validation is considered complete.

## Historical RAW / contact reference
- v32.4 / build `2026-08-16h` remains the earlier RAW baseline for BT/contact microphone comparisons.
- One archived RAW set contained 70 chunks and 14,709 samples.
- GPS MASTER behaved correctly with `rpmControlAuthority = gps` and mic outside displayed RPM, acceptance and gear-learning authority.
- Example matches: GPS 5191 vs mic 5512 rpm (~6.2%); GPS 4261 vs mic 3807 rpm (~10.6%, lower confidence).
- Preferred contact reference mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong reference: ~6600 rpm truth, 6591 rpm audio average, ~92.2% confidence, f0 ~109–112 Hz, harmonics ~220/330/440/550/660 Hz.
- Older tests without the extension nut remain a separate calibration set.

## Full-trip 3rd-gear GPS + MIC research
- `trip_research.js` provides the **3. VAIHTEEN GPS + MIC TUTKIMUSAJO** flow.
- Research path uses GPS MASTER and third gear as the reference structure.
- Phone RAW research capture is intentionally non-invasive relative to normal measurement logic.
- Gear guard pauses microphone/raw research when third gear is not active/confirmed and resumes only deliberately; transitions are logged.
- Research uses separate `VanaMotoLabResearch` IndexedDB so normal runs/learning RAW are not disturbed.
- v34.8 includes centered safe-area gear-suspicion confirmation and browser coverage for gear confirmation/metadata without measurement-data mutation.

## Automatic multi-phone research / RAW sync
- Research sync is local-first; phone retains research data and retries later after network loss/app reopen.
- Persistent per-device identity plus driver/phone labels separate simultaneous tests.
- RAW remains local-first and is not deleted by automatic sync.
- Railway mirrors received RAW into private `anttivanttinen-max/Motolab-data`.
- Receiver/read secrets must never be committed to the public app repository.
- Beta auth/user identity layers must not gain authority over measurement/RPM calculations.
- Authenticated user RAW now also has a persistent Railway path under `/data/users/raw/<userId>/`; this is an additional user-scoped storage endpoint and does not replace the existing local-first research/raw mirror design unless explicitly integrated into that flow.

## v32 microphone stability and diagnostics retained as regression requirements
- v32.6 introduced fresh-stream recovery through `stopAudio()` + `startAudio()`, bounded ~0.5 s → 1 s → 2 s → 5 s retry, telemetry and manual MIC recovery.
- Field report showed repeated OFF/ON cycling; root cause was using `MOTOLAB_AUDIO_LAST?.t` as a destructive stale trigger without a reliable producer-backed timestamp.
- v32.8 `sensor-persistence-v5` removed `audio_frames_stale` as a destructive reconnect reason. Live enabled track on active stream is authoritative; destructive recreation stays for genuinely non-live/ended tracks.
- Real-device requirement remains: no false OFF/ON storm while genuinely ended/disconnected tracks still recover.
- v32.7 persistent diagnostics (`diagnostics.js` / `motolab-diagnostics-v1`) remain observational only: window errors, unhandled rejections, console warnings/errors, failed fetches, network/visibility/page/media/SW lifecycle, queue summaries and selected learning events are retained in a persistent local ring.
- `pagehide` is not proof of clean iOS shutdown; unfinished previous sessions may emit `previous_session_unclean`.
- Pending diagnostic events may replay into RAW as `diagnostic_replay` once normal learning path is available.
- Diagnostics must never control GPS MASTER, RPM, run acceptance, gear learning, candidate selection, recovery or dyno calculations.

## LIVE technical inspection
- Dedicated **LIVE** page remains the technical operating-status surface rather than crowding normal measurement/home or Settings.
- LIVE is observational only and exposes GPS/MIC/IMU/RAW/SYNC status plus expandable sensor, gear, dyno/run, queues, diagnostics/events and system details.
- LIVE refreshes only while active (~750 ms) to limit UI work.
- LIVE must not alter sensor configuration, recovery, GPS MASTER, RPM, run acceptance, gear learning, adaptive learning or dyno calculations.

## ARM AUTO / multi-pull capture
- ARM AUTO remains a persistent session across multiple pulls.
- Every detected pull completes and saves as its own run without a new ARM press.
- Re-arm uses cooldown/reset hysteresis and clears pre-buffer so previous pull tail is not merged into next pull.
- STOP explicitly ends/disarms the session.

## Vehicle / maintenance state
- Finland vehicle database v2 is installed.
- Vehicle lookup includes Yamaha DT125R and Derbi Senda 50 families and editable drivetrain data.
- Technical-spec editor and maintenance/history modules remain active.
- Yamaha DT125R Athena 170 remains the startup-bike line used by the current development flow.
- Historical temporary GPS power calibration in `dyno_curve_v2.js` remains **1.07** (`v32-dyno-curve-2.2`); the earlier 1.85 experiment is superseded unless a newer verified code change explicitly replaces it.

## Current validation priorities / unfinished work
- Confirm root `main` v34.8 / `2026-08-18h-auth-session-persist` on the actual iPhone: current build/cache transition, startup image/release badge, at-most-one build-scoped refresh, password-login/self-registration/session-guard modules, compact login panel, GPS/MIC/IMU routing, sensor persistence, KÄYTTÄJÄ submenu clearance, centered gear popup, profile selector, LIVE navigation, Run A/B analysis and key controls.
- Confirm GitHub Pages → Railway user/owner/password/self-registration auth end-to-end on the production origin.
- Verify self-registration produces `pending`, admin approval changes the account to usable/active state, ordinary login works afterward, duplicate nickname/device cases are handled clearly, and blocked users remain refused.
- Implement and validate owner/admin notification of new/pending registrations; keep notification payload free of passwords, tokens and recovery secrets.
- Verify persistent-volume behavior across restart/redeploy: `/data/users/registry.json`, user state and `/data/users/raw/<userId>/` must survive and remain consistent.
- Verify the auth-session guard absorbs transient refresh failures without masking genuinely invalid, blocked or unapproved sessions.
- Verify password change/new-device binding and owner recovery still coexist correctly with the new onboarding flow.
- Verify the initial one-time owner bootstrap and the separate one-time post-bootstrap recovery are deployed/configured correctly.
- Validate the `c47de47e…` session-safe auth path on the real iPhone/PWA: normal reload/update persistence, same-device owner recovery after a genuine 401, and preservation of local token/state when recovery cannot complete.
- Validate v32.8 microphone-stability behavior on real hardware.
- Validate v32.7 persistent diagnostics: abrupt termination, `previous_session_unclean`, queue/error persistence and RAW replay.
- Validate adaptive candidate tracking against GPS across acceleration, steady throttle and deceleration.
- Reprocess historical sweep/test/ZIP RAW datasets through the newest accepted RPM detection/learning plan.
- Validate 500 rpm region learning and reject any accepted model that worsens a region.
- Validate Auto Gear Learn interaction without weakening GPS MASTER authority.
- Preserve raw/top-candidate/harmonic information for replay/trainer evaluation.
- No new RAW measurement finding was established during the v34.8 promotion/owner-recovery/session-token/startup-cache/password-auth/self-registration/persistent-storage/session-guard interval.

## Deferred work
- Automatic knock / ignition autotune remains intentionally parked.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator remains intentionally parked.
- Camera RPM remains disabled.
- Native AirPods motion remains experimental until validated on a real device.

## Durable project-memory rule
- GitHub is the durable MotoLab project memory.
- Important decisions, test results, RAW interpretations, build changes, regressions/fixes and unfinished work must be archived in `MOTOLAB_CONVERSATION_ARCHIVE.md` and, when they change the active handoff, here.
- A recurring archive job checks for new relevant MotoLab information and updates documentation only; it must not alter application code or create empty commits.
- Before new implementation work, check current `main`, this status, the conversation archive and relevant technical notes.

## Regression rule
Before merging measurement or platform changes, preserve GPS, GPS MASTER + MIC LEARN, GPS ONLY, explicit phone-mic modes, continuous ARM AUTO multi-pull capture, AutoRide, manual run recording, run persistence, profiles, Knowledge Base, learning/RAW data and RAW JSON export, RAW replay, full-trip research capture, automatic research/RAW sync, vehicle lookup, maintenance, DT startup profile, release identity/version validation, PWA update behavior, persistent diagnostics, v32.8 microphone-stability correction, LIVE technical inspection, v34 Browser + Service Worker regression coverage, submenu/status clearance, first-load splash/session bootstrap, Run A/B comparison, post-run metadata immutability, gear-popup/gear-metadata checks, phone candidate bridge, user identity/admin-role safety, non-destructive session-token handling on 401, transient refresh retry behavior, dynamic release identity, stale-cache replacement/one-build reload behavior, password-auth creation/login/change/new-device flow, invite-free self-registration with pending-admin approval, new-user notification safety, persistent `/data/users` registry/state storage, authenticated per-user RAW storage, guest-mode removal, compact login-panel behavior, and both one-time owner recovery gates; keep native AirPods motion experimental until validated on a real device.