# Zeeltronic design implementation roadmap

Status: development roadmap. Each milestone requires review; production changes require explicit user approval.

## M0 — Freeze contracts and fixtures

Deliver session/evidence schemas, direction vocabulary, confidence rubric, content hashing and small sanitized capture fixtures. Document supported device identity fields and unresolved questions.

Exit criteria: schemas validate; hashes are deterministic; fixtures include split/coalesced chunks, reconnect, partial capture and unknown bytes; no production files changed.

## M1 — Evidence importer and immutable archive

Import current Windows `session.json`, JSONL, CSV and two RAW streams without changing originals. Build manifests, hashes, byte-span linkage and append-only annotations.

Exit criteria: tampering is detected; exact event and byte offsets round-trip; re-import is idempotent; incomplete/unclean sessions remain visible and marked.

## M2 — Protocol hypothesis workbench

Add versioned framing parsers, exchange pairing, timing analysis, unknown fields, checksum/CRC hypothesis runner and rebuildable search indexes.

Exit criteria: chunk boundaries do not dictate packet boundaries; competing hypotheses coexist; controlled one-variable captures produce source-linked field diffs; negative CRC evidence is retained.

## M3 — Read-only Zeeltronic prototype

Build a separate development prototype for connection/identity, read settings, ignition/YPVS/limiter views, saved snapshots and compare/diff. Do not integrate into production MotoLab.

Exit criteria: all UI prototype criteria pass; unsupported firmware and partial reads are safely blocked; every value/diff drills down to RAW; no generated write command exists.

## M4 — Offline learning dataset

Define the aligned timeline and importer for run/GPS/GPS-RPM/gear/knock/map/timing. Keep camera excluded and audio shadow-only until raw engine-signal validation is recorded.

Exit criteria: deterministic reprocessing; clock-drift tests; explicit exclusion reasons; GPS remains authority; source lineage reaches original run and protocol evidence.

## M5 — Suggestion-only evaluation

Implement per-run aggregation, matched before/after comparison, per-RPM bounded suggestions, quality/confidence gates and safety rejection tests.

Exit criteria: no device-write dependency or API; sparse/conflicting/knock fixtures yield no suggestion; suggestions show uncertainty, bounds and complete evidence; rollback baseline is identified.

## M6 — Write research, separately authorized

Only after explicit approval, create an isolated write simulator and then hardware test plan for interlock, exact payload binding, pre-write snapshot, full read-back and rollback. Production integration remains a separate approval.

Exit criteria: reconnect/stale base/payload change cancels authorization; fault injection never reports false success; read-back mismatch relocks and preserves recovery evidence; audit log is complete. Hardware trials begin with a recoverable bench unit and documented abort criteria.

## Milestone order and release gate

M0–M2 establish protocol truth before UI meaning. M3 proves read-only usability. M4–M5 may proceed on saved evidence but cannot bypass protocol confidence. M6 is intentionally gated. A production proposal must list supported device/firmware combinations, unresolved fields, test coverage, rollback evidence and a user-approved scope; until then all work stays under the Zeeltronic development area.

