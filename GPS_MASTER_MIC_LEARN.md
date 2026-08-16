# GPS MASTER + MIC LEARN — v32

Test strategy for first road pulls:

- GPS/speed + selected gear is the only RPM authority used by the measurement worker.
- BT microphone runs in parallel as a shadow/learning sensor.
- MIC RPM must not alter displayed/recorded control RPM, run acceptance or gear learning in this mode.
- GPS reference can come from a saved gear calibration or from profile drivetrain data (primary ratio, selected gear ratio, final ratio and wheel circumference).
- Learning RAW rows retain synchronized GPS reference and MIC observations: timestamp, speed, gear, GPS reference RPM/confidence, MIC RPM/raw RPM, f0, fingerprint score, candidate gap, runner-up RPM, level, delta RPM, percent error and MIC/GPS ratio.
- Existing GPS ONLY, BT MIC ONLY and AUTO FUSION modes remain available.
- Camera RPM remains disabled.
- Phone internal microphone remains unvalidated; the intended learning input is the selected external/BT microphone.

The purpose is to collect reusable synchronized road data before allowing audio RPM to influence the measurement result.
