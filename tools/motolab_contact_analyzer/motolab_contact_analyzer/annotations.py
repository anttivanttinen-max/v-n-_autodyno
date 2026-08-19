from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path


LABELS = ("NORMAL", "KNOCK", "MECHANICAL_HIT", "UNKNOWN")


@dataclass(slots=True)
class Annotation:
    start_s: float
    end_s: float
    label: str
    note: str = ""

    def __post_init__(self) -> None:
        if self.label not in LABELS:
            raise ValueError(f"label must be one of {LABELS}")
        if self.start_s < 0 or self.end_s <= self.start_s:
            raise ValueError("Annotation needs 0 <= start_s < end_s")


def save_annotations(path: str | Path, annotations: list[Annotation], source: str = "") -> None:
    payload = {"schema": "motolab.contact-annotations.v1", "source": source, "annotations": [asdict(item) for item in annotations]}
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_annotations(path: str | Path) -> list[Annotation]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return [Annotation(**item) for item in payload.get("annotations", [])]


def export_annotations_csv(path: str | Path, annotations: list[Annotation]) -> None:
    with Path(path).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=("start_s", "end_s", "label", "note"))
        writer.writeheader()
        for item in annotations:
            writer.writerow(asdict(item))

