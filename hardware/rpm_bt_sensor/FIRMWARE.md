# Firmware

Target: Arduino-ESP32 **3.3.11**, ESP32-S3 N16R8 (or verified equivalent). The sketch uses BLE and LittleFS libraries shipped with the ESP32 core. Source: `firmware/rpm_bt_sensor/rpm_bt_sensor.ino`.

## Measurement path

- GPIO4 rising-edge ISR stores only the microsecond timestamp/interval and counters.
- A 350 µs ISR spacing rejects extremely close EMI edges; range, continuity, jitter and configured RPM limits provide the following gates.
- `RPM = 60,000,000 / (interval_us × pulsesPerRev)`; PPR is configurable and is never universally hard-coded. V1 returns to the safe 1.0 default after reset.
- One isolated >35% jump is rejected; two mutually consistent new intervals establish a real acceleration step.
- A light exponential display filter is applied outside the ISR. The raw interval remains in diagnostics.
- No recent pulse clears validity and RPM. BLE publishes at configurable 1–20 Hz (10 Hz default).
- Confidence falls with rejected-edge ratio and pulse age. It is a quality indicator, not proof of accuracy or permission to learn.
- BLE disconnect does not affect edge capture. Advertising restarts on disconnect; sequence/timestamps expose gaps. LittleFS logging is optional evidence backup.
- Firmware always leaves `learningEligible` false. Only a future host adapter with GPS/reference agreement may derive true.

## Configuration

Write UTF-8 JSON to the `config` characteristic, for example:

`{"pulsesPerRev":1.0,"minRpm":500,"maxRpm":16000,"notifyHz":10,"raw":false,"session":true}`

Accepted PPR range is 0.25–8.0. V1 settings are RAM-only and safely return to defaults after reset.

### PPR calibration

| Ignition behavior | Initial PPR hypothesis | Example at 6000 rpm |
|---|---:|---:|
| Typical single-cylinder 2T, one spark/rev | 1.0 | 100 Hz |
| 4T coil fires once per two crank revs | 0.5 | 50 Hz |
| Wasted-spark 4T, one spark/rev | 1.0 | 100 Hz |
| Two sensed pulses per crank rev / double trigger | 2.0 | 200 Hz |

Choose PPR from ignition topology and agreement across several stable reference points, not from one convenient sample. If reported RPM is exactly half/double reference, first rule out noise/double edges and then test the corresponding PPR.

## Flash

Install ESP32 board package 3.3.11, select the exact board and its N16R8 flash/PSRAM settings, connect by USB, compile and upload. The optional status LED defaults to GPIO48; change `PIN_STATUS_LED` after checking the carrier. GPIO4 is the functional input assumption and must be verified free on the exact board.

