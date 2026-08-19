from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
from scipy import signal as scipy_signal

from .io import LoadedSignal


@dataclass(slots=True)
class AnalysisConfig:
    highpass_hz: float = 40.0
    lowpass_hz: float = 12_000.0
    knock_low_hz: float = 3_500.0
    knock_high_hz: float = 9_000.0
    window_ms: float = 50.0
    overlap: float = 0.75
    transient_z_threshold: float = 5.0
    pulses_per_revolution: float = 1.0
    rpm_low_hz: float = 8.0
    rpm_high_hz: float = 250.0
    verified_engine_signal: bool = False

    def validate(self, sample_rate: float) -> None:
        nyquist = sample_rate / 2.0
        if not 0 <= self.highpass_hz < self.lowpass_hz < nyquist:
            raise ValueError(f"Filter limits must satisfy 0 <= highpass < lowpass < Nyquist ({nyquist:g} Hz)")
        if not 0 < self.knock_low_hz < self.knock_high_hz < nyquist:
            raise ValueError("Invalid knock band")
        if not 0 <= self.overlap < 1:
            raise ValueError("overlap must be between 0 and 1")
        if self.window_ms <= 0 or self.pulses_per_revolution <= 0:
            raise ValueError("window_ms and pulses_per_revolution must be positive")


@dataclass(slots=True)
class KnockCandidate:
    time_s: float
    duration_s: float
    peak_z: float
    band_energy: float
    confidence: float


@dataclass(slots=True)
class AnalysisResult:
    time_s: np.ndarray
    filtered: np.ndarray
    frequencies_hz: np.ndarray
    spectrum: np.ndarray
    spectrogram_time_s: np.ndarray
    spectrogram_frequencies_hz: np.ndarray
    spectrogram_db: np.ndarray
    rpm_time_s: np.ndarray
    estimated_rpm: np.ndarray
    energy_time_s: np.ndarray
    knock_band_energy: np.ndarray
    candidates: list[KnockCandidate]
    signal_quality: float
    engine_signal_accepted: bool
    config: AnalysisConfig

    def summary(self) -> dict[str, object]:
        rpm = self.estimated_rpm[np.isfinite(self.estimated_rpm)]
        return {
            "duration_s": float(self.time_s[-1]) if self.time_s.size else 0.0,
            "signal_quality": self.signal_quality,
            "engine_signal_accepted": self.engine_signal_accepted,
            "candidate_count": len(self.candidates),
            "rpm_median": float(np.median(rpm)) if rpm.size else None,
            "rpm_min": float(np.min(rpm)) if rpm.size else None,
            "rpm_max": float(np.max(rpm)) if rpm.size else None,
            "config": asdict(self.config),
        }


def _bandpass(samples: np.ndarray, rate: float, low: float, high: float) -> np.ndarray:
    sos = scipy_signal.butter(4, [low, high], btype="bandpass", fs=rate, output="sos")
    return scipy_signal.sosfiltfilt(sos, samples) if samples.size > 64 else scipy_signal.sosfilt(sos, samples)


def _window_size(config: AnalysisConfig, rate: float, sample_count: int) -> int:
    requested = max(32, int(rate * config.window_ms / 1000.0))
    return min(requested, sample_count)


def _estimate_rpm(samples: np.ndarray, rate: float, config: AnalysisConfig) -> tuple[np.ndarray, np.ndarray]:
    frame = min(max(256, int(rate * 0.5)), samples.size)
    if frame < 32:
        return np.asarray([]), np.asarray([])
    hop = max(1, frame // 4)
    times: list[float] = []
    rpms: list[float] = []
    for start in range(0, samples.size - frame + 1, hop):
        segment = samples[start:start + frame] * np.hanning(frame)
        freqs = np.fft.rfftfreq(frame, 1.0 / rate)
        power = np.abs(np.fft.rfft(segment)) ** 2
        band = (freqs >= config.rpm_low_hz) & (freqs <= min(config.rpm_high_hz, rate / 2 - 1))
        if not np.any(band) or np.max(power[band]) <= 0:
            rpm = np.nan
        else:
            selected_freqs = freqs[band]
            rpm = float(selected_freqs[int(np.argmax(power[band]))] * 60.0 / config.pulses_per_revolution)
        times.append((start + frame / 2) / rate)
        rpms.append(rpm)
    return np.asarray(times), np.asarray(rpms)


def analyze_signal(loaded: LoadedSignal, config: AnalysisConfig | None = None) -> AnalysisResult:
    config = config or AnalysisConfig()
    config.validate(loaded.sample_rate)
    centered = loaded.samples - np.mean(loaded.samples)
    peak = float(np.max(np.abs(centered)))
    normalized = centered / peak if peak > 0 else centered.copy()
    filtered = _bandpass(normalized, loaded.sample_rate, max(config.highpass_hz, 0.1), config.lowpass_hz)

    fft_size = min(65536, max(256, 1 << max(1, filtered.size - 1).bit_length()))
    frequencies = np.fft.rfftfreq(fft_size, 1.0 / loaded.sample_rate)
    spectrum = np.abs(np.fft.rfft(filtered, n=fft_size))
    spectrum /= max(float(np.max(spectrum)), np.finfo(float).eps)

    nperseg = _window_size(config, loaded.sample_rate, filtered.size)
    noverlap = min(nperseg - 1, int(nperseg * config.overlap))
    spec_f, spec_t, spec = scipy_signal.spectrogram(filtered, fs=loaded.sample_rate, nperseg=nperseg, noverlap=noverlap, scaling="spectrum")
    spec_db = 10.0 * np.log10(np.maximum(spec, np.finfo(float).tiny))

    knock = _bandpass(normalized, loaded.sample_rate, config.knock_low_hz, config.knock_high_hz)
    frame_energy = np.sqrt(np.mean(knock[np.newaxis, :] ** 2)) if knock.size < nperseg else None
    if frame_energy is not None:
        energy = np.asarray([frame_energy])
        energy_t = np.asarray([loaded.time_seconds[len(loaded.time_seconds) // 2]])
    else:
        starts = np.arange(0, knock.size - nperseg + 1, max(1, nperseg - noverlap))
        energy = np.asarray([np.sqrt(np.mean(knock[s:s + nperseg] ** 2)) for s in starts])
        energy_t = (starts + nperseg / 2) / loaded.sample_rate
    median = float(np.median(energy))
    mad = float(np.median(np.abs(energy - median)))
    robust_sigma = max(1.4826 * mad, np.finfo(float).eps)
    z = (energy - median) / robust_sigma
    mask = z >= config.transient_z_threshold
    candidates: list[KnockCandidate] = []
    for index in np.flatnonzero(mask):
        confidence = float(np.clip((z[index] - config.transient_z_threshold) / 8.0 + 0.5, 0.0, 1.0))
        candidates.append(KnockCandidate(float(energy_t[index]), config.window_ms / 1000.0, float(z[index]), float(energy[index]), confidence))

    rms = float(np.sqrt(np.mean(centered ** 2)))
    clipping = float(np.mean(np.abs(loaded.samples) >= np.max(np.abs(loaded.samples)) * 0.999)) if peak else 1.0
    quality = float(np.clip((rms / (peak + 1e-12)) * 2.5, 0, 1) * np.clip(1.0 - clipping * 5.0, 0, 1))
    rpm_t, rpm = _estimate_rpm(filtered, loaded.sample_rate, config)
    accepted = bool(config.verified_engine_signal and quality >= 0.15)
    return AnalysisResult(
        np.asarray(loaded.time_seconds), filtered, frequencies, spectrum, spec_t, spec_f, spec_db,
        rpm_t, rpm, energy_t, energy, candidates, quality, accepted, config,
    )

