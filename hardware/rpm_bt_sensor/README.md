# VÄNÄ MotoLab RPM-BT sensor — development build

This directory is a self-contained experimental reference sensor. It does not modify or enable production MotoLab integration.

## Recommended v1

Use an isolated inductive pickup around the spark-plug lead, a protected Schmitt-trigger input, and the confirmed ESP32-S3 N16R8 board. This gives edge timing directly and keeps the measurement loop light. The known contact-audio mount (extension nut + tight aluminium shim) is retained as a parallel validation source: the strongest saved observation was about 6591 RPM against an independently estimated 6600 RPM, confidence 92.2%.

Do not connect an ignition-primary, CDI, coil-negative, spark-plug lead, or any vehicle voltage directly to an ESP32 pin.

## Contents

- `BUILD_QUICK.md` — short build/flash/test checklist
- `HARDWARE.md` — architecture, verified/open BOM, pin wiring, mounting and power
- `BLE_PROTOCOL.md` — byte-exact GATT contract
- `TEST_PROTOCOL.md` — calibration and numeric acceptance gates
- `MOTOLAB_INTEGRATION.md` — proposed shadow-only sensor-hub boundary
- `diagrams/` — printable SVG wiring and mounting drawings
- `firmware/rpm_bt_sensor/` — Arduino-ESP32 3.3.11 firmware
- `tools/windows/` — BLE logger, replay/calibration test, and one-click launchers

## Safety boundary

This is a development reference instrument. GPS remains the RPM-learning authority. Contact/audio may set `learningEligible` only after its engine-sound validation gate passes. Camera RPM remains disabled. No production MotoLab file is changed here.

