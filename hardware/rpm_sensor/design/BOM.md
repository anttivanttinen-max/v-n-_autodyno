# RPM sensor — superseded contact-first BOM

> Do not purchase from this historical BOM for V1. The exact inductive V1 BOM is [`hardware/rpm_bt_sensor/BOM.md`](../../rpm_bt_sensor/BOM.md). Contact accelerometer/piezo/BT microphone parts below are optional research only.

## Core node

| Function | Preferred part/class | Notes |
|---|---|---|
| MCU/radio | ESP32-S3 module/dev board | BLE, DMA ADC/I2S options, monotonic timer, enough RAM for rolling raw buffers |
| Contact sensor | ADXL1002-class analog accelerometer | Wide bandwidth and deterministic raw signal; mount on small rigid PCB |
| Cost-down contact trial | Piezo/contact disc + charge/voltage front end | Prototype only until temperature, resonance and repeatability are characterized |
| Analog protection | Series resistor, rail clamps/TVS, RC input network | Values selected after sensor/output range measurement |
| Anti-alias/gain | Low-noise rail-to-rail op-amp, configurable gain, 2–4 pole LPF | Avoid AGC in the evidence path; gain changes are logged |
| ADC | MCU ADC for first proof; external 12–16 bit SPI/I2S ADC if ENOB/jitter fails | Freeze only after bench noise/linearity test |
| Inductive pickup | Clip/wrap pickup lead or purpose-made non-contact probe | No direct ignition-primary connection in v1 |
| Pulse conditioning | Input limiting, bidirectional transient clamp, hysteretic comparator | Layout separation and verified safe voltage margins required |
| Storage | 8–16 MB flash/PSRAM buffer or microSD option | BLE loss must not destroy the evidence window |
| Power | Protected 5 V USB/power bank input, 3.3 V low-noise regulator | First road version uses isolated battery/power bank; vehicle power deferred |
| Enclosure | Small flame-retardant enclosure, sealed connectors, strain relief | Electronics mounted away from engine heat |

## Mechanical kit

- Correct-thread extension nut/adapter approved for the engine location.
- Replaceable aluminium sensor shim/adapter with keyed orientation.
- High-temperature shielded/twisted lead, strain relief, P-clips and heat sleeve.
- Witness paint/mark and mount-ID label.
- No added magnet or rotating marker in vehicle v1.

## Prototype quantities

- 2 x ESP32-S3 nodes (one spare/reference).
- 2–3 x contact sensor PCBs/adapters to test remount repeatability.
- 1 x inductive pickup and protected conditioner.
- 1 x BT earbud/AirPod used only for comparison with the documented mount.
- Optional bench Hall/optical reference and signal generator/service tach.

## Hardware gates before road use

- Confirm adapter does not change critical fastener preload or contact hot/moving parts.
- Measure enclosure/sensor temperature margin and cable retention.
- Verify transient protection and that inductive pickup cannot expose the MCU/user to ignition voltage.
- Verify no ADC clipping at the highest safe stationary test RPM.
- Run radio/storage fault tests without blocking acquisition.

Exact resistor/filter values and PCB layout are intentionally not frozen before oscilloscope captures from the chosen contact sensor and ignition system.

