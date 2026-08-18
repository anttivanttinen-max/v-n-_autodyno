# VÄNÄ MotoLab external RPM reference — superseded design note

> **V1 decision (2026-08-18):** the primary sensor is now the non-contact inductive pickup wrapped around the insulated spark-plug lead. The buildable design, exact protection circuit, firmware and tester live in [`hardware/rpm_bt_sensor/`](../../rpm_bt_sensor/BUILD_ME.md). The contact-vibration and BT microphone material below is retained only as research history/fallback and is not V1 primary.

## Scope and non-negotiable rules

This package defines a separate, lightweight RPM sensor, not a production MotoLab integration. Its output is an evidence-bearing external reference: every RPM value must remain traceable to timing/audio observations, quality metrics, calibration and rejection decisions.

- GPS is the authority during RPM learning. Sensor RPM is shadow data until acceptance gates are met.
- Audio/contact data may enter learning only after the signal itself has been verified as engine-related.
- Camera RPM is excluded.
- Measurement continuity and low runtime cost have priority over UI features and model complexity.
- No production MotoLab integration or control authority without explicit user approval.
- Gear learning consumes only accepted GPS-authority samples; the new sensor may be evaluated alongside them but may not teach gears during the learning phase.

## Evidence already available

The preferred mechanical contact location is the cylinder/head stud extension nut. A BT earbud/AirPod was shimmed rigidly to it with aluminium. In an independently estimated ~6600 rpm run, contact audio averaged 6591 rpm with ~92.2% confidence; f0 was ~109–112 Hz with a coherent ~220/330/440/550/660 Hz harmonic family. This is strong evidence of speed-following vibration, but it is one mounting/data set, not yet a production calibration. Older tests without the extension nut must remain a separate cohort.

## Options

| Option | Strengths | Weaknesses / hazards | Role |
|---|---|---|---|
| Rigid contact vibration, wired accelerometer/piezo | Mechanically selective, preserves raw waveform, no ignition wiring, good evidence from existing mount | Mount resonance, heat, cable strain, harmonic ambiguity | Recommended v1 primary |
| BT earbud/AirPod contact audio | Existing strong observation, quickest proof path, no custom analog board | OS/codec latency, AGC/noise suppression, packet gaps, consumer device heat/retention, weak timing determinism | v0 validation and comparison only |
| Inductive coil/HT pickup | Direct pulse timing, low compute, excellent independent cross-check when safely conditioned | High-voltage transients, EMI, wasted-spark/pulses-per-rev ambiguity, installation varies by ignition | Recommended v1 secondary/reference input |
| Hall sensor | Deterministic pulse source | Requires safe target/magnet and bracket; rotating-part and balance risk | Optional bench/reference only unless a safe existing target exists |
| Optical sensor | Clean bench pulses | Dirt/light/line-of-sight and rotating marker make road use fragile | Dyno/bench calibration only |

## Historical recommendation (superseded)

This earlier two-channel proposal is no longer the V1 build. The active V1 uses only the protected inductive pulse path; contact sensing may be evaluated separately later.

The historical proposal was:

1. Primary contact vibration: a low-mass, rigidly mounted analog accelerometer on an aluminium adapter at the extension nut. Prefer ADXL1002-class analog bandwidth when available; validate a lower-cost piezo/contact disc path in parallel before freezing the BOM.
2. Secondary inductive pickup: non-invasive lead/coil pickup into protected Schmitt conditioning. It supplies pulse-period evidence and helps disambiguate 0.5x/1x/2x contact harmonics; it is not electrically connected to the ignition primary in v1.

The BT earbud repeats the known experiment as a baseline, but the wired contact channel is the intended reference because it gives deterministic timestamps and control of gain/filtering. Hall/optical stay out of the vehicle v1 unless a safe, existing target removes bracket and rotating-mass risks.

## Mechanical design

- Use a dedicated extension nut/adapter; do not load or loosen the engine fastener to tune the sensor.
- Clamp the sensor through a thin aluminium shim/adapter with repeatable torque and keyed orientation.
- Put electronics away from the hottest surface; use a short shielded/twisted sensor lead, strain relief and a service loop.
- Record mount ID, adapter revision, orientation, torque class and whether the extension nut is present.
- Add a witness mark and pre/post-run photo/check. Reject learning if the mount moved, cable struck the frame, or clipping/thermal limits were exceeded.

## Signal chain and estimator

Contact path: sensor -> input protection/bias -> anti-alias low-pass -> ADC/DMA -> DC removal -> band-limited analysis. Keep a low-rate envelope and selected raw waveform windows. Use 8–12 kHz sampling initially; evaluate 4 kHz only after confirming no useful evidence is lost.

Inductive path: pickup -> current limiting/transient clamps -> hysteretic comparator/isolator as required -> timer capture. Store edge timestamps and pulse polarity/width diagnostics, not only calculated RPM.

Each 100 ms output frame uses overlapping windows and produces candidates, never a single opaque FFT answer. Candidate evidence includes spectral peak, harmonic-family spacing, autocorrelation/cepstral periodicity, inductive period, continuity and GPS plausibility.

## Harmonic, jump and dropout rejection

- Score 0.5x, 1x and 2x hypotheses plus limited integer harmonic families; require multiple agreeing harmonics when using contact vibration.
- Compare the best candidate with the best genuinely distinct runner-up; a small candidate gap lowers confidence.
- Use a bounded acceleration model based on elapsed time, not a fixed rpm/sample threshold. A candidate outside the physical envelope is rejected unless repeated evidence establishes a new track.
- Require 2–3 confirming frames before a harmonic switch. Never interpolate across a confirmed gearshift as though it were sensor continuity.
- Short dropout: hold prediction for at most 150 ms and mark predicted; do not emit it as measured evidence. Longer dropout emits invalid/no-RPM.
- Detect clipping, near-silence, frozen samples, repeated BLE sequence numbers, timer overflow, pickup bounce and impossible pulse density.
- A low-confidence value is not silently smoothed into a high-confidence value. Store raw candidates and the selected/rejected state separately.

## Confidence

Confidence is 0–100 plus explicit flags. It is the calibrated probability-like quality of this frame, not cosmetic stability. Initial components: signal health 20%, periodicity 20%, harmonic-family agreement 20%, continuity 15%, independent inductive agreement 15%, GPS plausibility 10%. Missing optional evidence re-normalizes weights but caps confidence; clipping, prediction and source disagreement impose hard caps.

Suggested caps: prediction <=35, contact-only without verified engine signature <=0 for learning, contact-only verified <=85, inductive-only with unknown pulses/rev <=60. Confidence calibration is later measured with reliability plots; thresholds remain configuration-versioned.

## GPS cross-validation and calibration

GPS reference RPM is derived from speed plus selected gear using drivetrain/profile ratios or a saved gear calibration. During learning it is the authority, but only in steady, high-quality windows: valid accuracy, sufficient speed, known gear, no clutch slip/shift, and limited wheel slip/acceleration transients.

Calibration sequence:

1. Static health/noise check with engine off.
2. Idle and stepped stationary holds to verify signal follows engine changes; if available compare with trusted service tach/inductive path.
3. GPS-master road pulls in known gears; sensor remains shadow-only.
4. Fit pulses-per-rev and contact harmonic mapping per vehicle/setup/mount. Never choose a multiplier merely because it makes one run agree.
5. Validate on held-out runs and a remount before marking the calibration usable.

## User-specific learning

Learning state is keyed by user/profile, vehicle ID, setup signature, sensor hardware ID, firmware/algorithm version and mount ID. Store priors for pulses/rev, reliable band, harmonic preference, noise floor, gain and latency. Promotion requires diverse accepted sessions and held-out validation; rollback preserves the previous model. No cross-user sharing by default, and no learning from unverified audio, rejected frames, predicted samples, unknown gear, clutch slip or poor GPS.

## Gear-learning compatibility

The node publishes synchronized timestamps and source latency so MotoLab can join RPM evidence to GPS speed. In GPS-authority mode, gear learning remains GPS/profile-controlled. After separate approval, an accepted external reference could validate ratios, but it must never create a gear ratio from a harmonic candidate without GPS agreement and stable known-gear segments.

## RAW evidence contract

Preserve session metadata, monotonic/device time sync, calibration/config hashes, mount/setup identity, ADC rate/gain, waveform window references, spectral/autocorrelation candidates, inductive edges, selected RPM, runner-up, confidence components, rejection flags, GPS join fields, firmware resets and BLE loss counters. RAW is append-only for a session; derived algorithms write a new versioned result rather than rewriting observations.

