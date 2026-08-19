from __future__ import annotations

import csv
import wave
from pathlib import Path

import numpy as np


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "demo_data"
    output.mkdir(exist_ok=True)
    rate = 48_000
    time = np.arange(rate * 6) / rate
    rpm = 4_500 + 3_000 * time / time[-1]
    phase = np.cumsum((rpm / 60.0) * (2 * np.pi / rate))
    rng = np.random.default_rng(18)
    samples = 0.3 * np.sin(phase) + 0.08 * np.sin(2 * phase) + 0.025 * rng.normal(size=time.size)
    for center in (2.1, 4.4):
        envelope = np.exp(-((time - center) / 0.012) ** 2)
        samples += 0.55 * envelope * np.sin(2 * np.pi * 5_700 * time)
    values = np.clip(samples * 30_000, -32768, 32767).astype("<i2")
    with wave.open(str(output / "demo_contact.wav"), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(values.tobytes())
    with (output / "demo_contact.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("time_s", "signal", "reference_rpm"))
        for index in range(time.size):
            writer.writerow((time[index], samples[index], rpm[index]))
    print(output)


if __name__ == "__main__":
    main()
