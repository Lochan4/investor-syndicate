"""PDF text extractor using pdfplumber."""
from __future__ import annotations
import io

import pdfplumber


def extract(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)
