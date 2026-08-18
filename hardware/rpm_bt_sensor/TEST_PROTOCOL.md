# Calibration and test protocol

The numeric gates are first-development targets, not claims of achieved performance. Measure them before considering integration.

## Required session metadata

Bike/engine, 2T/4T, cylinder count, ignition type, assumed pulses/rev, pickup turns, front-end parts, firmware SHA, power source, enclosure location, GPS device/accuracy and contact-reference mounting.

## 1. Bench pulse generator

- Feed a 0–3.3 V square wave only at Schmitt OUT/GPIO side, never into PICKUP terminals: 10, 25, 50, 100, 200 and 300 Hz.
- For 1 pulse/rev expected RPM is frequency × 60.
- Pass: median error <=0.5%, 95th percentile latency <=200 ms, no accepted harmonic/octave error, dropout <0.2% over 5 minutes per point.

## 2. Engine off / EMI

- Ignition off, electronics on for 5 minutes; then ignition on without starting for 2 minutes; operate lights, brake and starter briefly.
- Pass: reported `valid` RPM for less than 0.1% of samples and never continuously for >300 ms. If it fails, routing/front-end must be fixed; do not hide it with confidence alone.

## 3. Idle and steady points

- Warm engine. Hold at least three safe points for 30 seconds each. GPS is not suitable at stationary idle, so compare to a verified shop tach/strobe if available and log the contact reference in parallel.
- Pass target: median error <=1.5% above 1500 RPM (<=3% at unstable idle), 95% error <=3%, dropout <1%, confidence median >=80.

## 4. Sweep and harmonics

- Make five slow sweeps and five quick safe sweeps over the operating range. Include throttle close and restart.
- Pass: no sustained 0.5×/2× lock longer than 300 ms; jump rejection recovers within 500 ms; median latency <=200 ms and p95 <=350 ms; valid-sample median error <=2% against synchronized reference.

## 5. Dropout injection

- Disconnect the pickup at a steady simulated/real point, then reconnect.
- Pass: validity clears within 500 ms; no stale RPM after invalid; reacquisition within 1 s at steady RPM; dropout flag and log event present.

## 6. Contact engine validation

- Record engine-off ambient/vibration, idle, steady points and sweeps with the extension-nut/aluminium-shim mount.
- Engine validation requires: harmonic family spacing consistent with f0; SNR/level above engine-off baseline; continuity; no engine-off false valid interval >300 ms; and at least 60 seconds of moving GPS/reference comparison with median error <=3%, p95 <=6%, correct 0.5×/2× family in >=99% of eligible windows.
- Until all gates pass, audio is `valid` only as a candidate if desired, but always `learningEligible=false`.

## 7. Road test

- First ride uses battery-pack power. Logger records BLE plus synchronized GPS CSV/JSONL. GPS remains learning/control authority.
- Perform steady-speed segments in a selected gear, gentle sweep, normal pull, throttle close and a radio-obstruction test.
- Pass target: connection/session completeness >=99%, measurement dropout <1% excluding known radio obstruction, p95 end-to-end latency <=350 ms, RPM error median <=2% and p95 <=5% where GPS drivetrain reference is reliable.

## Decision

Passing these gates permits a shadow sensor-hub experiment only. Production or control authority still requires explicit user approval and a separate review.

