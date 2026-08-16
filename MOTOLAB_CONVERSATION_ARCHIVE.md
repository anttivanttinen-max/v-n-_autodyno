# VÄNÄ MotoLab — conversation archive and durable project memory

Updated: 2026-08-16

## Purpose
This file is the durable GitHub memory for MotoLab development conversations. Important decisions, test results, constraints, implementation notes, unfinished work, data-analysis findings and cross-thread handoff notes must be copied here so they are not lost when a ChatGPT conversation is closed or becomes unavailable.

## Archiving rule
- Treat GitHub as the source of truth for durable MotoLab project memory.
- Before implementation work, read the latest `main`, `MOTOLAB_SYNC_STATUS.md`, this archive, and relevant technical notes.
- After implementation, append the important decisions, test results, regressions, new files/builds and remaining work here or into the matching dedicated document.
- Do not rely on one chat thread as the only place where a decision exists.
- When two MotoLab conversations run in parallel, both must inherit the same repository state and neither should create a competing "latest" version.
- Raw measurement data belongs in the private `Motolab-data` repository; implementation/project memory belongs in `v-n-_autodyno`.

## Current core constraints
- GPS MASTER remains authoritative during GPS + microphone learning. Microphone data must not alter displayed RPM, run acceptance or gear learning while GPS MASTER is selected.
- Preserve raw/source-specific measurements separately from derived/fused values so old data can be reprocessed later.
- Camera RPM remains disabled unless explicitly reopened as a development topic.
- Microphone RPM development must retain candidate/harmonic information, continuity information and reference comparisons rather than only the finally chosen RPM.
- Measurement continuity and logging reliability take priority over UI smoothness.
- Main development happens on one shared GitHub `main`; always inspect current HEAD before editing.

## Important RAW / microphone findings retained from earlier conversations
- v32.4 / build 2026-08-16h is the earlier RAW baseline for GPS-master and BT/contact microphone comparisons.
- A prior RAW set contained 70 chunks and 14,709 samples.
- GPS-master structure behaved as intended: `rpmControlAuthority = gps` and microphone stayed out of displayed RPM / acceptance / gear-learning authority during the learning phase.
- BT/contact microphone contained real engine-RPM information but candidate/harmonic selection was not yet stable enough to trust alone.
- Useful examples found in RAW included roughly GPS 5191 rpm vs mic 5512 rpm (~6.2% error) and GPS 4261 rpm vs mic 3807 rpm (~10.6% error with lower confidence).
- Harmonic jumping was visible in historical microphone data, which motivated retaining multiple candidate alternatives and continuity tracking.
- Preferred historical contact mounting: extension nut + aluminium shim + tightly coupled BT earbud/contact microphone.
- Strong contact reference: about 6600 rpm truth, 6591 rpm audio average, ~92.2% confidence, f0 about 109–112 Hz and harmonics near 220/330/440/550/660 Hz.

## Data pipeline retained from conversations
- MotoLab stores RAW locally first.
- RAW auto-sync sends new chunks to the Railway receiver when configured.
- Railway mirrors received RAW into private GitHub repository `anttivanttinen-max/Motolab-data`.
- Multi-phone/device data is separated by persistent device identity/labels.
- GitHub data can be analyzed manually at any time; an overnight trainer task also exists for new RAW/research data.
- Night trainer must validate candidate models against held-out/reference data before replacing the accepted model.
- Bad or non-improving models must not replace the accepted model; rollback history must be kept.

## Sensor / microphone UI decisions retained from conversations
- Sensor ON/OFF preferences should persist across app restarts.
- A microphone choice should be directly reachable from the home screen.
- Known/available audio inputs should be selectable; an unavailable previously selected device must not silently fall back to a different microphone and be treated as the same sensor.
- iOS may require a user gesture before opening the audio stream; desired selection/state can persist even when activation waits for a tap.
- Settings/maintenance sections should be collapsible to keep the interface compact.

## Current implementation direction
- GPS-supervised microphone learning should improve candidate/harmonic choice and RPM continuity without weakening GPS MASTER authority.
- Keep raw candidate sets and region-specific behavior so later models can learn 0.5x / 1x / 2x branch preference by RPM region if reference data supports it.
- Auto Gear Learn exists but should only learn from data paths that are explicitly allowed by the selected control mode.
- Existing RAW history should remain usable for later replay/reprocessing.

## Deferred work explicitly parked for later
- Automatic knock/ignition autotune.
- Full Knowledge Base integration across every porting/pipe/carb/ignition tuning calculator.

## Project-wide durable-memory instruction
When a MotoLab conversation contains information that would matter after that conversation ends, archive it in GitHub. This includes at minimum:
1. accepted decisions and constraints,
2. measured test results and reference values,
3. new algorithms and why they were changed,
4. known regressions and fixes,
5. build/version identity,
6. unresolved tasks and intentionally deferred work,
7. RAW-data interpretation notes,
8. deployment/sync architecture changes,
9. cross-thread handoff notes.

Full verbatim chat transcripts are not automatically available through the GitHub connector. Therefore the durable archive stores project-relevant content and decisions, while any transcript that is manually exported/provided can be added under a future `conversation-exports/` directory without replacing these structured notes.
