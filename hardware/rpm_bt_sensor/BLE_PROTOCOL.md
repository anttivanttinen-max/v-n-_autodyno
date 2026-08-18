# RPM-BT BLE protocol v1

Device name starts with `VANA-RPM-BT`. Service UUID: `f7b10001-6a4d-4b2a-9c41-7a3b84d2e001`.

All multibyte values are little-endian. Protocol version is 1. Notifications are 10 Hz by default. A lost signal is explicitly sent with validity cleared and RPM zero; the last RPM is never presented as current.

## Characteristics

| Name | UUID | Properties | Payload |
|---|---|---|---|
| Measurement | `f7b10002-6a4d-4b2a-9c41-7a3b84d2e001` | read, notify | 24-byte `MeasurementV1` |
| Status | `f7b10003-6a4d-4b2a-9c41-7a3b84d2e001` | read, notify | UTF-8 JSON, max 180 bytes |
| Config | `f7b10004-6a4d-4b2a-9c41-7a3b84d2e001` | read, write | UTF-8 JSON |
| Raw event | `f7b10005-6a4d-4b2a-9c41-7a3b84d2e001` | notify | 16-byte `RawEventV1` |

### MeasurementV1 (24 bytes)

| Offset | Type | Field | Unit |
|---:|---|---|---|
| 0 | u8 | version (=1) | — |
| 1 | u8 | source | 1=inductive, 2=contact_audio, 3=hall, 4=optical |
| 2 | u16 | flags | bit0 valid, bit1 learningEligible, bit2 engineValidated, bit3 dropout, bit4 jumpRejected, bit5 harmonicAdjusted, bit6 configChanged, bit7 sessionActive |
| 4 | u32 | seq | wraps naturally |
| 8 | u32 | timestampMs | device uptime, wraps naturally |
| 12 | u16 | rpm | RPM, 0 when invalid |
| 14 | u8 | confidence | 0–100 |
| 15 | u8 | signal | 0–100 pulse quality |
| 16 | f32 | rawFrequencyHz | accepted input edge frequency |
| 20 | u16 | rawCandidateRpm | before continuity/harmonic selection |
| 22 | u16 | rejectionCount | saturating session count |

### RawEventV1 (16 bytes)

`version:u8, reserved:u8, seq:u16, timestampUs:u32, periodUs:u32, edgeCount:u16, flags:u16`. Raw notifications are off by default because they cost radio/CPU time. Enable with config for short diagnostics.

## Config JSON

Write a complete or partial object, for example:

```json
{"pulsesPerRev":1.0,"minRpm":500,"maxRpm":16000,"notifyHz":10,"raw":false,"session":true}
```

Limits: `pulsesPerRev` 0.25–8, RPM 100–30000, notify 1–20 Hz. Invalid values are rejected and status reports `config_error`. Configuration is RAM-only in v1 for safe, predictable recovery after reset.

## Validity and learning contract

- Inductive v1: `valid` requires recent accepted edges, plausible range and continuity quality. `learningEligible` requires valid + confidence >=80 + no dropout/jump flag in the current window.
- Contact/audio: `learningEligible` must remain false until an implementation has passed engine validation: harmonic-family agreement, level/SNR gate, continuity, engine-off rejection, and GPS-consistent evidence across a calibration window. Firmware v1 does not claim audio input.
- Consumers must use flags, not `rpm != 0`, as authority. GPS remains authority during RPM learning regardless of these flags.

