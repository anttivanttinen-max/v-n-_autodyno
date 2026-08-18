# BUILD ME — RPM-BT V1

V1 is a **non-contact inductive ignition pickup**. It never connects electrically to the spark-plug conductor. A few turns of insulated pickup wire sense the ignition field, a protected transistor stage makes a clean 3.3 V pulse, and an ESP32-S3 sends RPM over BLE.

## Build order

1. Check the parts in [BOM.md](BOM.md) against the recorded Partco inventory. Exact physical stock still has to be verified at the bench.
2. Build the protected 3.3 V 74HC14 Schmitt input using [PLACEMENT_GUIDE.md](PLACEMENT_GUIDE.md) and [WIRING.md](WIRING.md). Keep the high-impedance pickup side short and away from the ESP32 antenna.
3. With no pickup attached, verify **3.0–3.3 V** at GPIO4. Never apply 5 V to GPIO4.
4. Install Arduino IDE and ESP32 platform **3.3.11**. The required BLE and LittleFS libraries ship with that core. Select the exact ESP32-S3 N16R8 board profile (16 MB flash / 8 MB PSRAM when offered).
5. Flash `firmware/rpm_bt_sensor/rpm_bt_sensor.ino`. Open Serial at 115200 only for debugging.
6. Preferred Windows logger: run `tools/windows/INSTALL.bat` once and then `RUN_RPM_BT.bat`. The no-install Web Bluetooth viewer in `tester/start_tester.cmd` is a lightweight fallback.
7. Start with **3 turns**, engine off test first, then idle. Increase to 5–6 turns only if pulses are missed; reduce turns or move away from the cap/coil if noise pulses appear.
8. Keep `pulsesPerRev=1.0` for the initial typical single-cylinder 2T hypothesis, but calibrate it per [TEST_PLAN.md](TEST_PLAN.md).

Do not road-test loose wiring. Stop if insulation is damaged, the enclosure becomes hot, the cable can touch exhaust/moving parts, the engine misfires, or the ESP32 resets repeatedly.

