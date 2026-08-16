# V31 sprint result

## Implemented today
1. Runtime-blocking UI bug fix (`demoBtn`).
2. Duplicate control-ID fix and AutoRide/settings synchronization.
3. RPM candidate ambiguity protection (`candidateGap`, `runnerRpm`).
4. Candidate diagnostics exposed in live BT f0 / FP display.
5. Candidate diagnostics retained in learning data.
6. Vehicle / Engine Knowledge Base added to Smart Bike Profiles.
7. Legacy profiles automatically normalize into the new KB schema without deleting old data.
8. Run snapshots now contain Knowledge Base, setup signature, app version and algorithm versions.
9. Learning chunks upgraded to v2 with app/algorithm/profile snapshots.
10. Learning flush concurrency guard added.
11. Raw session metadata updated on successful chunk writes.
12. Profile + Knowledge Base JSON export added.
13. Internal self-test expanded to catch duplicate IDs and missing critical controls.
14. PWA Service Worker added with network-first navigation and cached core assets.
15. Manifest advanced to v31.

## Deliberately not faked
Physical iPhone/BT/GPS testing has not been marked PASS. The container's Chromium headless process did not exit cleanly in this environment, so browser-device behavior still needs a real phone test.
16. Kokeellinen ignition AUTOTUNE siirretty developer-only-tilaan; julkinen navigaatio ei paljasta ominaisuutta.
