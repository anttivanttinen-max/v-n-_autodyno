# RPM contact reference — v32 sync

## Validated mounting reference
Primary contact-reference mounting for BT earbud/AirPod vibration tests:
- cylinder/head stud uses an extension nut
- BT earbud is shimmed tightly to the extension nut with aluminium
- keep these measurements separate from older stud tests made without the extension nut

## Strong reference measurement
A run labelled `7000` was independently estimated to be approximately **6600 rpm**.

Contact audio result:
- average RPM: **6591 rpm**
- confidence: **92.2 %**
- fundamental f0: approximately **109–112 Hz**
- harmonic family: approximately **220 / 330 / 440 / 550 / 660 Hz**

Interpretation: this is strong evidence that the mechanically coupled contact signal follows engine speed rather than a single fixed resonance.

## Algorithm implications
1. Prefer a harmonic-family candidate whose spacing agrees with f0, not merely the largest FFT peak.
2. Continuity gate must penalize impossible sample-to-sample RPM jumps.
3. GPS + learned gear ratio is an independent plausibility reference when available.
4. Contact BT audio can be treated as a high-value RPM candidate when harmonic confidence and continuity are both good.
5. Preserve raw audio-derived candidates, f0, harmonics, confidence and rejection reason so future algorithms can reprocess old runs.
6. Do not merge old no-extension-nut tests into the new contact-reference calibration set.

## Current exclusions
- Camera RPM remains disabled.
- Phone internal microphone is not a validated RPM source until its RPM algorithm is separately corrected and tested.
