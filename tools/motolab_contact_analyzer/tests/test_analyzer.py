from __future__ import annotations

import csv
import json
import sys
import wave
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from motolab_contact_analyzer.analysis import AnalysisConfig, analyze_signal
from motolab_contact_analyzer.annotations import Annotation, load_annotations, save_annotations
from motolab_contact_analyzer.batch import analyze_directory
from motolab_contact_analyzer.io import LoadedSignal, load_signal


def synthetic(rate: int = 16_000, duration: float = 2.0) -> LoadedSignal:
    time = np.arange(int(rate * duration)) / rate
    samples = 0.55 * np.sin(2 * np.pi * 100 * time)
    burst = (time > 1.0) & (time < 1.025)
    samples[burst] += 1.6 * np.sin(2 * np.pi * 4_500 * time[burst])
    return LoadedSignal(samples, rate, Path("synthetic"))


def write_wav(path: Path, signal: LoadedSignal) -> None:
    values = np.clip(signal.samples * 14_000, -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(signal.sample_rate))
        handle.writeframes(values.tobytes())


def test_analysis_detects_rpm_and_safety_gate() -> None:
    result = analyze_signal(synthetic(), AnalysisConfig(lowpass_hz=7_000, knock_low_hz=3_500, knock_high_hz=6_500))
    assert not result.engine_signal_accepted
    assert 5_500 <= float(np.nanmedian(result.estimated_rpm)) <= 6_500
    assert any(0.9 <= item.time_s <= 1.1 for item in result.candidates)


def test_verified_signal_still_needs_quality() -> None:
    loaded = synthetic()
    result = analyze_signal(loaded, AnalysisConfig(lowpass_hz=7_000, knock_low_hz=3_500, knock_high_hz=6_500, verified_engine_signal=True))
    assert result.engine_signal_accepted


def test_wav_csv_raw_and_zip_loading(tmp_path: Path) -> None:
    loaded = synthetic(duration=0.5)
    wav_path = tmp_path / "sample.wav"
    write_wav(wav_path, loaded)
    assert load_signal(wav_path).samples.size == loaded.samples.size

    csv_path = tmp_path / "sample.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("time_s", "signal", "reference_rpm"))
        for index, sample in enumerate(loaded.samples[:100]):
            writer.writerow((index / loaded.sample_rate, sample, 6000))
    csv_signal = load_signal(csv_path)
    assert csv_signal.reference_rpm is not None
    assert abs(csv_signal.sample_rate - loaded.sample_rate) < 1

    raw_path = tmp_path / "sample.raw"
    (loaded.samples[:100] * 10_000).astype("<i2").tofile(raw_path)
    assert load_signal(raw_path, sample_rate=loaded.sample_rate).samples.size == 100

    zip_path = tmp_path / "sample.zip"
    with zipfile.ZipFile(zip_path, "w") as archive:
        archive.write(wav_path, "capture/sample.wav")
    zip_signal = load_signal(zip_path)
    assert zip_signal.metadata["zip_member"] == "capture/sample.wav"


def test_annotations_round_trip(tmp_path: Path) -> None:
    path = tmp_path / "annotations.json"
    expected = [Annotation(0.2, 0.4, "NORMAL"), Annotation(1.0, 1.1, "KNOCK", "heard ping")]
    save_annotations(path, expected, "capture.wav")
    assert load_annotations(path) == expected


def test_batch_continues_after_bad_file(tmp_path: Path) -> None:
    source = tmp_path / "input"
    output = tmp_path / "output"
    source.mkdir()
    write_wav(source / "good.wav", synthetic(duration=0.5))
    (source / "bad.raw").write_bytes(b"\x01")
    rows = analyze_directory(source, output, AnalysisConfig(lowpass_hz=7_000, knock_low_hz=3_500, knock_high_hz=6_500), sample_rate=16_000)
    assert len(rows) == 2
    assert {row["status"] for row in rows} == {"ok", "error"}
    assert json.loads((output / "batch-summary.json").read_text(encoding="utf-8"))

