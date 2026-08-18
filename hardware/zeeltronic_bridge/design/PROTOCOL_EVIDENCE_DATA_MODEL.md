# Zeeltronic protocol evidence and data model

Status: design only. Development branch only; no production integration or protocol write generation.

## Principles

1. RAW is the evidence. Derived packet boundaries, decoded fields and settings are replaceable interpretations.
2. A capture is immutable after finalization. Corrections create a new annotation or parser revision, never rewrite the capture.
3. Every derived value must resolve back to session, direction, event sequence and byte range.
4. Unknown bytes remain explicit unknown fields. Names such as `unknown_07` are preferable to unsupported meaning.
5. Protocol knowledge is scoped to device model and firmware; observations from unlike devices are not silently pooled.

## Evidence store

Each `capture_session` owns a manifest and content-addressed evidence objects. On STOP, calculate SHA-256 for every file and the canonical manifest, set `finalized_at`, and make the session append-closed. A later annotation references the manifest hash.

| Entity | Required fields | Purpose |
|---|---|---|
| `capture_session` | `id`, UTC start/end, monotonic clock origin, mode, operator/test labels, tool versions, clean-stop, manifest SHA-256 | Boundary for one reproducible experiment |
| `transport_endpoint` | role, COM/USB identity, VID/PID/serial/bcdDevice, baud/data/parity/stop/flow, DTR/RTS | Exact physical/logical route |
| `device_identity` | vendor, reported/selected model, hardware revision, firmware version/build, identity source and confidence | Prevents cross-device assumptions |
| `raw_object` | path/object id, media type, direction, bytes, SHA-256, capture order | Immutable original stream or terminal log |
| `transport_event` | session, sequence, elapsed µs, UTC, direction, raw object, byte offset/length, receive chunk boundary, status/note | Lossless timeline linkage |
| `packet_hypothesis` | parser revision, direction, start/end event and byte spans, framing hypothesis, confidence | A reversible view over RAW |
| `exchange` | request packet, zero or more response packets, timing, pairing rule/confidence, terminal state | Command/response reconstruction |
| `field_observation` | packet, offset, length, raw hex, candidate name/type/value/unit/encoding, confidence, evidence links | Known and unknown field mapping |
| `integrity_hypothesis` | algorithm, parameters, covered ranges, stored/computed bytes, match result, corpus counts, confidence | Checksum/CRC research without premature claims |
| `annotation` | author/tool, timestamp, target, text/tag, supersedes, evidence links | Append-only human/machine interpretation |

Directions use stable values: `PC_TO_ZEEL`, `ZEEL_TO_PC`, `META`, `STATE`, `ERROR`, and `TX_BLOCKED`. Do not infer protocol packet boundaries from serial read chunks. One packet may span chunks and one chunk may contain multiple packets.

## Source linkage

Use half-open byte spans: `raw_object_id`, `offset_start`, `offset_end`. A packet may have several spans if it crosses capture events. Store event sequence ranges for fast navigation, but byte spans are authoritative. Derived settings additionally carry `decoder_id`, `decoder_version`, `derived_at`, and a sorted list of source span IDs. A UI must be able to open the exact HEX evidence for any decoded value.

## Packets and exchanges

A packet hypothesis records candidate framing (`prefix`, `declared_length`, `payload`, `trailer`) separately from evidence. Parsing outcomes are `complete`, `partial`, `ambiguous`, or `rejected`. Preserve competing hypotheses.

Pair requests and responses by explicit rules such as direction change, command echo/correlation byte and response window. Record `latency_first_byte_us`, `latency_complete_us`, intervening packet IDs, timeout and retry relationships. Never pair by nearest timestamp alone when traffic is concurrent or ambiguous.

## Confidence

Use both a level and rationale:

- `observed`: direct bytes/metadata; no semantic inference.
- `supported`: repeated captures plus controlled one-variable change support the interpretation.
- `probable`: multiple observations fit, but controlled confirmation is incomplete.
- `tentative`: useful working hypothesis with competing explanations.
- `rejected`: retained for history and regression testing.

Numeric confidence `0..1` may rank results but never replaces level, method, sample count, device count and counter-evidence. Only `supported` fields may enter a writable settings schema, and that still does not authorize writes.

## Checksum and CRC hypotheses

Represent each candidate with algorithm family, width, polynomial, initial value, reflection flags, xor-out, byte order, included/excluded ranges and expected trailer location. Evaluate it against positive frames, intentionally changed frames, corruptions and multiple lengths. Promote to `supported` only after all available valid frames match, deliberate corruption fails, and at least two payload changes and two lengths are covered. Keep failures as searchable negative evidence.

## Search/index model

Build replaceable indexes from immutable manifests:

- session facets: date, model, firmware, ZeelProg/capture version, operation, mode, clean stop and hashes;
- byte search: exact HEX, masked HEX and ASCII over each direction, returning raw offsets;
- protocol facets: direction, candidate command, length, framing/parser version and confidence;
- setting facets: field name, RPM point/range, interpreted value, unit and before/after label;
- timing facets: request/response latency, gaps, retries, reconnects and errors;
- provenance graph: decoded setting → field → packet → event/span → raw object → session.

The index is disposable and schema-versioned. Rebuilding it must not alter evidence.

## Settings snapshot and diff

A `settings_snapshot` contains device identity, read exchange IDs, canonical decoded document, decoder version, completeness, confidence summary and source spans. Its identity is a hash of canonical content plus device scope. Store ignition and YPVS points as ordered `(rpm, value)` pairs; preserve the original encoded values and units alongside normalized values. Limiter and scalar settings are typed fields.

A diff contains `base_snapshot_id`, `target_snapshot_id`, device compatibility result and per-field changes: added/removed/changed/unknown, old/new raw and normalized values, delta, confidence, and both source links. Map diffs align by semantic RPM only when RPM decoding is supported; otherwise align by raw index and mark the interpretation tentative. Unknown-byte diffs remain visible. Never treat missing/undecoded as zero or unchanged.

## Minimum validation

- Hash verification detects any modified RAW or manifest file.
- A packet crossing two events resolves to exact original bytes.
- Re-running a newer parser creates new hypotheses without changing prior results.
- Search results open the correct session, direction and offset.
- A controlled one-setting change produces a diff with evidence on both sides.
- Device/firmware mismatch blocks an unqualified settings comparison.


