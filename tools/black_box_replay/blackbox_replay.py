#!/usr/bin/env python3
"""MotoLab Black Box + Replay scaffold.

No external dependencies. This is a safe offline tool: it does not modify MotoLab
production code and never overwrites raw source data.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

SCHEMA = "motolab_blackbox_session_v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def iter_jsonl(path: Path) -> Iterable[Dict[str, Any]]:
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                obj.setdefault("_line", line_no)
                yield obj
            except json.JSONDecodeError as exc:
                yield {"_line": line_no, "_error": str(exc), "raw_line": line}


def load_csv_rows(path: Path) -> Iterable[Dict[str, Any]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        yield from csv.DictReader(f)


def infer_t_ms(obj: Dict[str, Any], fallback_index: int) -> int:
    for key in ("t_ms", "time_ms", "elapsed_ms", "timestamp_ms", "ts_ms"):
        if key in obj and obj[key] not in (None, ""):
            try:
                return int(float(obj[key]))
            except ValueError:
                pass
    # Last-resort deterministic ordering for legacy files with no timestamp.
    return fallback_index


def create_session(args: argparse.Namespace) -> None:
    root = Path(args.output).resolve()
    session_id = args.session_id
    session = root / session_id
    if session.exists() and not args.force:
        raise SystemExit(f"Session already exists: {session}. Use --force only for an empty/rebuild test.")
    (session / "streams").mkdir(parents=True, exist_ok=True)
    (session / "raw").mkdir(parents=True, exist_ok=True)
    (session / "derived").mkdir(parents=True, exist_ok=True)

    sources: List[Dict[str, Any]] = []
    for source_spec in args.source or []:
        # name=path, e.g. gps=C:\data\gps.jsonl
        if "=" not in source_spec:
            raise SystemExit(f"Bad --source value: {source_spec}. Use name=path")
        name, raw_path = source_spec.split("=", 1)
        src = Path(raw_path).expanduser().resolve()
        if not src.exists():
            raise SystemExit(f"Source not found: {src}")
        dst = session / "raw" / src.name
        if args.copy_raw:
            shutil.copy2(src, dst)
        else:
            dst = src
        sources.append({
            "name": name,
            "original_path": str(src),
            "stored_path": str(dst),
            "sha256": sha256_file(src),
            "size_bytes": src.stat().st_size,
            "format": src.suffix.lower().lstrip(".") or "raw",
        })

    manifest = {
        "schema": SCHEMA,
        "session_id": session_id,
        "bike_profile_id": args.bike or "unknown",
        "app_build": args.app_build or "unknown",
        "created_by": "blackbox_replay.py",
        "rules": {
            "gps_authority_for_learning": True,
            "camera_rpm_enabled": False,
            "raw_is_immutable": True,
            "audio_requires_engine_signal_validation": True,
        },
        "sources": sources,
        "notes": args.notes or "",
    }
    write_json(session / "manifest.json", manifest)
    print(f"Created Black Box session: {session}")


def build_timeline(args: argparse.Namespace) -> None:
    session = Path(args.session).resolve()
    manifest_path = session / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"No manifest.json in {session}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    events: List[Dict[str, Any]] = []
    warnings: List[str] = []

    for source in manifest.get("sources", []):
        name = source["name"]
        path = Path(source["stored_path"])
        fmt = source.get("format", path.suffix.lower().lstrip("."))
        if not path.exists():
            warnings.append(f"Missing source {name}: {path}")
            continue
        rows: Iterable[Dict[str, Any]]
        if fmt == "jsonl":
            rows = iter_jsonl(path)
        elif fmt == "csv":
            rows = load_csv_rows(path)
        else:
            warnings.append(f"Raw binary source indexed only, not replayed yet: {name} {path.name}")
            continue
        for idx, row in enumerate(rows):
            events.append({
                "t_ms": infer_t_ms(row, idx),
                "source": name,
                "payload": row,
                "source_file": str(path),
                "source_index": idx,
            })

    events.sort(key=lambda e: (e["t_ms"], e["source"], e["source_index"]))
    out = session / "derived" / "replay.timeline.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e, ensure_ascii=False, separators=(",", ":")) + "\n")

    diagnostics = {
        "event_count": len(events),
        "sources": [s.get("name") for s in manifest.get("sources", [])],
        "warnings": warnings,
        "learning_rules": manifest.get("rules", {}),
    }
    write_json(session / "derived" / "diagnostics.json", diagnostics)
    print(f"Timeline: {out} ({len(events)} events)")
    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f" - {w}")


def replay(args: argparse.Namespace) -> None:
    timeline = Path(args.timeline).resolve()
    if not timeline.exists():
        raise SystemExit(f"Timeline not found: {timeline}")
    count = 0
    for event in iter_jsonl(timeline):
        count += 1
        if args.source and event.get("source") != args.source:
            continue
        print(json.dumps(event, ensure_ascii=False))
        if args.limit and count >= args.limit:
            break


def main() -> None:
    p = argparse.ArgumentParser(description="MotoLab Black Box + Replay scaffold")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("create-session")
    s.add_argument("--output", required=True, help="Black Box root folder")
    s.add_argument("--session-id", required=True)
    s.add_argument("--bike")
    s.add_argument("--app-build")
    s.add_argument("--notes")
    s.add_argument("--source", action="append", help="name=path; can be repeated")
    s.add_argument("--copy-raw", action="store_true", help="Copy sources into session/raw")
    s.add_argument("--force", action="store_true")
    s.set_defaults(func=create_session)

    t = sub.add_parser("build-timeline")
    t.add_argument("session")
    t.set_defaults(func=build_timeline)

    r = sub.add_parser("replay")
    r.add_argument("timeline")
    r.add_argument("--source")
    r.add_argument("--limit", type=int)
    r.set_defaults(func=replay)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
