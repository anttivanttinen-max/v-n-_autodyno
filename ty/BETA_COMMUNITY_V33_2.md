# MotoLab v33.2 — Beta community, private diagnostics and user rollout

Build: `2026-08-17g-beta-community`

## Released together

- per-user device identity, nickname, pending/active/blocked approval and admin control
- per-user feature permissions and client version/build heartbeat
- nickname-based graphical run sharing without RAW data or edit rights
- compare shared run to a selected own run, including run quality percentage
- compare shared run automatically to the best comparable own run
- direct private feedback to admin
- Beta community / issue bank
- user comments and peer troubleshooting instructions
- `Minulla sama ongelma` reporting into the existing issue
- issue states: open, working, resolved, fixed, not reproduced
- admin can mark a community reply as the working solution
- WhatsApp invite action plus the normal invite/share route
- optional private contact method for WhatsApp, phone, email, Telegram or other route

## Privacy rule

Community users only receive the public issue layer: author nickname, title, written description, category, status, comments and same-problem count.

Technical data is never returned by public community endpoints. Device IDs, contact information, app/device metadata, sensor state, diagnostic events and the approximately 60-second technical history attached to a report are stored in a separate private diagnostics store and are available only through admin-authenticated endpoints.

The diagnostic package does not intentionally capture listenable microphone audio. It captures technical app/sensor state and diagnostic events used to reproduce failures.

## Diagnostic capture

When a user creates an issue or presses `Minulla sama ongelma`, MotoLab attaches a private diagnostic package containing the current release/build, platform metadata, sensor/queue snapshots, recent diagnostic events and a rolling approximately 60-second technical history sampled by the community module.

This allows multiple reports of the same issue to be compared without exposing their technical data to other testers.

## Authority preserved

The release does not intentionally change GPS MASTER authority, RPM calculation, run acceptance, Auto Gear Learn or dyno computation. Community and user features are separate UI/server layers around the existing measurement engine.

## Rollout

PR #15 was merged to `main` with explicit user approval. v33.2 community modules and Railway server preload were then committed directly to `main` as the same approved rollout. Railway status must be confirmed successful before considering the server-side rollout field-validated.
