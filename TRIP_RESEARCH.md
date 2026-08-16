# VÄNÄ MotoLab — 3rd gear full-trip GPS + MIC research

Baseline: MotoLab v32.4. GPS MASTER behavior is unchanged.

## Purpose
Record a long 3rd-gear road session so microphone candidate/harmonic branches can be compared against GPS-derived reference RPM over the complete drive, including acceleration, steady throttle and deceleration.

## Control authority
- GPS/speed + selected 3rd gear remains the RPM authority.
- BT MIC is shadow/research data only.
- Research logging does not change run acceptance or gear learning authority.

## Captured data
- GPS timeline at 5 Hz: speed, speed-RPM reference/confidence, GPS accuracy, acceleration and timestamp.
- Audio candidate frames at up to ~6–7 Hz after research throttling.
- The complete scored candidate set produced by the current audio estimator, not only winner and runner-up.
- Candidate compact format: `[rpm, observedHz, rawRpm, correlation, fingerprintScore, totalScore, multiplier]`.
- Current audio winner/raw/runner/confidence/f0/fingerprint/level alongside each candidate frame.
- The selected BT microphone MediaStream recorded continuously by MediaRecorder and persisted in 5-second IndexedDB chunks.
- Profile/release/audio-device metadata and timestamps.

## Storage and export
Research data uses a separate `VanaMotoLabResearch` IndexedDB so normal runs/RAW storage remain untouched. The export action produces a JSON timeline/manifest plus one combined audio file and uses the iPhone share sheet when available.

## Test workflow
1. Select the intended BT microphone if not already selected.
2. Open Measurement and press `ALOITA 3. VAIHDE` in the research panel.
3. MotoLab selects GPS MASTER + MIC LEARN and gear 3, starts GPS and BT MIC, then records the whole trip.
4. Ride only in 3rd gear for the research session and deliberately cover low, middle and high RPM repeatedly with acceleration, steady throttle and deceleration.
5. Press `STOP & TALLENNA`.
6. Press `VIE VIIMEISIN • JSON + AUDIO` and send both files for offline candidate-track analysis.

The exported data is intended to find candidate curves that repeatedly follow GPS RPM, including candidates that the current selector did not choose as its winner.
