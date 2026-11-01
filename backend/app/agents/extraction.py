"""Agent 2 — Extraction: structured invoice JSON from raw document text.

Strategy: LLM extraction (Llama 3.1 via Ollama) validated against the source
text, with a deterministic regex/table parser as both fallback and
cross-check. Numbers the LLM emits that do not appear in the source text get
their confidence penalised — this is what the Correction agent keys off.
"""
import re
from typing import Any

import structlog

from app.agents.state import AuditState
from app.ai import llm, pdf_text

log = structlog.get_logger(__name__)

_MONEY = r"\$?\s*([\d,]+\.?\d{0,4})"

_EXTRACTION_SYSTEM = """You are a precise invoice data extractor. Extract data EXACTLY as it \
appears in the document. Never compute or correct values — copy them verbatim, even if they \
look wrong. Output only JSON."""

_EXTRACTION_PROMPT = """Extract the invoice below into this exact JSON schema:
{{
  "vendor": string, "invoice_number": string, "invoice_date": string,
  "currency": string,
  "line_items": [{{"description": string, "category": string, "quantity": number,
                  "unit_price": number, "line_total": number}}],
  "subtotal": number|null, "tax_rate": number|null, "tax_amount": number|null,
  "grand_total": number|null
}}
tax_rate must be a decimal fraction (8.5% -> 0.085). Use null for absent fields.

INVOICE TEXT:
{text}"""


def _to_number(value: str | float | int | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^\d.\-]", "", str(value))
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def deterministic_parse(text: str, pdf_bytes: bytes | None = None,
                        content_type: str = "application/pdf") -> dict[str, Any]:
    """Regex + table based parser. Audit-grade for well-formed invoices."""
    invoice: dict[str, Any] = {
        "vendor": "", "invoice_number": "", "invoice_date": "", "currency": "USD",
        "line_items": [], "subtotal": None, "tax_rate": None, "tax_amount": None,
        "grand_total": None,
    }
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if lines:
        invoice["vendor"] = lines[0][:120]

    patterns = {
        "vendor": r"(?:vendor|from|billed?\s*by|seller)\s*[:\-]\s*(.+)",
        "invoice_number": r"invoice\s*(?:no|number|#)\s*[:\-#]?\s*([A-Za-z0-9\-/]+)",
        "invoice_date": r"(?:invoice\s*)?date\s*[:\-]\s*([\d]{1,4}[\-/. ][\w]{1,9}[\-/. ][\d]{1,4})",
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            invoice[key] = match.group(1).strip()[:120]

    money_fields = {
        "subtotal": r"sub\s*-?\s*total\s*[:\-]?\s*" + _MONEY,
        "tax_amount": r"(?:sales\s*)?tax(?:\s*\([\d.]+%\))?\s*[:\-]?\s*" + _MONEY,
        # (?<!sub) keeps the bare "total" alternative from matching inside "Subtotal";
        # the last occurrence wins since totals close out an invoice.
        "grand_total": r"(?:grand\s*total|total\s*due|amount\s*due|balance\s*due|(?<!sub)total)\s*[:\-]?\s*" + _MONEY,
    }
    for key, pattern in money_fields.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            invoice[key] = _to_number(matches[-1] if key == "grand_total" else matches[0])
    tax_rate = re.search(r"tax\s*(?:rate)?\s*\(?\s*([\d.]+)\s*%", text, re.IGNORECASE)
    if tax_rate:
        invoice["tax_rate"] = round(float(tax_rate.group(1)) / 100.0, 6)

    # Line items: prefer real PDF tables, fall back to row regex.
    rows: list[list[str]] = []
    if pdf_bytes and content_type == "application/pdf":
        try:
            for table in pdf_text.extract_tables(pdf_bytes):
                rows.extend([[c or "" for c in row] for row in table])
        except Exception as exc:  # noqa: BLE001 - table parsing is best-effort; text parser follows
            log.warning("table_extraction_failed", error=str(exc))
    items = _items_from_tables(rows) if rows else []
    if not items:
        items = _items_from_lines(lines)
    invoice["line_items"] = items
    return invoice


def _items_from_tables(rows: list[list[str]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for row in rows:
        numbers = [_to_number(c) for c in row]
        numeric = [n for n in numbers if n is not None]
        text_cells = [c for c, n in zip(row, numbers) if n is None and c.strip()]
        if len(numeric) >= 3 and text_cells:
            qty, unit_price, line_total = numeric[0], numeric[1], numeric[-1]
            if qty and qty == int(qty) and qty < 10000:
                items.append({
                    "description": text_cells[0][:200], "category": (text_cells[1] if len(text_cells) > 1 else "")[:100],
                    "quantity": qty, "unit_price": unit_price, "line_total": line_total,
                })
    return items


_ROW_RE = re.compile(
    r"^(?P<desc>.{3,90}?)\s+(?P<qty>\d{1,4})\s+\$?\s*(?P<price>[\d,]+\.\d{2})\s+\$?\s*(?P<total>[\d,]+\.\d{2})\s*$")
_CATEGORY_RE = re.compile(r"^[A-Z][A-Za-z&/-]{2,30}$")


def _items_from_lines(lines: list[str]) -> list[dict[str, Any]]:
    items = []
    for line in lines:
        match = _ROW_RE.match(line)
        if not match:
            continue
        desc = match.group("desc").strip()
        category = ""
        # Trailing single capitalised word is usually the category column.
        parts = desc.rsplit(None, 1)
        if len(parts) == 2 and _CATEGORY_RE.match(parts[1]):
            desc, category = parts[0], parts[1]
        items.append({
            "description": desc, "category": category,
            "quantity": _to_number(match.group("qty")),
            "unit_price": _to_number(match.group("price")),
            "line_total": _to_number(match.group("total")),
        })
    return items


def _grounding_confidence(invoice: dict[str, Any], text: str) -> float:
    """Fraction of extracted numbers literally present in the source text."""
    numbers: list[float] = []
    for field in ("subtotal", "tax_amount", "grand_total"):
        if invoice.get(field) is not None:
            numbers.append(invoice[field])
    for item in invoice.get("line_items", []):
        for field in ("unit_price", "line_total"):
            if item.get(field) is not None:
                numbers.append(item[field])
    if not numbers:
        return 0.1
    normalized = text.replace(",", "")
    found = sum(1 for n in numbers if f"{n:.2f}" in normalized or f"{n:g}" in normalized)
    return round(found / len(numbers), 3)


def run(state: AuditState) -> AuditState:
    text = state["raw_text"]
    det = deterministic_parse(text, state.get("pdf_bytes"), state.get("content_type", "application/pdf"))
    det_conf = _grounding_confidence(det, text)

    invoice, method, confidence = det, "deterministic", det_conf
    llm_result = llm.generate_json(_EXTRACTION_PROMPT.format(text=text[:12000]), system=_EXTRACTION_SYSTEM)
    if llm_result and isinstance(llm_result.get("line_items"), list):
        llm_invoice = _sanitize(llm_result)
        llm_conf = _grounding_confidence(llm_invoice, text)
        # Pick whichever extraction is better grounded; merge headers from the other.
        if llm_conf >= det_conf or not det["line_items"]:
            invoice, method, confidence = llm_invoice, "llm", llm_conf
            for field in ("vendor", "invoice_number", "invoice_date"):
                invoice[field] = invoice.get(field) or det.get(field) or ""
        else:
            method = "hybrid"

    for item in invoice["line_items"]:
        item.setdefault("confidence", confidence)
    state["invoice"] = invoice
    state["extraction_method"] = method
    state["extraction_confidence"] = confidence
    return state


def _sanitize(raw: dict[str, Any]) -> dict[str, Any]:
    items = []
    for item in raw.get("line_items", []):
        if not isinstance(item, dict):
            continue
        items.append({
            "description": str(item.get("description", ""))[:200],
            "category": str(item.get("category", ""))[:100],
            "quantity": _to_number(item.get("quantity")),
            "unit_price": _to_number(item.get("unit_price")),
            "line_total": _to_number(item.get("line_total")),
        })
    return {
        "vendor": str(raw.get("vendor", ""))[:120],
        "invoice_number": str(raw.get("invoice_number", ""))[:120],
        "invoice_date": str(raw.get("invoice_date", ""))[:60],
        "currency": str(raw.get("currency", "USD"))[:10],
        "line_items": items,
        "subtotal": _to_number(raw.get("subtotal")),
        "tax_rate": _to_number(raw.get("tax_rate")),
        "tax_amount": _to_number(raw.get("tax_amount")),
        "grand_total": _to_number(raw.get("grand_total")),
    }
