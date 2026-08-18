# Zeeltronic write guard

`zeel_write_guard.py` is the evidence gate around future PCDI-10VT writes. It does not guess or transmit unknown protocol bytes.

Current capabilities:

- validate an exact 480-byte read block;
- generate a byte-level baseline/candidate change plan;
- flag changes outside currently mapped offsets;
- fingerprint an official ZeelProg `Program` capture;
- strictly recognize the first observed 733-byte Program request structure and extract its 240-byte write payload;
- verify a post-write readback byte-for-byte;
- fail closed when `write` is requested without a proven transport profile.

The transmission lock can be removed only after an official ZeelProg `Program` exchange has been captured, its framing and integrity bytes have been decoded, and the result has been reproduced against a disconnected test unit with a successful readback.

## Required evidence sequence

1. Preserve the current 480-byte baseline and its SHA-256.
2. Capture an unchanged-settings `Program` exchange from ZeelProg.
3. Capture an immediate `Read` and confirm it equals the baseline.
4. Change one reversible field by one UI step and capture `Program` plus `Read`.
5. Restore the baseline and capture final `Program` plus `Read`.
6. Decode command framing, acknowledgements, timing and checksum/CRC.
7. Add a firmware-scoped transport profile and tests; do not generalize across models.

Until all gates pass, `write` exits with code `3` and sends nothing.

## First unchanged-settings Program observation

The captured PC-to-device stream is 733 bytes and matches this exact structure:

1. `61 F0 01`
2. sixteen `44 xx` writes
3. `61 F0 01`
4. sixteen `64` polls
5. `61 09 00`
6. 224 `44 xx` writes
7. `61 00 00`
8. 224 `64` polls
9. final `41`

This yields a 240-byte write payload (16 + 224). The immediate 480-byte Read after Program exactly matched the pre-write baseline. The mapping between the 240-byte write payload, the 480-byte read representation and any integrity fields still requires a controlled one-value delta; therefore transport remains disabled.

