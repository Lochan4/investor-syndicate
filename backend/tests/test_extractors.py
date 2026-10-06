"""Tests: extractors (pdf, spreadsheet) — no network calls."""
import io

import pytest


def _make_pdf_bytes() -> bytes:
    """Minimal single-page PDF with 'Hello PDF' text using reportlab if available,
    otherwise a raw PDF bytes literal."""
    try:
        from reportlab.pdfgen import canvas as rl_canvas
        buf = io.BytesIO()
        c = rl_canvas.Canvas(buf)
        c.drawString(72, 720, "Hello PDF")
        c.save()
        return buf.getvalue()
    except ImportError:
        pass

    # Minimal valid PDF that pdfplumber can open (no text)
    return (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f\n"
        b"0000000009 00000 n\n"
        b"0000000058 00000 n\n"
        b"0000000115 00000 n\n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF"
    )


def test_pdf_extract_returns_string():
    from app.services.extractors.pdf import extract
    data = _make_pdf_bytes()
    result = extract(data)
    assert isinstance(result, str)


def test_pdf_extract_empty_pdf_no_crash():
    from app.services.extractors.pdf import extract
    data = _make_pdf_bytes()
    result = extract(data)
    # doesn't raise; may be empty string for the minimal PDF
    assert result is not None


def test_spreadsheet_csv_extract():
    from app.services.extractors.spreadsheet import extract
    csv_data = b"name,value\nAlice,100\nBob,200"
    result = extract(csv_data, "data.csv")
    assert "Alice" in result
    assert "Bob" in result


def test_spreadsheet_csv_columns_present():
    from app.services.extractors.spreadsheet import extract
    csv_data = b"company,revenue\nAcme,1000000\nGlobex,2000000"
    result = extract(csv_data, "report.csv")
    assert "Acme" in result
    assert "Globex" in result


def test_spreadsheet_fallback_no_extension():
    from app.services.extractors.spreadsheet import extract
    csv_data = b"col1,col2\n1,2"
    result = extract(csv_data, "noext")
    assert isinstance(result, str)
