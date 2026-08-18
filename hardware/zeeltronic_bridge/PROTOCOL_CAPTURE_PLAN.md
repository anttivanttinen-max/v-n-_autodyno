# Zeeltronic protocol capture / evidence archive

Status: development-only. Do not merge to MotoLab production measurement path.

## Goal
Preserve every useful transport-level observation from the Zeeltronic PC-USB adapter (FTDI VID 0403 PID 6001) so later protocol analysis can reconstruct command framing, timing, maps, checksums and unit-specific behavior.

## Evidence to preserve
- firmware version and build identity
- USB device descriptor: VID, PID, bcdDevice, class/subclass/protocol, max packet 0, configuration count
- active USB configuration descriptor summary
- interface number/alternate/class/subclass/protocol and endpoint count
- bulk endpoint addresses and max packet sizes
- FTDI serial settings (baud, 8N1, flow control state)
- FTDI two-byte modem/status headers for every IN packet
- every received payload byte with monotonic millisecond timestamp
- every transmitted payload byte with monotonic millisecond timestamp
- blocked transmit attempts in read-only mode
- packet and byte counters, disconnect/reconnect count and transfer errors
- session start/end and heartbeat summaries
- later: Windows-side ZeelProg capture metadata (ZeelProg version, selected unit/model, COM port, operation name, wall-clock timestamp)

## Safety model
Firmware boots READ ONLY after every reset and every USB reconnect. BLE writes are logged but blocked. Write passthrough requires the exact runtime command `UNLOCK_WRITE_I_ACCEPT_RISK`; reconnect/reset relocks automatically. This prevents accidental CDI/map writes while transport is still being reverse-engineered.

## Capture line format
Serial output is intentionally machine-searchable.

- `CAP,<ms>,RX,<length>,<hex bytes>`
- `CAP,<ms>,TX,<length>,<hex bytes>`
- `CAP,<ms>,TX_BLOCKED,<length>,<hex bytes>`
- `FTDI_STATUS,<ms>,<status0 hex>,<status1 hex>`
- normal status lines are `[<ms>] <message>`

This makes raw terminal logs directly grep/search/parser friendly without losing the original byte stream.

## Analysis workflow
1. Save terminal output verbatim for each test session; never overwrite old captures.
2. Tag each file with date/time, CDI model, ZeelProg version, operation and known settings before/after.
3. Compare repeated identical operations to separate constant framing from payload.
4. Change only one known CDI value at a time and diff captures to map bytes to parameters.
5. Identify recurring frame prefixes/suffixes, lengths, sequence counters and checksums/CRCs.
6. Build a decoded corpus only after retaining the untouched original capture.
7. Never train/learn from inferred fields without linking them back to raw evidence.

## Next PC-side capture step
To learn the actual ZeelProg command protocol, create a Windows serial proxy/virtual COM capture so ZeelProg can talk to the real COM7 FTDI while every bidirectional byte and timing value is copied to a lossless log. Keep the raw proxy log plus a normalized JSON/CSV derivative. The ESP32 capture firmware is then used to independently validate the reconstructed protocol against the physical adapter/CDI.
