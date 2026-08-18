# Implementation roadmap and test criteria

## M0 — Evidence foundation

Deliver immutable captures, session/direction/event schema, SHA verification and provenance-aware
480-byte decoder. Pass when repeated unchanged reads are byte-identical and every decoded value links to
source offsets.

## M1 — Safe desktop read-only dev tool

Deliver identity, live Read, maps/YPVS/limiter, versions and raw/semantic diff. Pass when a Live result
is rejected unless USBPcap grows during that exact Read, and unexpected devices/firmware are blocked.

## M2 — Standalone ESP32-S3 read-only

Deliver USB-host FTDI enumeration, own Wi-Fi AP, phone page, immutable 480-byte download and BLE status.
Pass when build succeeds, `0403:6001` enumerates, two phone reads match the computer baseline SHA, and
disconnect/reconnect remains hard-locked.

## M3 — Write research harness (separate build)

Implement encoder/checksum tests, simulated transport, snapshot/readback/rollback and audit log. Pass
with golden vectors and fault injection; no live CDI write yet.

## M4 — Controlled bench write

Requires explicit user approval. Change one reversible non-safety-critical setting on a powered bench,
read back, compare, restore baseline and read back again. Pass only with exact expected diffs and proven
rollback. A failure keeps production writes disabled.

## M5 — Learning suggestions

Deliver aligned run bundles, quality gates, per-RPM comparison and suggestion reports. Pass on recorded
datasets with GPS authority, camera RPM excluded, unverified audio excluded, and zero automatic writes.

## M6 — Production review

Security/safety review, migration plan, UI usability test, audit retention and explicit production
approval. No dev component enters production before this milestone is approved.
