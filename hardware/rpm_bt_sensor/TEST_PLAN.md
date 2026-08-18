# RPM-BT V1 test plan

The tester saves CSV and JSONL. Record pickup turns, placement, PPR, firmware commit, engine/ignition type, reference instrument, temperature and test name for every file. GPS is authority during learning; stationary points need a trusted tach/reference.

## Sequence

1. **Electrical/engine off, 2 min:** GPIO idle 3.0–3.3 V; RPM must remain 0. Operate BLE/phone, touch enclosure and move nearby wiring without touching HT. Target: zero valid false RPM frames.
2. **Idle, 60 s:** stable detection without ESP reset/misfire. Compare reference median, notification sequence gaps and noise ratio.
3. **Steady 3k/6k/9k, 30 s each** where safe: enter reference RPM in tester; exclude reference transitions from steady scoring.
4. **Sweep:** at least three controlled idle→high→idle sweeps. Check half/double RPM, jump rejection and response delay.
5. **EMI/noise:** lights/charging/radio on/off, move (not disconnect) routed cable, BLE reconnect. Acquisition must continue and invalid data must fail closed.
6. **Turns comparison:** 2, 3, 5 and 6 turns at the same placement. Select the fewest turns meeting dropout/noise targets. Do not tune PPR to hide double triggers.
7. **Placement/remount:** repeat selected setup after a complete removal/remount and thermal cycle.
8. **Dropout:** disconnect BLE for 60 s, reconnect; then temporarily remove pickup with engine safely off and confirm engine-off within 600 ms.

## Metrics and acceptance for prototype V1

- Steady eligible windows: median absolute RPM error ≤3%; 95th percentile ≤5%. A GPS-derived reference inherits drivetrain/GPS uncertainty, so the earlier 1.5% proposal was too strict for first field proof.
- Transient samples after time alignment: median error ≤5%; no accepted persistent 0.5×/2× track over 200 ms.
- Sensor pulse dropout in steady windows <1%. BLE notification loss is scored separately using `seq`; it must not stop acquisition.
- Host display latency: median <100 ms and p95 <150 ms, measured from an observable RPM step. V1's 50 ms publish interval makes a strict universal <100 ms p95 unrealistic over Web Bluetooth.
- Engine-off false positives: zero `valid` frames in each 2-minute test.
- No reset, watchdog event, GPIO overvoltage, misfire, damaged insulation, loose routing or unsafe temperature.
- At confidence ≥90, at least 95% of eligible steady samples should be within 5%; otherwise confidence is not yet calibrated and cannot gate learning.

Stop immediately on misfire, arcing, damaged insulation, heat damage, loose mount/cable, repeated reset or unexpected voltage above 3.3 V at GPIO4. Hardware validation requires the user's physical build and instruments; repository tests cannot certify ignition safety.

