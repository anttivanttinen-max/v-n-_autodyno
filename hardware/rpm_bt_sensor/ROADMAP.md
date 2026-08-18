# RPM-BT roadmap

## Now — buildable V1

- Non-contact 3–6 turn pickup, protected NPN shaper, ESP32-S3 firmware, BLE developer tester and fixed field protocol.
- Bench/static tests, then stationary engine and GPS-authority shadow logging.
- User builds, flashes and tests the physical unit; repository work cannot replace oscilloscope/vehicle safety validation.

## After first captures

- Select final turn count/placement and adjust C1/min spacing only from captured noise and missed-pulse evidence.
- Calibrate PPR per vehicle/ignition and validate on held-out points/remount.
- Add a compact binary BLE v2 only if Web Bluetooth throughput/latency requires it.
- Design a small PCB with creepage/layout review after input amplitude has been measured behind R1/R2.

## Gate before MotoLab adapter

- TEST_PLAN acceptance met on multiple sessions and a remount.
- Confidence reliability and PPR/setup identity demonstrated.
- Explicit user permission. First adapter remains GPS-authority shadow mode with kill switch; no production deployment.

## Research only / fallback

- Contact accelerometer, piezo or BT earbud/microphone may be studied as a secondary engine signature.
- They are **not V1 primary**, do not replace the inductive pickup, and cannot enter learning until independently validated against engine/reference RPM.
- Camera stays excluded.

