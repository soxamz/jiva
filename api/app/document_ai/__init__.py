"""Document AI package.

Heavy OCR/ML imports are loaded lazily by pipeline modules so the FastAPI
app can boot without the full Document AI dependency set installed.
"""

__all__: list[str] = []
