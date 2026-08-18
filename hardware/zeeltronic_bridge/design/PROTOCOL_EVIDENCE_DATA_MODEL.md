# Zeeltronic protocol evidence and data model

Status: design only. RAW evidence is authoritative; decoded values are replaceable interpretations.

## Invariants

- Captures are immutable and content-addressed with SHA-256.
- Original bytes, timestamps and direction are never normalized in place.
- Every packet, field hypothesis and decoded setting links back to byte offsets in a source capture.
- Unknown bytes remain first-class fields; they are never discarded or silently zeroed.
- Reading and writing evidence are separate. A read hypothesis does not authorize a write.

## Core records

### Capture

`capture_id`, `sha256`, `path/object_key`, `size`, `captured_at_utc`, `capture_tool`, `tool_version`,
`transport` (`usbpcap`, `serial_proxy`, `esp_usb_host`), `host`, `operator_note`, `immutable=true`.

### Session

`session_id`, `capture_id`, start/end timestamps, device identity, connection topology, baud/format,
power state, operation label (`identify`, `read`, `program`, `readback`), and safety mode.

### Device identity

Manufacturer, product, device model, firmware text/version, FTDI VID/PID/serial, USB descriptors,
CDI power-source note and confidence. Unknown firmware is explicit, never inferred from filenames.

### Directional event

`event_id`, `session_id`, monotonic sequence, timestamp, direction (`host_to_zeel`, `zeel_to_host`),
raw bytes, source frame/offset, transfer type, endpoint and timing gap from the previous event.

### Packet and pair

A packet groups events without rewriting them. Store framing hypothesis, selector/command hypothesis,
payload, checksum bytes and source ranges. A command/response pair stores request packet IDs, response
packet IDs, latency, completion rule and pairing confidence.

### Field hypothesis

`field_id`, byte range(s), name, raw value, decoded value/unit, transform, enum candidates, observed
minimum/maximum, invariants, counterexamples, confidence and evidence links. Mirrored/repeated values
link to each other rather than being collapsed.

### Checksum/CRC hypothesis

Algorithm name/parameters, covered byte ranges, stored checksum range, byte order, test corpus size,
matches, mismatches and confidence. A hypothesis reaches `confirmed` only after independent mutations
produce predicted checksum changes.

## Confidence

- `observation`: directly captured fact.
- `candidate`: consistent with one capture.
- `supported`: consistent across independent sessions/settings.
- `high`: controlled single-variable experiments and no counterexample.
- `confirmed`: readback or checksum prediction proves the interpretation.

Confidence applies per claim, not per file or packet.

## Search/index model

Index capture/session SHA, time, direction, model/firmware, VID/PID/serial, operation, command bytes,
payload n-grams, field name/value/unit, confidence and experiment tag. Binary search preserves source
offsets. Derived indexes are rebuildable and never become evidence.

## Diff model

A diff contains left/right snapshot IDs plus:

- raw byte hunks with offsets and provenance;
- decoded field changes with old/new raw and engineering values;
- unknown-byte changes highlighted separately;
- structural changes (length/framing/order/timing);
- checksum consequences distinguished from user-setting changes;
- confidence and parser version for every semantic difference.

Known baseline: PCDI-10VT read image is 480 bytes; current unchanged-settings SHA-256 is
`9fc906d6f9141c79d4f217dadfcce1a56632e204a0c48f2c385145df11c181d0`.
