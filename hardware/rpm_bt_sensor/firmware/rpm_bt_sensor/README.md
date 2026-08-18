# Firmware build and configuration

Target: Arduino-ESP32 3.3.11, ESP32-S3 N16R8. The sketch uses only libraries shipped with the ESP32 Arduino core (`BLE`, `LittleFS`, task watchdog).

Before flashing, confirm `PIN_RPM`, `PIN_STATUS_LED` and `PIN_BUTTON` against the exact carrier board. GPIO4 is deliberately chosen as the default sensor input; GPIO0 and GPIO48 are optional.

The default assumes one accepted ignition pulse per crank revolution. That is not universal. Set `pulsesPerRev` with the Windows tool/config characteristic using a trusted tach/GPS drivetrain comparison. Common wasted-spark and multi-cylinder arrangements can differ; do not treat a generic value as fact.

LittleFS session files are a recovery/debug copy. v1 does not expose file download over BLE; the Windows logger is the primary retrievable record. Enable `raw` only for short diagnostics.

Known v1 limits: no OTA, no persistent config, no analog/audio acquisition, and no battery monitoring. These are deliberate safe defaults for the first reference build.

