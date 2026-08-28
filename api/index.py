"""Vercel's FastAPI entrypoint.

The runtime discovers ``api/index.py`` and sends all ``/api/*`` requests to
the exported ASGI application.
"""

import sys
from pathlib import Path

# Vercel imports this file from the project root. Make sibling modules in api/
# importable just as they are when the local FastAPI server starts from api/.
API_DIR = Path(__file__).resolve().parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from main import app

__all__ = ['app']
