# Zeeltronic protocol evidence catalog

Every inferred protocol fact must point back to one or more raw capture sessions. Do not promote guesses to facts.

## Evidence record

```json
{
  "id": "zeel-evidence-0001",
  "status": "hypothesis|probable|verified",
  "device_model": "unknown",
  "zeelprog_version": "unknown",
  "transport": {
    "usb_vid": "0403",
    "usb_pid": "6001",
    "serial_baud": null,
    "data_bits": 8,
    "parity": "none",
    "stop_bits": 1
  },
  "direction": "PC->ZEEL|ZEEL->PC|BOTH",
  "pattern_hex": "",
  "meaning": "",
  "variable_fields": [],
  "checksum": {
    "algorithm": "unknown",
    "coverage": "unknown",
    "field_offset": null
  },
  "observations": [
    {
      "session": "YYYY-MM-DD_HH-mm-ss",
      "event_lines": [],
      "experiment": "what was changed in ZeelProg",
      "before_value": null,
      "after_value": null
    }
  ],
  "notes": ""
}
```

## Promotion rule

- `hypothesis`: pattern appears but meaning is not isolated.
- `probable`: same controlled change repeats and the same byte/field relationship repeats at least twice.
- `verified`: independent controlled repetitions reproduce the mapping, competing explanations are ruled out, and replay/write tests are not required unless explicitly approved.

## Experiment discipline

Change one ZeelProg value at a time. Record model, firmware/program version, map number, exact old/new value, whether only READ occurred or a WRITE/SEND/SAVE was requested, CDI power state, and capture session name.

Never delete a capture because a later interpretation changes. Derived indexes and catalogs can be rebuilt; RAW evidence cannot.
