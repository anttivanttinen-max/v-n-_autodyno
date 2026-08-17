# VÄNÄ MotoLab — next release plan

Updated: 2026-08-17

This is the locked handoff for the next server/app release. Do not deploy these items separately while another deployment is in progress. Re-check current `main`, `MOTOLAB_SYNC_STATUS.md` and `MOTOLAB_CONVERSATION_ARCHIVE.md` immediately before implementation/deploy.

## Must include in next release

1. **Third-gear beta teaching UI for all beta users**
   - 3rd gear test gets its own floating box during an active third-gear research session.
   - No prompt while confirmed 3rd gear remains in use.
   - Suspected 2nd/4th gear must persist continuously for 2.0 s before `MIKÄ VAIHDE KÄYTÖSSÄ?` opens.
   - Choices: 2 / 3 / 4 / OHITA.
   - Return to confirmed 3rd automatically closes the prompt.
   - OHITA closes without creating a trusted manual teaching reference and suppresses immediate repeat spam for the same current suspicion.
   - Manual 2/3/4 confirmation is reference/shadow teaching data only.
   - GPS MASTER remains authoritative for displayed RPM, run acceptance and normal gear-learning authority.

2. **Admin-only audio source selection**
   - Normal beta user keeps automatic/default microphone selection and does not see BT/audio-source controls.
   - Active VäNä/admin can select the audio input exposed by iOS/browser.
   - Selected audio source persists locally.
   - Source change uses the unified MIC command queue: OFF -> selected device -> ON when MIC was desired ON.
   - If selected input is unavailable, do not silently treat a fallback microphone as the selected sensor.

3. **VäNä owner/admin identity must persist across normal updates**
   - Owner nickname: `VäNä`.
   - Server-side role/status remains authoritative: owner/admin + active.
   - Existing MotoLab deviceId and signed device session survive normal PWA/Service Worker releases because release updates must not clear site identity storage.
   - Ordinary nickname `VäNä` must never grant admin rights.
   - Account UI must clearly show owner/admin state when resolved.

4. **Owner recovery — safe implementation only**
   - No universal hidden admin backdoor.
   - Same-device recovery may restore the existing VäNä account when its persistent MotoLab deviceId still matches the server-side owner device association.
   - Full site-data loss/new device requires a server-admin-controlled recovery path (e.g. `MOTOLAB_ADMIN_DEVICE_IDS` or a Railway-only recovery secret); no recovery secret is committed to public GitHub code.
   - If a one-time bootstrap password is used, it must be server-side secret/configuration, usable only before initial owner claim and permanently invalid after successful claim. Do not hard-code plaintext owner credentials in the public app.
   - Clean up/verify any unlinked experimental owner-recovery file before release; no inactive or ambiguous recovery endpoint should be left accidentally reachable.

5. **MIC control regression validation/fixes**
   - Explicit user MIC OFF remains authoritative and stays OFF until the user turns it on.
   - Top-right MIC control and main MIC button use the same serialized command queue.
   - Rapid taps, visibility changes and recovery must not create overlapping startAudio/stopAudio races.
   - Genuine ended/disconnected track may recover only when desired MIC state is ON.
   - Validate on real iPhone before calling the release stable.

6. **User/Beta navigation must expose existing systems clearly**
   - Own account.
   - Private feedback/messages with admin.
   - Beta community.
   - Shared runs (reduced graphical data only; no RAW/edit rights to recipient).
   - Tester level.
   - Invite tester.
   - Admin additions: approvals, feedback administration, Tester Merit review, per-user feature permissions, community/private diagnostics.

7. **Per-user cloud identity/storage validation**
   - Device-bound automatic login; no routine password login for normal beta users.
   - pending / active / blocked lifecycle.
   - Per-user cloud state remains private between users.
   - RAW/research attribution resolves to active user + device.
   - Multi-device/state restore and service restart persistence must be tested.

8. **Feedback/community diagnostic snapshot privacy**
   - User can report an issue and continue a private conversation with admin inside the app.
   - Admin may publish an issue anonymously to Beta community without exposing the original user identity/private conversation.
   - Community users can comment/help and mark `Minulla sama ongelma`.
   - Private technical snapshot/diagnostics around the issue remains admin/development-only and is never exposed to other users.

9. **Tester Merit remains quality-based**
   - Useful bug reports, reproducible tests, good ideas, community help and meaningful development participation can raise merit.
   - Message volume/spam/pointhunting alone gives no merit.
   - Device/app/sensor-caused bad data must not penalize the tester as user error.
   - Merit level does not automatically unlock deeper experimental features; admin permissions remain authoritative.

10. **LIVE / UI simplification retained**
   - Normal bottom navigation remains focused: MITTAUS / VEDOT / LIVE / ANALYYSI / ASETUKSET.
   - Deep sensor/queue/diagnostic details live under LIVE, not on the basic measurement screen.
   - Settings and maintenance stay compact/collapsible.
   - Do not re-add camera RPM.

## Measurement invariants — must not regress

- GPS MASTER remains authoritative in GPS + MIC learning.
- Phone/BT/contact microphone remains shadow/learning/reference data until explicitly validated otherwise.
- Microphone must not silently change displayed RPM, run acceptance or Auto Gear Learn authority in GPS MASTER mode.
- Preserve raw microphone candidate/harmonic/top-candidate data for replay/trainer evaluation.
- Adaptive learning continues in 500-rpm regions with 0.5x / 1x / 2x branch evidence and continuity/prediction.
- RAW/research remains local-first with retry after network loss/reopen.
- Diagnostics/LIVE/community/identity/merit/admin tools remain observational or administrative and must not change dyno calculations.

## Validation gate before wider beta

- Verify exact release/build shown in PWA and Service Worker cache identity.
- Real iPhone MIC ON -> OFF -> ON from both controls.
- Admin audio-source switch actually opens intended input.
- Third-gear overlay opens for ordinary beta user during active 3rd-gear research session.
- 2.0 s 2nd/4th hold, 2/3/4/OHITA and automatic close on return to 3rd.
- Owner/admin survives normal update/reload.
- User/Beta menu destinations work on phone.
- Identity approval/block, cloud state, private feedback, community anonymity, run sharing and Merit work end-to-end.
- LIVE/diagnostics/RAW replay show no measurement-performance regression.

## Not automatically included

- FI/EN language package remains a separate unpromoted development line unless explicitly resumed for this release.
- Automatic knock/ignition autotune remains parked.
- Full Knowledge Base integration across all tuning calculators remains parked.
- Camera RPM remains disabled.
