"""PDF text extractor.

Primary: GPT-4o vision — handles complex multi-column pitch deck layouts.
         Prompt uses pure text transcription to avoid content-policy refusals.
Fallback: pdfplumber (simple single-column PDFs / no API key).
"""
from __future__ import annotations
import base64
import io
import os


def _page_to_b64(page, dpi: int = 120) -> str:
    scale = dpi / 72
    bitmap = page.render(scale=scale, rotation=0)
    pil_image = bitmap.to_pil()
    buf = io.BytesIO()
    pil_image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _extract_with_vision(data: bytes) -> str:
    import pypdfium2 as pdfium
    from openai import OpenAI

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    doc = pdfium.PdfDocument(data)
    pages_text: list[str] = []

    try:
        for i in range(len(doc)):
            page = doc[i]
            try:
                b64 = _page_to_b64(page)
                resp = client.chat.completions.create(
                    model="gpt-4o",
                    max_tokens=1500,
                    messages=[{"role": "user", "content": [
                        {"type": "image_url", "image_url": {
                            "url": f"data:image/png;base64,{b64}", "detail": "high"
                        }},
                        {"type": "text", "text": (
                            "Transcribe every word of text visible on this image. "
                            "For multi-column layouts: left column top-to-bottom first, "
                            "then right column top-to-bottom. Output only the raw text, no commentary."
                        )},
                    ]}],
                )
                pages_text.append(resp.choices[0].message.content or "")
            finally:
                page.close()
    finally:
        doc.close()

    return "\n--- PAGE ---\n".join(pages_text)


def _extract_with_pdfplumber(data: bytes) -> str:
    import pdfplumber
    from pdfminer.layout import LAParams
    laparams = LAParams(boxes_flow=None, char_margin=2.0)
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join(
            page.extract_text(layout=True, layout_kwargs={"laparams": laparams}) or ""
            for page in pdf.pages
        )


def extract(data: bytes) -> str:
    if os.environ.get("OPENAI_API_KEY"):
        try:
            return _extract_with_vision(data)
        except Exception:
            pass
    return _extract_with_pdfplumber(data)
