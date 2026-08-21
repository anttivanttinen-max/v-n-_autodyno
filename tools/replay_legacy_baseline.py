#!/usr/bin/env python3
import argparse, hashlib, json, math, statistics, zipfile
from pathlib import Path
from datetime import datetime, timezone

VERSION = "legacy-rpm-replay-v1"
DEFAULT_CONFIG = {
    "schema": "motolab_legacy_replay_config_v1",
    "version": VERSION,
    "truth": {"fields": ["gpsReferenceRpm", "speedRpm"], "minRpm": 1000, "maxRpm": 14000},
    "sources": ["audioRpm", "audioRawRpm"],
    "candidateMultipliers": [0.25, 1/3, 0.5, 2/3, 1.0, 1.5, 2.0, 3.0, 4.0],
    "selection": {"requireAnySourcePositive": True, "excludeMicLearningEligibleFalse": False},
    "reportAcceptanceBandsPct": [5, 8, 10, 12, 15, 20],
    "method": "For each valid sample, build candidates from each positive source multiplied by every configured multiplier; choose the candidate with minimum absolute percent error to GPS reference. This is an offline GPS-master replay/oracle analysis, not a live RPM selector."
}

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()

def load_input(path):
    p = Path(path)
    if zipfile.is_zipfile(p):
        with zipfile.ZipFile(p) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".json") and not n.startswith("__MACOSX/")]
            if not names:
                raise ValueError("ZIP contains no JSON")
            if len(names) > 1:
                names.sort(key=lambda n: z.getinfo(n).file_size, reverse=True)
            member = names[0]
            with z.open(member) as f:
                data = json.load(f)
        return data, member
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f), None

def flatten_samples(data):
    out = []
    for c in data.get("chunks", []):
        sid = c.get("sessionId") or c.get("id")
        for s in c.get("samples") or []:
            out.append((sid, s))
    return out

def first_positive(s, fields):
    for f in fields:
        try:
            v = float(s.get(f) or 0)
        except (TypeError, ValueError):
            v = 0
        if v > 0:
            return v, f
    return 0, None

def pct_err(v, t):
    return abs(v - t) / t * 100.0 if t > 0 else math.inf

def percentile(vals, p):
    if not vals:
        return None
    a = sorted(vals)
    x = (len(a) - 1) * p
    lo, hi = math.floor(x), math.ceil(x)
    if lo == hi:
        return a[lo]
    return a[lo] * (hi - x) + a[hi] * (x - lo)

def replay(data, cfg):
    rows = []
    rejected = {"truth_out_of_range": 0, "no_audio_source": 0, "mic_learning_ineligible": 0}
    sessions = set()
    for sid, s in flatten_samples(data):
        truth, truth_field = first_positive(s, cfg["truth"]["fields"])
        if not (cfg["truth"]["minRpm"] <= truth <= cfg["truth"]["maxRpm"]):
            rejected["truth_out_of_range"] += 1
            continue
        if cfg["selection"].get("excludeMicLearningEligibleFalse") and s.get("micLearningEligible") is False:
            rejected["mic_learning_ineligible"] += 1
            continue
        src = []
        for f in cfg["sources"]:
            try:
                v = float(s.get(f) or 0)
            except (TypeError, ValueError):
                v = 0
            if v > 0:
                src.append((f, v))
        if not src:
            rejected["no_audio_source"] += 1
            continue
        candidates = []
        for field, v in src:
            for mult in cfg["candidateMultipliers"]:
                candidate = v * mult
                if candidate > 0:
                    candidates.append((pct_err(candidate, truth), candidate, field, mult))
        if not candidates:
            continue
        candidates.sort(key=lambda x: x[0])
        err, best, field, mult = candidates[0]
        rows.append({"sessionId": sid, "t": s.get("t"), "truthRpm": truth, "truthField": truth_field, "bestRpm": best, "source": field, "multiplier": mult, "errorPct": err})
        sessions.add(sid)
    errs = [r["errorPct"] for r in rows]
    mult_counts, source_counts = {}, {}
    for r in rows:
        k = str(r["multiplier"])
        mult_counts[k] = mult_counts.get(k, 0) + 1
        source_counts[r["source"]] = source_counts.get(r["source"], 0) + 1
    metrics = {
        "validPairs": len(rows),
        "sessions": len(sessions),
        "medianErrorPct": statistics.median(errs) if errs else None,
        "meanErrorPct": statistics.fmean(errs) if errs else None,
        "p90ErrorPct": percentile(errs, .90),
        "p95ErrorPct": percentile(errs, .95),
        "acceptancePct": {str(b): (100 * sum(e <= b for e in errs) / len(errs) if errs else None) for b in cfg["reportAcceptanceBandsPct"]},
        "multiplierCounts": mult_counts,
        "sourceCounts": source_counts,
        "rejected": rejected
    }
    return metrics, rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--config")
    ap.add_argument("--output")
    ap.add_argument("--rows-output")
    args = ap.parse_args()
    cfg = json.load(open(args.config, "r", encoding="utf-8")) if args.config else DEFAULT_CONFIG
    data, member = load_input(args.input)
    metrics, rows = replay(data, cfg)
    result = {
        "schema": "motolab_legacy_replay_result_v1",
        "replayVersion": VERSION,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "input": {"path": Path(args.input).name, "sha256": sha256(args.input), "zipMember": member, "app": data.get("app"), "exported": data.get("exported"), "schema": data.get("schema"), "algorithmVersion": data.get("algorithmVersion")},
        "config": cfg,
        "metrics": metrics
    }
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(text + "\n", encoding="utf-8")
    else:
        print(text)
    if args.rows_output:
        Path(args.rows_output).write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
