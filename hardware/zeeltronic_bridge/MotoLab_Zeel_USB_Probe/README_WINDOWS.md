# MotoLab Zeeltronic ESP32-S3 bridge v2.3

This firmware is a development-only, read-only-safe USB-to-BLE transport probe. It does not change the MotoLab production application.

## Hardware ports

- ESP32-S3 native USB-OTG port: Zeeltronic PC-USB cable, FTDI VID `0403`, PID `6001`.
- Board Single Serial / CH343 port: Windows PC for compile, upload and the lossless debug/capture log.
- Use an ESP32-S3 N16R8 board profile. The USB host port must supply the FTDI cable's required VBUS power.

Do not connect the Zeeltronic cable to the native USB port until the firmware is uploaded and the serial monitor shows `USB CLIENT READY`.

## Arduino IDE 2.x setup (Windows)

1. Install Arduino IDE 2.x.
2. In Boards Manager install **esp32 by Espressif Systems 3.3.11**.
3. Open `MotoLab_Zeel_USB_Probe.ino`.
4. Select an ESP32-S3 N16R8-compatible board. For a generic board use **ESP32S3 Dev Module**.
5. Set **Flash Size: 16MB**, **PSRAM: OPI PSRAM**, and **USB Mode: Hardware CDC and JTAG** when these options are present. Keep the debug/upload connection on the board's Single Serial/CH343 connector.
6. In Windows Device Manager, expand **Ports (COM & LPT)** and identify the COM port whose device name contains `CH343` or `Single Serial`. Do not guess the number; unplug/replug that connector if identification is unclear.
7. Select that detected COM port in Arduino IDE and click **Verify**. A successful build must identify esp32 platform version `3.3.11` in the build output.
8. Click **Upload**. If automatic boot fails, hold **BOOT**, tap **RESET**, start Upload, then release BOOT when the upload begins.
9. Open Serial Monitor at **115200 baud** on the same CH343 COM port.

The native USB-OTG connector is not the debug/upload port in this setup. A changing Windows COM number is normal; always select the currently detected CH343 port.

## First read-only test

1. Reset the ESP32-S3 and save all Serial Monitor output.
2. Confirm `SAFE=READ_ONLY`, `USB HOST READY`, and `USB CLIENT READY`.
3. Connect only the Zeeltronic PC-USB cable to the native USB-OTG host port.
4. Confirm descriptor line `VID=0403 PID=6001`, then `FTDI READY` and `FTDI CONFIGURED 115200 8N1 MODE=READONLY`.
5. Scan Bluetooth LE for `MotoLab-Zeel` and connect to service `7d7d0001-7a45-4545-4c54-524f4e494301`.
6. Enable notifications for RX `...0003` and STATUS `...0002`. Read CFG `...0005`; it must report `BAUD=115200;MODE=READONLY`.
7. Write ASCII `STATUS` to CFG. Verify counters arrive on STATUS and in the CH343 log.
8. Write a harmless sample byte to TX `...0004`. It must not reach USB: the log must contain `CAP,...,TX_BLOCKED,...` and `TX BLOCKED READ-ONLY`.
9. Disconnect and reconnect the FTDI cable. CFG must still report READONLY and the log must show `WRITE RELOCKED` followed by a new `FTDI READY` session.

## BLE characteristics

| Characteristic | UUID suffix | Direction | Purpose |
|---|---:|---|---|
| STATUS | `0002` | ESP32 to client | State, errors and counters (read/notify) |
| RX | `0003` | ESP32 to client | Raw FTDI payload after the two FTDI status bytes (read/notify) |
| TX | `0004` | Client to ESP32 | Raw payload; logged and blocked while read-only |
| CFG | `0005` | Both | Configuration and explicit safety control |

CFG accepts `STATUS`, `INFO`, `BAUD=9600|19200|38400|57600|115200|230400|460800|921600`, `LOCK`, and the exact explicit command `UNLOCK_WRITE_I_ACCEPT_RISK`. Unlock is temporary: reset or USB disconnect always relocks writes.

## Capture records

Keep the CH343 serial log as the source of truth. Relevant machine-readable lines are:

```text
CAP,<monotonic-ms>,RX,<length>,<hex bytes>
CAP,<monotonic-ms>,TX,<length>,<hex bytes>
CAP,<monotonic-ms>,TX_BLOCKED,<length>,<hex bytes>
FTDI_STATUS,<monotonic-ms>,<status0 hex>,<status1 hex>
```

BLE is convenient for live transport, while the separate serial log preserves descriptors, FTDI status bytes, errors, reconnects and blocked writes for protocol analysis.

## Later bidirectional bridge test

Do this only after read-only enumeration, RX, BLE notifications, blocked-TX and reconnect tests all pass. Write the exact unlock command to CFG, verify `WRITE UNLOCKED - BRIDGE MODE`, then use TX for controlled raw packets. Send `LOCK` immediately after the test. Never use unknown commands against a powered CDI.

