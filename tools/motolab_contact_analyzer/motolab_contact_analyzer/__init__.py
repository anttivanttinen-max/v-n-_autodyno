"""Standalone MotoLab contact-sensor research toolkit."""

from .analysis import AnalysisConfig, AnalysisResult, analyze_signal
from .io import LoadedSignal, load_signal

__all__ = [
    "AnalysisConfig",
    "AnalysisResult",
    "LoadedSignal",
    "analyze_signal",
    "load_signal",
]

