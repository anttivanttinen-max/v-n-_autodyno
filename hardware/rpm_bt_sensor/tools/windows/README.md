# Windows logger

1. Install current Python 3 from python.org with **Add Python to PATH** selected.
2. Double-click `INSTALL.bat` once.
3. Double-click `RUN_RPM_BT.bat` for an open-ended recording (Ctrl+C stops), or `RUN_60S_TEST.bat` for a one-minute test.

Each session produces CSV and JSONL under `sessions`. Live output shows validity, RPM, confidence, raw frequency and sequence. For GPS comparison, prepare a CSV with columns `host_unix_ms,gps_reference_rpm` and run:

```text
.venv\Scripts\python.exe rpm_bt_tool.py --gps-csv gps_reference.csv
```

Replay an existing file with `--replay sessions/file.csv`. Set a verified ignition scale temporarily with `--pulses-per-rev 1.0`. The logger never promotes the BLE sensor over GPS; it only calculates synchronized comparison error.

