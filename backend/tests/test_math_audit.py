"""Unit tests — Math Audit agent (pure, no infrastructure required)."""
from app.agents.math_audit import audit_invoice


def make_invoice(**overrides):
    invoice = {
        "vendor": "Acme Corp", "invoice_number": "INV-100", "currency": "USD",
        "line_items": [
            {"description": "Widget A", "quantity": 3, "unit_price": 10.00, "line_total": 30.00},
            {"description": "Widget B", "quantity": 2, "unit_price": 25.50, "line_total": 51.00},
        ],
        "subtotal": 81.00, "tax_rate": 0.10, "tax_amount": 8.10, "grand_total": 89.10,
    }
    invoice.update(overrides)
    return invoice


def test_clean_invoice_passes():
    findings, savings = audit_invoice(make_invoice())
    assert findings == []
    assert savings == 0.0


def test_line_item_overcharge_detected():
    invoice = make_invoice()
    invoice["line_items"][0]["line_total"] = 75.00  # should be 30.00 → $45 overcharge
    findings, savings = audit_invoice(invoice)
    checks = [f["check"] for f in findings]
    assert any("line_item[0]" in c for c in checks)
    line_finding = next(f for f in findings if "line_item[0]" in f["check"])
    assert line_finding["expected"] == 30.00
    assert line_finding["actual"] == 75.00
    assert line_finding["delta"] == 45.00
    assert savings >= 45.00


def test_one_cent_rounding_tolerated():
    invoice = make_invoice(tax_amount=8.11)  # 1 cent off — rounding, not an error
    findings, _ = audit_invoice(invoice)
    assert not any(f["check"].startswith("tax") for f in findings)


def test_wrong_tax_detected():
    invoice = make_invoice(tax_amount=12.00)
    findings, savings = audit_invoice(invoice)
    tax = next(f for f in findings if f["check"].startswith("tax"))
    assert tax["expected"] == 8.10
    assert savings > 0


def test_wrong_grand_total_is_critical():
    invoice = make_invoice(grand_total=99.10)
    findings, _ = audit_invoice(invoice)
    total = next(f for f in findings if f["check"].startswith("grand_total"))
    assert total["severity"] == "critical"
    assert total["delta"] == 10.00


def test_subtotal_mismatch_detected():
    invoice = make_invoice(subtotal=90.00, tax_amount=9.00, grand_total=99.00)
    findings, _ = audit_invoice(invoice)
    assert any(f["check"].startswith("subtotal") for f in findings)


def test_missing_line_items_flagged():
    findings, _ = audit_invoice({"line_items": [], "grand_total": 100.0})
    assert any(f["check"] == "line_items present" for f in findings)


def test_undercharge_not_counted_as_savings():
    invoice = make_invoice()
    invoice["line_items"][0]["line_total"] = 20.00  # vendor undercharged
    invoice["subtotal"] = 71.00
    invoice["tax_amount"] = 7.10
    invoice["grand_total"] = 78.10
    findings, savings = audit_invoice(invoice)
    assert any("line_item[0]" in f["check"] for f in findings)
    assert savings == 0.0
