"""Compatibility shim — prefer app.services.ml3.red_flag_detector."""

from app.services.ml3.red_flag_detector import detect_emergencies

__all__ = ["detect_emergencies"]
