# MotoLab continuous RAW ZIP stream v1

## Frozen defaults

- Target uncompressed payload per package: **1 MiB (1,048,576 bytes)**.
- Maximum open-package age: **30 seconds**.
- Seal a package when either threshold is reached, whichever happens first.
- RAW collection must never wait for compression or network I/O.
- Preserve the original RAW representation losslessly inside the package.

## Durable state machine

`LOCAL -> SEALED -> QUEUED -> UPLOADING -> SERVER_ACK -> SENT`

A package may only enter `SENT` after the server acknowledges the package and its integrity identifier. A failed upload returns to `QUEUED` with retry metadata intact.

If a queued local package cannot be read, **do not delete it**. Increment its retry diagnostics, move that queue item to the tail, and continue with the next package. Raise recovery state when the condition persists.

## Package identity and integrity

Every package records:

- schema and package format version
- user/device identity references
- `sessionId`
- monotonically increasing `chunkNumber`
- first/last sample timestamps
- creation/seal timestamp
- uncompressed byte count
- compressed byte count
- sample/event counts
- application/release version
- analysis/data schema versions
- phone mount metadata when available
- SHA-256 of the canonical uncompressed RAW payload

The server must verify the supplied SHA-256 before acknowledging receipt. Package identity is idempotent: retrying the same package must not create a second logical chunk.

## Local retention and recovery

The phone is the first durable RAW store. Packages remain locally recoverable until server acknowledgement. Network loss only grows the local queue; reconnect resumes upload automatically.

Expose a manual recovery/export action that can share queued/sealed packages without mutating or deleting the originals.

If pending data remains unsent, expose diagnostics including pending count, oldest pending age, retry count, last error, app version and package IDs. Persistent pending state must be visible to the user and reported to the admin/recovery channel when connectivity permits.

## Compatibility rollout

Do not replace the existing JSON RAW endpoint until the ZIP receiver and client persistence path have both been tested. During rollout, keep the current RAW format as a compatibility/fallback path. Do not change RPM, GPS, audio, IMU or measurement algorithms as part of this transport change.

## Required acceptance tests

1. 1 MiB threshold seals a package.
2. 30 s threshold seals a smaller package.
3. Collection continues while offline and packages queue locally.
4. Reconnect drains the queue.
5. Server rejection never marks a package sent.
6. Missing/unreadable local package moves to queue tail and does not block later packages.
7. Duplicate retry is idempotent.
8. SHA mismatch is rejected and retained for recovery.
9. App restart resumes sealed/pending packages.
10. Manual export does not remove local data.
11. Existing JSON RAW transport remains usable during rollout.
