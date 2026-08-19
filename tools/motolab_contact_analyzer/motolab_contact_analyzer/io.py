from __future__ import annotations

import csv
import io
import json
import tempfile
import wave
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np


SUPPORTED_SUFFIXES = {".wav", ".csv", ".raw", ".pcm", ".zip"}


@dataclass(slots=True)
class LoadedSignal:
    samples: np.ndarray
    sample_rate: float
    source: Path
    metadata: dict[str, object] = field(default_factory=dict)
    reference_rpm: np.ndarray | None = None
    time_seconds: np.ndarray | None = None

    def __post_init__(self) -> None:
        self.samples = np.asarray(self.samples, dtype=np.float64).reshape(-1)
        if self.samples.size == 0:
            raise ValueError("Signal contains no samples")
        if not np.isfinite(self.samples).all():
            raise ValueError("Signal contains NaN or infinite values")
        if self.sample_rate <= 0:
            raise ValueError("sample_rate must be positive")
        if self.time_seconds is None:
            self.time_seconds = np.arange(self.samples.size) / self.sample_rate


def _normalise_integer_audio(data: np.ndarray) -> np.ndarray:
    if data.dtype.kind not in "iu":
        return data.astype(np.float64)
    info = np.iinfo(data.dtype)
    scale = max(abs(info.min), abs(info.max))
    return data.astype(np.float64) / scale


def _load_wav(path: Path) -> LoadedSignal:
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        width = wav.getsampwidth()
        rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())
    if width == 1:
        raw = np.frombuffer(frames, dtype=np.uint8).astype(np.float64)
        raw = (raw - 128.0) / 128.0
    elif width == 2:
        raw = _normalise_integer_audio(np.frombuffer(frames, dtype="<i2"))
    elif width == 3:
        b = np.frombuffer(frames, dtype=np.uint8).reshape(-1, 3)
        values = b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16)
        values = np.where(values & 0x800000, values - 0x1000000, values)
        raw = values.astype(np.float64) / 8388608.0
    elif width == 4:
        raw = _normalise_integer_audio(np.frombuffer(frames, dtype="<i4"))
    else:
        raise ValueError(f"Unsupported WAV sample width: {width}")
    if channels > 1:
        raw = raw.reshape(-1, channels).mean(axis=1)
    return LoadedSignal(raw, rate, path, {"format": "wav", "channels": channels, "sample_width": width})


def _find_column(names: list[str], candidates: tuple[str, ...]) -> str | None:
    lowered = {name.strip().lower(): name for name in names}
    return next((lowered[c] for c in candidates if c in lowered), None)


def _load_csv(path: Path, default_sample_rate: float) -> LoadedSignal:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError("CSV contains no data rows")
    names = list(rows[0])
    signal_col = _find_column(names, ("sample", "value", "amplitude", "audio", "signal", "contact"))
    if signal_col is None:
        raise ValueError("CSV needs a sample/value/amplitude/audio/signal/contact column")
    time_col = _find_column(names, ("time", "time_s", "seconds", "timestamp_s", "t"))
    rpm_col = _find_column(names, ("rpm", "reference_rpm", "gps_rpm"))
    samples = np.asarray([float(row[signal_col]) for row in rows], dtype=np.float64)
    times = None
    rate = default_sample_rate
    if time_col:
        times = np.asarray([float(row[time_col]) for row in rows], dtype=np.float64)
        deltas = np.diff(times)
        valid = deltas[np.isfinite(deltas) & (deltas > 0)]
        if valid.size:
            rate = float(1.0 / np.median(valid))
    rpm = np.asarray([float(row[rpm_col]) for row in rows], dtype=np.float64) if rpm_col else None
    return LoadedSignal(samples, rate, path, {"format": "csv", "signal_column": signal_col}, rpm, times)


def _load_raw(path: Path, sample_rate: float, raw_dtype: str) -> LoadedSignal:
    allowed = {"int16": "<i2", "int32": "<i4", "float32": "<f4", "float64": "<f8"}
    if raw_dtype not in allowed:
        raise ValueError(f"raw_dtype must be one of {sorted(allowed)}")
    values = np.fromfile(path, dtype=allowed[raw_dtype])
    values = _normalise_integer_audio(values)
    return LoadedSignal(values, sample_rate, path, {"format": "raw", "dtype": raw_dtype})


def _safe_zip_member(member: zipfile.ZipInfo) -> bool:
    candidate = Path(member.filename)
    return not candidate.is_absolute() and ".." not in candidate.parts and not member.is_dir()


def _load_zip(path: Path, sample_rate: float, raw_dtype: str) -> LoadedSignal:
    with zipfile.ZipFile(path) as archive:
        candidates = [m for m in archive.infolist() if _safe_zip_member(m) and Path(m.filename).suffix.lower() in SUPPORTED_SUFFIXES - {".zip"}]
        if not candidates:
            raise ValueError("ZIP contains no supported WAV/CSV/RAW/PCM file")
        candidates.sort(key=lambda m: ({".wav": 0, ".csv": 1, ".raw": 2, ".pcm": 2}.get(Path(m.filename).suffix.lower(), 9), m.filename))
        chosen = candidates[0]
        if chosen.file_size > 512 * 1024 * 1024:
            raise ValueError("ZIP member is larger than the 512 MiB safety limit")
        with tempfile.TemporaryDirectory(prefix="motolab-contact-") as temp_dir:
            target = Path(temp_dir) / Path(chosen.filename).name
            target.write_bytes(archive.read(chosen))
            loaded = load_signal(target, sample_rate=sample_rate, raw_dtype=raw_dtype)
            loaded.source = path
            loaded.metadata.update({"format": "zip", "zip_member": chosen.filename, "inner_format": loaded.metadata.get("format")})
            return loaded


def load_signal(path: str | Path, *, sample_rate: float = 48_000.0, raw_dtype: str = "int16") -> LoadedSignal:
    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(source)
    suffix = source.suffix.lower()
    if suffix == ".wav":
        return _load_wav(source)
    if suffix == ".csv":
        return _load_csv(source, sample_rate)
    if suffix in {".raw", ".pcm"}:
        return _load_raw(source, sample_rate, raw_dtype)
    if suffix == ".zip":
        return _load_zip(source, sample_rate, raw_dtype)
    raise ValueError(f"Unsupported file type: {suffix}")


def metadata_json(signal: LoadedSignal) -> str:
    payload = {"source": str(signal.source), "sample_rate": signal.sample_rate, "sample_count": signal.samples.size, **signal.metadata}
    return json.dumps(payload, ensure_ascii=False, indent=2)

