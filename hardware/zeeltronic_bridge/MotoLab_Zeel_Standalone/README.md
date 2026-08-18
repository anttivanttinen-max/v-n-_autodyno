# MotoLab Zeel Standalone v3

ESP32-S3 USB-host bridge for using a Zeeltronic PCDI-10VT from a phone without a computer.

## Phone connection

- Wi-Fi SSID: `MotoLab-Zeel`
- password: `motolab10`
- address: `http://192.168.4.1/`
- BLE advertising remains available as `MotoLab-Zeel` for diagnostics.

## Hard safety boundary

- Arbitrary FTDI writes are hard-disabled at compile time.
- There is no HTTP or BLE command that unlocks Program mode.
- The only FTDI transmissions allowed by the standalone reader are the captured Read selectors
  `61 F0 01`, `61 00 00`, and poll byte `64`.
- Every received value must be preceded by marker `3D`; a mismatch or timeout aborts the read.
- A successful read returns exactly 480 bytes and can be downloaded as an immutable `.bin` snapshot.

## Required hardware

- ESP32-S3 N16R8 board with separate COM and native USB-OTG ports.
- Zeeltronic PC-USB cable, FTDI VID/PID `0403:6001`, connected to native USB-OTG.
- Stable regulated 5 V supply for ESP `5Vin/GND` and USB-host VBUS.
- Do not feed raw vehicle voltage to ESP or USB VBUS.

## Acceptance tests before any write-capable firmware

1. Build succeeds with Arduino-ESP32 3.3.11.
2. Boot log reports Wi-Fi, BLE, USB host and USB client ready.
3. FTDI enumeration reports exactly `0403:6001`.
4. Phone Read returns 480 bytes.
5. SHA-256 equals the computer baseline for unchanged CDI settings.
6. Repeated reads are byte-identical.
7. Disconnect/reconnect relocks and recovers cleanly.
8. Snapshot, readback and rollback are demonstrated before designing a separate write firmware.

Current known baseline SHA-256: `9fc906d6f9141c79d4f217dadfcce1a56632e204a0c48f2c385145df11c181d0`.
