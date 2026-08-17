# VÄNÄ MotoLab v34 rebuild status

Build candidate: **v34.0 / `2026-08-17o-rebuild-ui-i18n`**

This file records the final pre-promotion validation state.

- Unified User/Beta menu implemented.
- Admin-only entries are conditionally rendered only for an active server-resolved admin.
- Legacy floating User/Beta/Feedback/Community controls are hidden in the integrated v34 UI.
- Finnish/English presentation layer implemented with state-text safety guard.
- Third-gear teaching overlay remains enabled for all beta users with a 2.0 s confirmation hold.
- Admin audio-input selector remains admin-only.
- MIC OFF authority and serialized v33.7 MIC command queue retained.
- v33.x identity/cloud/feedback/community/run-sharing/Tester Merit layers retained.
- Legacy syntax defects found in `dyno_curve_v2.js` and `trip_phone_raw.js` were fixed during the rebuild.
- Server identity/cloud-state smoke test is part of CI.
- Stable v32.5 field-test main line is to be backed up before promotion.
- Physical iPhone/GPS/microphone/motorcycle field validation remains required after deploy; CI cannot substitute for real sensor hardware.
