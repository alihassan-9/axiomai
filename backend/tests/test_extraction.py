"""Unit tests — deterministic invoice parser."""
from app.agents.extraction import _grounding_confidence, deterministic_parse

SAMPLE = """ACME OFFICE SUPPLIES LTD
123 Commerce Street, Springfield

Invoice Number: INV-2026-0042
Date: 2026-05-14

Description                Qty   Unit Price   Total
Standing desk                2     $450.00    $900.00
Ergonomic chair              4     $210.00    $840.00
Monitor arm                  6      $39.99    $239.94

Subtotal: $1,979.94
Tax (8.25%): $163.35
Grand Total: $2,143.29
"""


def test_header_fields():
    invoice = deterministic_parse(SAMPLE)
    assert invoice["invoice_number"] == "INV-2026-0042"
    assert invoice["invoice_date"].startswith("2026")
    assert invoice["vendor"].startswith("ACME")


def test_totals():
    invoice = deterministic_parse(SAMPLE)
    assert invoice["subtotal"] == 1979.94
    assert invoice["tax_amount"] == 163.35
    assert invoice["grand_total"] == 2143.29
    assert invoice["tax_rate"] == 0.0825


def test_line_items():
    invoice = deterministic_parse(SAMPLE)
    assert len(invoice["line_items"]) == 3
    first = invoice["line_items"][0]
    assert first["quantity"] == 2
    assert first["unit_price"] == 450.00
    assert first["line_total"] == 900.00


def test_grounding_confidence_full():
    invoice = deterministic_parse(SAMPLE)
    assert _grounding_confidence(invoice, SAMPLE) == 1.0


def test_grounding_confidence_penalises_hallucination():
    invoice = deterministic_parse(SAMPLE)
    invoice["grand_total"] = 9999.99  # not present in source text
    assert _grounding_confidence(invoice, SAMPLE) < 1.0
