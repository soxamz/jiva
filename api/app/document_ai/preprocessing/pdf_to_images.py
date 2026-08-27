from __future__ import annotations

from typing import Iterable

import numpy as np
from pdf2image import convert_from_bytes


def pdf_to_images(pdf_bytes: bytes) -> list[np.ndarray]:
    """Convert a PDF document into a list of grayscale page images.

    Args:
        pdf_bytes: Raw PDF file bytes.

    Returns:
        list[np.ndarray]: Page images represented as NumPy arrays.
    """
    if not pdf_bytes:
        raise ValueError("PDF content is empty")

    pages = convert_from_bytes(pdf_bytes)
    return [np.array(page) for page in pages]
