# MotoLab recovery / isolation handoff — 2026-08-17

This note preserves the latest `main` recovery decision while the unified v34 rebuild is prepared.

- A microphone regression was reported in the newer application line: the microphone did not work reliably in the field-test path.
- `main` was deliberately restored to v32.5 / build `2026-08-16x-gear-confirm` as a stable field-test baseline before rebuilding newer auth/mic/UI functions in isolation.
- Branch `dev/auth-mic-ui-repair` contains isolated login/microphone/UI experiments and must not be treated as automatically production-ready.
- The accepted visual design is considered finished/locked as the visual baseline. New functional work must preserve that appearance rather than repeatedly redesigning the app.
- iOS microphone activation must be validated from an actual user gesture and a desired ON state must never be confused with a genuinely live audio track.
- v34 rebuild must preserve explicit MIC OFF authority, serialized MIC commands, GPS MASTER authority, user identity/privacy and all agreed Beta/community functions.
- A rollback branch must be retained before moving `main` to v34 so the stable v32.5 field-test line can be restored quickly if real-device testing exposes a regression.
