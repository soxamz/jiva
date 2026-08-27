"""Compatibility shim — prefer app.services.ml3.crew_engine."""

from app.services.ml3.crew_engine import run_synthesis_crew

__all__ = ["run_synthesis_crew"]
