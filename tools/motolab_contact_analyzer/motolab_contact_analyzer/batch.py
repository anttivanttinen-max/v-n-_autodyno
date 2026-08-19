from __future__ import annotations

import csv
import json
from pathlib import Path

from .analysis import AnalysisConfig, analyze_signal
from .io import SUPPORTED_SUFFIXES, load_signal


def analyze_directory(directory: str | Path, output_dir: str | Path, config: AnalysisConfig, *, sample_rate: float = 48_000, raw_dtype: str = "int16") -> list[dict[str, object]]:
    source_dir = Path(directory)
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, object]] = []
    for source in sorted(p for p in source_dir.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES):
        try:
            loaded = load_signal(source, sample_rate=sample_rate, raw_dtype=raw_dtype)
            result = analyze_signal(loaded, config)
            row = {"source": str(source), "status": "ok", **result.summary()}
            candidate_path = destination / f"{source.stem}.candidates.json"
            candidate_path.write_text(json.dumps([vars_candidate(c) for c in result.candidates], indent=2), encoding="utf-8")
        except Exception as exc:  # batch mode records failures and continues
            row = {"source": str(source), "status": "error", "error": str(exc)}
        rows.append(row)
    summary_path = destination / "batch-summary.json"
    summary_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    fields = sorted({key for row in rows for key in row if key != "config"})
    with (destination / "batch-summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key) for key in fields})
    return rows


def vars_candidate(candidate: object) -> dict[str, object]:
    return {name: getattr(candidate, name) for name in ("time_s", "duration_s", "peak_z", "band_energy", "confidence")}

