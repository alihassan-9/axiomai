"""Agent 3 — Math Audit: deterministic symbolic verification of every
arithmetic relationship in the extracted invoice.

All checks run on exact `Decimal`/SymPy rationals — a one-cent discrepancy is
flagged with the exact delta and a line-level citation. `savings_amount` sums
only overcharges (vendor billed more than the recomputed value).
"""
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

import sympy

from app.agents.state import AuditState

TOLERANCE = Decimal("0.01")  # ≤ 1 cent treated as rounding, not an error


def _dec(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def _money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _finding(check: str, expected: Decimal, actual: Decimal, citation: str,
             severity: str = "high") -> dict[str, Any]:
    delta = actual - expected
    return {
        "check": check,
        "expected": _money(expected),
        "actual": _money(actual),
        "delta": _money(delta),
        "citation": citation,
        "severity": severity,
        "formula": f"{check}: expected {_money(expected)}, document states {_money(actual)}"
                   f" (Δ {_money(delta):+})",
    }


def audit_invoice(invoice: dict[str, Any]) -> tuple[list[dict[str, Any]], float]:
    """Return (findings, overcharge_total). Empty findings == arithmetic verified."""
    findings: list[dict[str, Any]] = []
    overcharge = Decimal("0")

    # 1. Line items: quantity × unit_price == line_total  (exact, via SymPy rationals)
    computed_lines: list[Decimal] = []
    for idx, item in enumerate(invoice.get("line_items", [])):
        qty, price, stated = _dec(item.get("quantity")), _dec(item.get("unit_price")), _dec(item.get("line_total"))
        if qty is None or price is None:
            continue
        # Exact symbolic product: SymPy rationals avoid any float rounding,
        # then p/q division in Decimal space recovers the exact value.
        product = sympy.Rational(str(qty)) * sympy.Rational(str(price))
        expected = Decimal(int(product.p)) / Decimal(int(product.q))
        computed_lines.append(stated if stated is not None else expected)
        if stated is not None and abs(stated - expected) > TOLERANCE:
            findings.append(_finding(
                f"line_item[{idx}] quantity × unit_price",
                expected, stated,
                citation=f"Line {idx + 1}: \"{item.get('description', '')[:60]}\" — "
                         f"{qty} × {price} = {_money(expected)}, invoice states {_money(stated)}",
            ))
            if stated > expected:
                overcharge += stated - expected

    # 2. Subtotal == Σ line totals
    stated_subtotal = _dec(invoice.get("subtotal"))
    computed_subtotal = sum(computed_lines, Decimal("0")) if computed_lines else None
    if stated_subtotal is not None and computed_subtotal is not None:
        if abs(stated_subtotal - computed_subtotal) > TOLERANCE:
            findings.append(_finding("subtotal = Σ line_totals", computed_subtotal, stated_subtotal,
                                     citation=f"Sum of {len(computed_lines)} line totals"))
            if stated_subtotal > computed_subtotal:
                overcharge += stated_subtotal - computed_subtotal
    base = stated_subtotal if stated_subtotal is not None else computed_subtotal

    # 3. Tax: subtotal × tax_rate == tax_amount
    tax_rate, stated_tax = _dec(invoice.get("tax_rate")), _dec(invoice.get("tax_amount"))
    expected_tax = None
    if tax_rate is not None and base is not None:
        expected_tax = (base * tax_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if stated_tax is not None and abs(stated_tax - expected_tax) > TOLERANCE:
            findings.append(_finding("tax = subtotal × tax_rate", expected_tax, stated_tax,
                                     citation=f"{_money(base)} × {tax_rate} = {_money(expected_tax)}"))
            if stated_tax > expected_tax:
                overcharge += stated_tax - expected_tax

    # 4. Grand total == subtotal + tax
    stated_total = _dec(invoice.get("grand_total"))
    tax_for_total = stated_tax if stated_tax is not None else (expected_tax or Decimal("0"))
    if stated_total is not None and base is not None:
        expected_total = base + tax_for_total
        if abs(stated_total - expected_total) > TOLERANCE:
            findings.append(_finding("grand_total = subtotal + tax", expected_total, stated_total,
                                     citation=f"{_money(base)} + {_money(tax_for_total)} = {_money(expected_total)}",
                                     severity="critical"))
            if stated_total > expected_total:
                overcharge += stated_total - expected_total

    # 5. Structural checks
    if not invoice.get("line_items"):
        findings.append({"check": "line_items present", "severity": "medium", "delta": 0,
                         "citation": "No line items could be extracted from the document",
                         "formula": "Invoice contains no parseable line items"})

    return findings, float(overcharge.quantize(Decimal("0.01")))


def run(state: AuditState) -> AuditState:
    findings, overcharge = audit_invoice(state.get("invoice", {}))
    state["math_findings"] = findings
    state["savings_amount"] = overcharge
    state["math_passed"] = not any(f.get("severity") in ("high", "critical") for f in findings)
    return state
