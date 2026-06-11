"""PDF/image text extraction: pdfplumber first, Tesseract OCR fallback for scans."""
import io

import pdfplumber


def extract_text(data: bytes, content_type: str) -> tuple[str, str]:
    """Return (text, method). Method is 'pdfplumber' | 'ocr'."""
    if content_type == "application/pdf":
        text = _pdf_text(data)
        if len(text.strip()) >= 40:  # enough native text — not a scan
            return text, "pdfplumber"
        ocr = _ocr_pdf(data)
        return (ocr, "ocr") if ocr.strip() else (text, "pdfplumber")
    # PNG / JPEG uploads go straight to OCR.
    return _ocr_image(data), "ocr"


def _pdf_text(data: bytes) -> str:
    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def extract_tables(data: bytes) -> list[list[list[str | None]]]:
    """Extract raw tables from a native PDF (used by the deterministic extractor)."""
    tables: list[list[list[str | None]]] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            tables.extend(page.extract_tables() or [])
    return tables


def _ocr_pdf(data: bytes) -> str:
    try:
        import pytesseract
        from pdf2image import convert_from_bytes
    except ImportError:  # OCR stack optional in dev environments
        return ""
    try:
        pages = convert_from_bytes(data, dpi=200)
        return "\n".join(pytesseract.image_to_string(p) for p in pages)
    except Exception:
        return ""


def _ocr_image(data: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return ""
    try:
        return pytesseract.image_to_string(Image.open(io.BytesIO(data)))
    except Exception:
        return ""
