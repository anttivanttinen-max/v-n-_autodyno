# RPM sensor — superseded dual-channel firmware concept

> The implemented inductive V1 firmware and protocol are in [`hardware/rpm_bt_sensor/`](../../rpm_bt_sensor/FIRMWARE.md). This contact/RAW architecture is retained as an optional future research design, not V1 primary.

## Runtime architecture

Acquisition has the highest priority and no dependency on BLE, UI or filesystem latency.

1. ADC DMA task fills fixed buffers and stamps them with the monotonic microsecond clock.
2. Timer capture task records inductive edges into a lock-free/ring queue.
3. Feature task performs DC removal, filtering, spectral/periodicity candidates and signal-health metrics on overlapping windows.
4. Tracking task applies harmonic scoring, continuity, dropout and confidence rules.
5. Logger appends RAW/features/decisions to bounded chunks with CRC and config hashes.
6. BLE task publishes summaries and drains requested RAW chunks at lower priority.
7. Health watchdog records resets, queue overruns, clock discontinuities and thermal/power flags.

Use preallocated memory in the acquisition path. If overloaded, drop derived work/telemetry before raw edge timing; increment explicit counters. No dynamic model training runs on the node during measurement.

## Time and frame model

- Device monotonic time: uint64 microseconds since boot.
- Session UUID and boot ID distinguish resets.
- Summary cadence: 10 Hz nominal, sequence-numbered.
- Feature windows: 200–500 ms with overlap; exact window metadata is reported.
- Phone performs periodic two-way time sync and estimates offset/uncertainty. Never replace device timestamps with BLE receive time.

## BLE GATT service

Use a versioned custom service UUID, finalized in implementation. Characteristics:

- capabilities (read): protocol/schema versions, hardware ID, sensor channels, sample rates, maximum payload.
- control (write with response): start/stop session, config proposal, raw-window request, time-sync request.
- control_response (indicate): request ID, accepted/rejected, reason, applied config hash.
- rpm_summary (notify): compact fixed binary frame.
- event (indicate): boot, fault, calibration/config change, mount/session marker.
- raw_chunk (notify): chunked compressed/packed observations with CRC; resumable by chunk/offset.
- log_index (read/indicate): sessions/chunks available and loss status.

## Summary frame v1

All multibyte fields are little-endian. Units are explicit and integers avoid float ambiguity.

| Field | Type | Meaning |
|---|---|---|
| protocol_version | u8 | 1 |
| message_type | u8 | summary |
| flags | u16 | valid/predicted/clipped/dropout/contact/inductive/GPS-join-ready |
| sequence | u32 | increments per summary |
| boot_id | u32 | reset discriminator |
| t_device_us | u64 | end timestamp |
| rpm_selected_x10 | u32 | selected RPM, 0 when invalid |
| rpm_raw_contact_x10 | u32 | best contact candidate |
| rpm_inductive_x10 | u32 | pulse candidate |
| rpm_runner_x10 | u32 | distinct runner-up |
| confidence_x100 | u16 | 0–10000 |
| candidate_gap_x100 | u16 | normalized separation |
| f0_millihz | u32 | contact fundamental |
| pulses_per_rev_x1000 | u16 | active hypothesis |
| queue_overruns | u16 | cumulative acquisition health |
| raw_chunk_id | u32 | evidence linkage |
| config_hash32 | u32 | applied configuration |
| crc16 | u16 | frame integrity |

Rejection reason bits are published in an extension/event when invalid: unverified_engine_signal, low_level, clipping, harmonic_ambiguous, jump, dropout, pulse_bounce, source_disagreement, calibration_missing, thermal, acquisition_overrun.

## Control and safety

- Configuration changes are proposal/acknowledgement transactions and take effect only at a frame boundary.
- Start response includes the full applied config hash and calibration ID.
- Unknown protocol/schema versions fail closed.
- BLE disconnect never stops acquisition/logging; reconnect resumes by chunk ID.
- RAW deletion, firmware update and calibration promotion are separate authenticated/physical-presence operations in later phases; not part of v1 road measurement.

## Host integration boundary

The first host tool is a developer recorder/decoder, not production MotoLab. It stores BLE frames losslessly, performs time alignment with GPS, exports documented JSONL/CBOR and can replay a session through later algorithms. A future MotoLab adapter must be separately approved and consume the same immutable protocol rather than importing sensor internals.

