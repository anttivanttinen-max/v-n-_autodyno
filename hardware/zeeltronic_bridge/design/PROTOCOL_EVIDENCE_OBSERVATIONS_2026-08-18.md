# PCDI-10VT read evidence observations — 2026-08-18

Status: development evidence. Read-only capture; no `Program` operation and no setting changes.

## Device and capture

- ZeelProg product: `PCDI-10VT`
- reported product software: `111.34.260325`
- adapter: FTDI FT232R, VID `0403`, PID `6001`, serial `BG02QW27`
- capture layer: USBPcap3 / Wireshark, decoded with `ftdi-ft` interface-A payload fields
- two successful `Read` operations were captured from the same powered device without changing settings

The combined source PCAPNG is retained outside the repository in the local immutable evidence archive. Repository content intentionally contains tooling and observations, not the user's device dump.

## Repeated read result

| Property | Read 1 | Read 2 |
|---|---:|---:|
| Duration | 7.845 s | 7.841 s |
| PC → Zeel payload | 492 bytes | 492 bytes |
| Zeel → PC payload | 964 bytes | 964 bytes |
| PC → Zeel SHA-256 | `41c2c4fe0c327a67a2c4623dec7e81aa856a18ad90216d96fa56d22433f55a24` | same |
| Zeel → PC SHA-256 | `12a984ca7c914cad7f76fd0bf04d9964c1b2cf4bfd421c3e903ad5922343beac` | same |

Both directions are byte-for-byte identical across the two reads. This is `supported` evidence that the captured exchange is deterministic for an unchanged device state under these test conditions.

## Transport-level structure

Observed PC → Zeel byte counts in each read:

- `0x64`: 480 occurrences
- `0x61`: 4 occurrences
- `0xF0`: 2 occurrences
- `0x01`: 2 occurrences
- `0x00`: 4 occurrences

USB transfer boundaries show the opening sequences as two occurrences of `61 F0 01`, followed later by two occurrences of `61 00 00`. The remaining 480 transmitted bytes are `0x64` polls. Transfer chunk boundaries are evidence about USB delivery only; the three-byte command grouping is a supported reconstruction from ordering and repeated behavior, not a claim about all protocol framing.

The dominant response form during polling is `3D xx`: `0x3D` occurs 484 times in the 964-byte concatenated response stream. Four additional/split `0x3D` status/handshake bytes occur around the non-poll commands. Each `0x64` poll is followed, in the stable main sections, by a two-byte response whose first byte is `0x3D` and second byte varies.

Exactly 480 `xx` poll values are recovered from each read. The complete 480-byte value stream is byte-for-byte identical across the two unchanged-state reads (SHA-256 `9fc906d6f9141c79d4f217dadfcce1a56632e204a0c48f2c385145df11c181d0`). Within one read, however, values `0..239` and `240..479` are **not** identical. The two observed `61 00 00` selections and their exact page/region boundary semantics therefore remain an open hypothesis.

## Initial read-block offsets

Offsets below are zero-based within the full 480-byte poll-value stream. They are inferred by matching the settings visible after the successful read. Encoding claims are supported for this captured PCDI-10VT/firmware combination but remain firmware-scoped.

| Offset(s) | Observed encoding | Visible setting match |
|---|---|---|
| `0..31` | 32 bytes, all `0x20` | empty description padded with spaces |
| `47..66`, even little-endian pairs | ten tenths-of-degree values | Ignition Map 1 advances: `18.0, 25.5, 21.5, 16.5, 9.7, 4.0, 7.0, 9.0, 9.0, 9.0` |
| `67..86`, even little-endian pairs | ten tenths-of-degree values | Ignition Map 2 advances: `18.0, 25.5, 22.5, 20.5, 14.5, 9.2, 4.5, 9.0, 9.0, 9.0` |
| `107..116` | RPM divided by 100 | Map 1 RPM row: `2000, 2500, 7000, 9000, 10000, 11000, 11000, 14000, 15000, 16000` |
| `117..126` | same sequence as `107..116` | duplicate Map 1 RPM sequence; semantic reason still unknown |
| `127..136` | RPM divided by 100 | Map 2 RPM row: `2000, 2500, 6000, 7000, 9000, 10000, 11000, 14000, 15000, 16000` |
| `137..139` | `06 06 07` | matches visible point counts 6 and 7; exact meaning/order of the duplicate `06` needs a controlled test |

The disabled/reserve points are included in the stored ten-point arrays and must not be discarded merely because the current active point count is smaller.

## Confidence and limits

Supported:

- exact byte counts and hashes above;
- deterministic equality of two unchanged reads;
- repeated command order and request/response timing;
- `0x64` polling and dominant `3D xx` response shape.
- an identical complete 480-byte settings response across two unchanged-state reads;
- map advance scaling as tenths of a degree and RPM scaling as hundreds for the offsets above.

Probable:

- `61 F0 01` selects or requests a header/identity region;
- `61 00 00` selects a settings data region;
- the varying byte in `3D xx` is the returned data byte for the preceding poll.

Unknown:

- semantic offsets for ignition maps, PV/YPVS curve, limiter and scalar settings;
- whether integrity protection is present inside the 480 returned values;
- whether the two `61 00 00` occurrences select distinct 240-byte regions, reset an address, or serve another purpose;
- checksum/CRC algorithm and covered range;
- whether all firmware versions use identical offsets and lengths.

No semantic field should be promoted above `tentative` until a controlled one-value change is captured and compared against this baseline. A write operation requires separate explicit approval and the safety interlock design; this observation does not authorize writing.

## Next evidence test

Preserve this baseline, then—only after explicit approval—change one reversible, low-risk setting by the smallest UI step, capture `Program`, immediately capture `Read`, restore the baseline, and capture a final `Read`. Compare all returned data positions and any integrity bytes. Until then, continue read-only decoder work using the 480-value response sequence.

