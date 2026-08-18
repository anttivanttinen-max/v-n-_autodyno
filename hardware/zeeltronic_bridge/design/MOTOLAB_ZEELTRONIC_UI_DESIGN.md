# MotoLab Zeeltronic UI and feature design

Status: design/prototype only. Do not integrate into the production MotoLab app without explicit user approval.

## User goal and boundaries

The workspace lets an operator identify a Zeeltronic unit, read and inspect its settings, compare evidence-backed versions and later perform a deliberately authorized write. The first deliverable is read-only. Reverse-engineering uncertainty is visible rather than hidden.

## Main workspace

### Connection header

Show one unambiguous state: `Disconnected`, `Discovering`, `Connected / unidentified`, `Identified / read-only`, `Reading`, `Ready`, `Write armed`, `Writing`, `Verifying`, or `Fault / relocked`. Also show route, model, firmware, adapter serial, last activity and capture session ID. A reconnect, identity change, timeout or app restart immediately returns to read-only and clears write authorization.

### Device identification

Display reported identity separately from user-selected/ZeelProg metadata, each with source and confidence. If model or firmware is unknown or conflicts with a snapshot, show a blocking incompatibility warning. Never guess a compatible model from USB VID/PID alone.

### Read settings

`Read settings` is the primary action. It starts a new evidence session, records every exchange, validates completeness/integrity hypotheses and creates a snapshot. Partial reads remain inspectable but cannot be used as write sources. The result summary shows sections read, unknown fields, checksum status, parser version and evidence link.

### Settings views

- **Ignition map:** RPM/value table plus curve; raw encoded value, decoded value, unit, confidence and evidence drill-down per point.
- **YPVS curve:** same evidence-first table/curve pattern, with axis/units clearly labelled and unknown points retained.
- **Limiter and scalars:** typed value cards with valid/observed bounds, raw bytes and provenance.
- **Unknown fields:** offset/hex, occurrence pattern, changed/unchanged state and current hypotheses.

Editing controls are absent in read-only mode, not merely disabled-looking. Unsupported or incomplete fields are never editable.

### Saved versions and compare

Save immutable named snapshots with timestamp, vehicle/profile, device identity, notes, completeness and capture hash. Compare any two compatible snapshots using summary counts, side-by-side tables and overlaid curves. Use distinct states for changed, added, removed, unknown and confidence-changed. Every difference links to both RAW sources. Export is a derivative and includes snapshot/parser versions.

## Write safety interlock (future, separate approval)

Writing is a separate capability flag/build path and remains unavailable until protocol write/read-back tests are approved. Enabling it requires all gates:

1. Explicit non-production feature approval and compatible supported model/firmware.
2. Fresh complete pre-write read and immutable rollback snapshot from the currently connected device.
3. No unknown required fields, integrity validation passed, stable connection and safe operational preconditions defined for the device.
4. Proposed changes pass limits: allowlisted fields, value/rate bounds and maximum number/magnitude of changed points.
5. Review screen shows exact device, base snapshot hash, complete diff and safety warnings.
6. Explicit confirmation names the irreversible action; require a typed phrase such as `WRITE <device-model>` plus a final hold-to-confirm action. No remembered confirmation.

The write token is single-use, expires quickly and is bound to device identity, connection epoch, base snapshot and exact payload hash. Any reconnect, payload change or stale base cancels it.

During write, prevent navigation and show stage/progress without claiming success early. Immediately read back the full settings, compare against the intended payload and save a post-write snapshot. Success means verified equality, not merely an acknowledgement. On mismatch or interruption, relock, preserve logs, show an explicit uncertain-device state and offer the documented recovery/rollback flow; do not blindly retry.

## Rollback and snapshots

Rollback is a new, confirmed write of a known compatible snapshot, never an undo illusion. Keep pre-write, intended and read-back snapshots together in one operation record. Rollback must pass the same compatibility, bounds, fresh-base and confirmation gates. If device state cannot be read, do not claim rollback is safe.

## Audit log

Append-only events include actor, UTC and monotonic time, app/parser version, device identity, connection epoch, session/snapshot hashes, action, confirmation method, exact diff/payload hash, result, read-back verification and errors. Redact personal/path data in exports without altering the original local audit record. Audit entries link to evidence but never contain the only copy of evidence.

## Prototype acceptance criteria

- A disconnected or unidentified device cannot expose write controls.
- Read creates a versioned snapshot and each visible value opens its RAW evidence.
- Partial/corrupt reads are labelled and blocked from write use.
- Compare correctly distinguishes unknown/missing from zero and blocks incompatible devices.
- Reconnect clears the write token; changed payload invalidates confirmation.
- Simulated write is not successful until full read-back matches.
- Failure produces an audit record and preserves pre-write rollback material.


