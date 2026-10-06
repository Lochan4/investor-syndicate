"""Spreadsheet text extractor using pandas."""
from __future__ import annotations
import io

import pandas as pd


def extract(data: bytes, filename: str = "") -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("xls", "xlsx"):
        df = pd.read_excel(io.BytesIO(data))
    else:
        df = pd.read_csv(io.BytesIO(data))
    return df.to_string(index=False)
