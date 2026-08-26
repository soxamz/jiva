"""Vercel's FastAPI entrypoint.

The runtime discovers ``api/index.py`` and sends all ``/api/*`` requests to
the exported ASGI application.
"""

from main import app

__all__ = ['app']
