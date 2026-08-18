# MotoLab Zeeltronic UI and feature design

Status: dev design only; do not integrate into the production MotoLab app without explicit approval.

## Main state

The header always shows transport, connection state, FTDI identity, CDI model/firmware, safety mode,
last successful read time and snapshot SHA. States are explicit: disconnected, enumerating, ready,
reading, read verified, write armed, writing, verifying, rollback required and fault.

## Read-only workspace

- Identify device and reject unexpected VID/PID/model/firmware.
- `Lue asetukset` creates an immutable RAW snapshot before decoding.
- Ignition maps show table and graph with raw-byte provenance.
- YPVS curve, rev limiter, shift light and other known settings show unit, raw value and confidence.
- Unknown fields have their own inspector instead of disappearing from the UI.
- Saved versions include timestamp, label, device identity, firmware, SHA and audit events.
- Compare view shows semantic changes beside raw byte hunks and flags unknown/checksum changes.

## Write safety interlock

Default mode is hard read-only. Enabling a future write path requires all of the following:

1. Fresh device identification and verified pre-write snapshot.
2. Supported model/firmware and complete encoder/checksum validation.
3. Stable power/transport checks and no active run.
4. Proposed-change diff with safety-limit validation.
5. Explicit confirmation that names the device, snapshot and exact changed fields.
6. Immediate full readback and byte/semantic comparison.
7. Automatic rollback offer on any mismatch; never claim success before readback.

The confirmation is not a generic OK button. It presents old/new values, risk boundaries and the
rollback snapshot SHA. Disconnect, timeout, model mismatch or app restart clears write authorization.

## Audit log

Append-only events: connect/disconnect, identity, snapshot, parser version, comparisons, confirmations,
blocked writes, transmitted write packets, readback result and rollback. Store operator, UTC time,
device identity, source/target SHA and software/firmware version. Secrets are not logged.

## Current dev implementations

- Desktop Zeel Studio: direct ZeelProg/USBPcap read, read-only display and diff.
- ESP standalone v3: phone Wi-Fi page and 480-byte Read; arbitrary writes hard-disabled.
