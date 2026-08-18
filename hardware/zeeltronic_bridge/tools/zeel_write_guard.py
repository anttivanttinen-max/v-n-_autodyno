#!/usr/bin/env python3
"""Evidence-gated PCDI-10VT write planner and readback verifier.

This tool deliberately cannot transmit until a captured Program exchange has
been decoded into a reviewed transport profile. It never guesses wire bytes.
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BLOCK_SIZE = 480
KNOWN_RANGES = {
    "description": range(0, 32),
    "ignition_map_1_advance": range(47, 67),
    "ignition_map_2_advance": range(67, 87),
    "ignition_map_1_rpm": range(107, 127),
    "ignition_map_2_rpm": range(127, 137),
    "point_counts": range(137, 140),
    "shift_light_rpm_div_100": (140, 364),
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_block(path: str) -> bytes:
    data = Path(path).read_bytes()
    if len(data) != BLOCK_SIZE:
        raise ValueError(f"expected {BLOCK_SIZE} bytes, got {len(data)}: {path}")
    return data


def labels_for_offset(offset: int) -> list[str]:
    return [name for name, offsets in KNOWN_RANGES.items() if offset in offsets]


def build_plan(baseline: bytes, candidate: bytes) -> dict:
    changes = []
    unknown = []
    for offset, (old, new) in enumerate(zip(baseline, candidate)):
        if old == new:
            continue
        labels = labels_for_offset(offset)
        item = {"offset": offset, "before": old, "after": new, "fields": labels}
        changes.append(item)
        if not labels:
            unknown.append(item)
    return {
        "schema": "motolab_zeel_write_plan_v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "device_scope": {"model": "PCDI-10VT", "firmware": "111.34.260325"},
        "baseline_sha256": sha256(baseline),
        "candidate_sha256": sha256(candidate),
        "change_count": len(changes),
        "unknown_change_count": len(unknown),
        "changes": changes,
        "quality_gates": {
            "block_size_valid": True,
            "has_changes": bool(changes),
            "known_offsets_only": not unknown,
            "program_capture_available": False,
            "checksum_hypothesis_verified": False,
            "transport_enabled": False,
        },
        "decision": "BLOCKED_UNPROVEN_PROGRAM_PROTOCOL",
    }


def command_plan(args) -> int:
    plan = build_plan(load_block(args.baseline), load_block(args.candidate))
    text = json.dumps(plan, indent=2)
    if args.output:
        Path(args.output).write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0


def command_verify(args) -> int:
    expected = load_block(args.expected)
    actual = load_block(args.readback)
    mismatches = [i for i, pair in enumerate(zip(expected, actual)) if pair[0] != pair[1]]
    result = {
        "schema": "motolab_zeel_readback_verification_v1",
        "expected_sha256": sha256(expected),
        "readback_sha256": sha256(actual),
        "exact_match": not mismatches,
        "mismatch_count": len(mismatches),
        "mismatch_offsets": mismatches,
    }
    print(json.dumps(result, indent=2))
    return 0 if not mismatches else 2


def command_fingerprint(args) -> int:
    tx = Path(args.pc_to_zeel).read_bytes()
    rx = Path(args.zeel_to_pc).read_bytes()
    payload = b""
    structure_valid = False
    if len(tx) == 733:
        header_values = bytes(tx[i] for i in range(4, 35, 2))
        body_values = bytes(tx[i] for i in range(58, 505, 2))
        structure_valid = all((
            tx[0:3] == bytes.fromhex("61 f0 01"),
            all(tx[i] == 0x44 for i in range(3, 35, 2)),
            tx[35:38] == bytes.fromhex("61 f0 01"),
            tx[38:54] == bytes([0x64]) * 16,
            tx[54:57] == bytes.fromhex("61 09 00"),
            all(tx[i] == 0x44 for i in range(57, 505, 2)),
            tx[505:508] == bytes.fromhex("61 00 00"),
            tx[508:732] == bytes([0x64]) * 224,
            tx[732] == 0x41,
            len(header_values) == 16,
            len(body_values) == 224,
        ))
        if structure_valid:
            payload = header_values + body_values
    result = {
        "schema": "motolab_zeel_program_capture_fingerprint_v1",
        "pc_to_zeel_bytes": len(tx),
        "zeel_to_pc_bytes": len(rx),
        "pc_to_zeel_sha256": sha256(tx),
        "zeel_to_pc_sha256": sha256(rx),
        "program_structure_valid": structure_valid,
        "write_payload_bytes": len(payload),
        "write_payload_sha256": sha256(payload) if payload else None,
        "status": "STRUCTURE_DECODED_PAYLOAD_SEMANTICS_UNPROVEN" if structure_valid else "CAPTURED_NOT_DECODED",
        "transport_enabled": False,
    }
    print(json.dumps(result, indent=2))
    return 0


def command_write(_args) -> int:
    print("WRITE BLOCKED: no evidence-backed Program transport profile exists.", file=sys.stderr)
    print("Capture and decode one official ZeelProg Program exchange first.", file=sys.stderr)
    return 3


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)
    plan = sub.add_parser("plan", help="diff two 480-byte read blocks")
    plan.add_argument("--baseline", required=True)
    plan.add_argument("--candidate", required=True)
    plan.add_argument("--output")
    plan.set_defaults(func=command_plan)
    verify = sub.add_parser("verify", help="verify exact post-write readback")
    verify.add_argument("--expected", required=True)
    verify.add_argument("--readback", required=True)
    verify.set_defaults(func=command_verify)
    fp = sub.add_parser("fingerprint-program", help="fingerprint captured Program streams")
    fp.add_argument("--pc-to-zeel", required=True)
    fp.add_argument("--zeel-to-pc", required=True)
    fp.set_defaults(func=command_fingerprint)
    write = sub.add_parser("write", help="fail closed until Program protocol is proven")
    write.set_defaults(func=command_write)
    return root


def main() -> int:
    try:
        args = parser().parse_args()
        return args.func(args)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

