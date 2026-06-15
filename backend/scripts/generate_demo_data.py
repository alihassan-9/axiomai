"""Generate the demo dataset: 10 mock invoices + 2 policy PDFs into ./demo_data.

Invoices:
  1.  clean_invoice.pdf            — arithmetic correct, policy compliant
  2.  overcharge_invoice.pdf       — line total inflated by $45.00 (math error)
  3.  tax_error_invoice.pdf        — tax computed at the wrong rate (+$8.74)
  4.  policy_violation_invoice.pdf — software purchase over the $500 cap
  5.  messy_invoice.pdf            — odd layout to exercise the LLM extractor
  6.  meal_over_cap_invoice.pdf    — meal event over the $400 cap (policy)
  7.  subtotal_mismatch_invoice.pdf— stated subtotal ≠ Σ line totals (+$50)
  8.  grandtotal_error_invoice.pdf — grand total ≠ subtotal + tax (+$50, critical)
  9.  bulk_hardware_invoice.pdf    — hardware over $1,000 needing a PO (policy)
  10. consulting_invoice.pdf       — large clean invoice, >$2,500 dual-approval (policy)

Run:  python scripts/generate_demo_data.py
"""
import os
from dataclasses import dataclass

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "demo_data")


@dataclass
class Line:
    description: str
    category: str
    qty: int
    unit_price: float
    stated_total: float  # may intentionally differ from qty * unit_price


def draw_invoice(path: str, vendor: str, number: str, date: str, lines: list[Line],
                 subtotal: float, tax_rate: float, tax_amount: float, grand_total: float) -> None:
    pdf = canvas.Canvas(path, pagesize=A4)
    width, height = A4
    y = height - 2.5 * cm
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(2 * cm, y, vendor)
    y -= 1.2 * cm
    pdf.setFont("Helvetica", 10)
    pdf.drawString(2 * cm, y, f"Invoice Number: {number}")
    pdf.drawString(11 * cm, y, f"Date: {date}")
    y -= 1.4 * cm

    pdf.setFont("Helvetica-Bold", 9)
    for x, header in ((2, "Description"), (9, "Category"), (12, "Qty"), (13.5, "Unit Price"), (16.5, "Total")):
        pdf.drawString(x * cm, y, header)
    y -= 0.3 * cm
    pdf.line(2 * cm, y, 19 * cm, y)
    y -= 0.6 * cm

    pdf.setFont("Helvetica", 9)
    for line in lines:
        pdf.drawString(2 * cm, y, line.description[:42])
        pdf.drawString(9 * cm, y, line.category)
        pdf.drawRightString(12.6 * cm, y, str(line.qty))
        pdf.drawRightString(15.5 * cm, y, f"${line.unit_price:,.2f}")
        pdf.drawRightString(19 * cm, y, f"${line.stated_total:,.2f}")
        y -= 0.55 * cm

    y -= 0.4 * cm
    pdf.line(12 * cm, y, 19 * cm, y)
    y -= 0.6 * cm
    pdf.setFont("Helvetica", 10)
    pdf.drawRightString(15.5 * cm, y, "Subtotal:")
    pdf.drawRightString(19 * cm, y, f"${subtotal:,.2f}")
    y -= 0.55 * cm
    pdf.drawRightString(15.5 * cm, y, f"Tax ({tax_rate * 100:.2f}%):")
    pdf.drawRightString(19 * cm, y, f"${tax_amount:,.2f}")
    y -= 0.55 * cm
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawRightString(15.5 * cm, y, "Grand Total:")
    pdf.drawRightString(19 * cm, y, f"${grand_total:,.2f}")
    pdf.save()


def draw_policy(path: str, title: str, clauses: list[str]) -> None:
    pdf = canvas.Canvas(path, pagesize=A4)
    width, height = A4
    y = height - 2.5 * cm
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(2 * cm, y, title)
    y -= 1.2 * cm
    pdf.setFont("Helvetica", 10)
    for i, clause in enumerate(clauses, 1):
        for chunk_start in range(0, len(clause), 90):
            prefix = f"{i}. " if chunk_start == 0 else "    "
            pdf.drawString(2 * cm, y, prefix + clause[chunk_start:chunk_start + 90])
            y -= 0.55 * cm
        y -= 0.25 * cm
        if y < 3 * cm:
            pdf.showPage()
            pdf.setFont("Helvetica", 10)
            y = height - 2.5 * cm
    pdf.save()


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. Clean
    draw_invoice(os.path.join(OUT_DIR, "clean_invoice.pdf"),
                 "Northwind Office Supplies", "INV-2026-1001", "2026-05-02",
                 [Line("A4 paper (case)", "Office", 10, 24.99, 249.90),
                  Line("Toner cartridge HP-26X", "Office", 4, 89.50, 358.00)],
                 subtotal=607.90, tax_rate=0.08, tax_amount=48.63, grand_total=656.53)

    # 2. $45 overcharge on line 1 (stated 285.00, correct is 240.00)
    draw_invoice(os.path.join(OUT_DIR, "overcharge_invoice.pdf"),
                 "Apex Industrial Parts", "INV-2026-2117", "2026-05-11",
                 [Line("Steel brackets (box of 50)", "Hardware", 8, 30.00, 285.00),
                  Line("M8 bolt assortment", "Hardware", 5, 12.40, 62.00)],
                 subtotal=347.00, tax_rate=0.07, tax_amount=24.29, grand_total=371.29)

    # 3. Tax error: 8% stated, charged ~10.3%
    draw_invoice(os.path.join(OUT_DIR, "tax_error_invoice.pdf"),
                 "Meridian Catering Co", "INV-2026-3300", "2026-05-18",
                 [Line("Team lunch — quarterly review", "Meals", 1, 380.00, 380.00)],
                 subtotal=380.00, tax_rate=0.08, tax_amount=39.14, grand_total=419.14)

    # 4. Policy violation: software line over $500 cap (math is correct)
    draw_invoice(os.path.join(OUT_DIR, "policy_violation_invoice.pdf"),
                 "CloudSoft Licensing Inc", "INV-2026-4412", "2026-05-23",
                 [Line("IDE professional licence (annual)", "Software", 3, 220.00, 660.00),
                  Line("Training webinar seat", "Training", 2, 75.00, 150.00)],
                 subtotal=810.00, tax_rate=0.0, tax_amount=0.00, grand_total=810.00)

    # 5. Messy layout (no category column alignment, odd spacing)
    pdf = canvas.Canvas(os.path.join(OUT_DIR, "messy_invoice.pdf"), pagesize=A4)
    _, height = A4
    text = pdf.beginText(2 * cm, height - 2.5 * cm)
    text.setFont("Helvetica", 10)
    for line in [
        "GLOBEX CONSULTING GROUP — STATEMENT",
        "ref / INV-2026-5520     issued 2026-05-27",
        "",
        "services rendered:",
        "  strategy workshop ........ 2 days x $1,200.00 ... $2,400.00",
        "  travel reimbursement ..... 1 x $312.45 ........... $312.45",
        "",
        "subtotal $2,712.45",
        "tax (5%) $135.62",
        "total due $2,848.07",
    ]:
        text.textLine(line)
    pdf.drawText(text)
    pdf.save()

    # 6. Meal over the $400 event cap (math correct, policy violation)
    draw_invoice(os.path.join(OUT_DIR, "meal_over_cap_invoice.pdf"),
                 "Meridian Catering Co", "INV-2026-6001", "2026-06-02",
                 [Line("Annual gala dinner - 40 guests", "Meals", 1, 520.00, 520.00)],
                 subtotal=520.00, tax_rate=0.08, tax_amount=41.60, grand_total=561.60)

    # 7. Subtotal mismatch: line totals sum to 309.90 but subtotal states 359.90 (+$50)
    draw_invoice(os.path.join(OUT_DIR, "subtotal_mismatch_invoice.pdf"),
                 "Northwind Office Supplies", "INV-2026-7001", "2026-06-04",
                 [Line("A4 paper (case)", "Office", 10, 24.99, 249.90),
                  Line("Heavy-duty stapler", "Office", 5, 12.00, 60.00)],
                 subtotal=359.90, tax_rate=0.08, tax_amount=28.79, grand_total=388.69)

    # 8. Grand-total error: subtotal+tax = 481.50 but total states 531.50 (+$50, critical)
    draw_invoice(os.path.join(OUT_DIR, "grandtotal_error_invoice.pdf"),
                 "Apex Industrial Parts", "INV-2026-8001", "2026-06-06",
                 [Line("Steel pipe 8in (length)", "Hardware", 10, 45.00, 450.00)],
                 subtotal=450.00, tax_rate=0.07, tax_amount=31.50, grand_total=531.50)

    # 9. Bulk hardware over $1,000 (math correct, needs PO per policy)
    draw_invoice(os.path.join(OUT_DIR, "bulk_hardware_invoice.pdf"),
                 "Apex Industrial Parts", "INV-2026-9001", "2026-06-09",
                 [Line("Industrial air compressor", "Hardware", 1, 1200.00, 1200.00),
                  Line("Mounting kit", "Hardware", 4, 85.00, 340.00)],
                 subtotal=1540.00, tax_rate=0.07, tax_amount=107.80, grand_total=1647.80)

    # 10. Large clean consulting invoice (math correct; >$2,500 triggers dual-approval policy)
    draw_invoice(os.path.join(OUT_DIR, "consulting_invoice.pdf"),
                 "Initech Consulting", "INV-2026-1010", "2026-06-11",
                 [Line("Senior consulting (hrs)", "Services", 20, 150.00, 3000.00),
                  Line("Implementation (hrs)", "Services", 10, 120.00, 1200.00),
                  Line("Annual support plan", "Services", 1, 500.00, 500.00)],
                 subtotal=4700.00, tax_rate=0.0, tax_amount=0.00, grand_total=4700.00)

    # Policy documents for RAG
    draw_policy(os.path.join(OUT_DIR, "expense_policy.pdf"),
                "Corporate Expense Policy — 2026",
                [
                    "Software purchases must not exceed $500.00 per invoice without prior CFO approval.",
                    "Meal and entertainment expenses are capped at $400.00 per event and require an attendee list.",
                    "All hardware purchases above $1,000.00 require a purchase order reference on the invoice.",
                    "Invoices from vendors not on the approved vendor list must be routed to procurement review.",
                    "Travel reimbursements require itemised receipts; per-diem claims are capped at $75.00 per day.",
                ])
    draw_policy(os.path.join(OUT_DIR, "vendor_policy.pdf"),
                "Vendor Management Policy — 2026",
                [
                    "Approved vendors: Northwind Office Supplies, Apex Industrial Parts, Meridian Catering Co.",
                    "New vendors must complete W-9 onboarding before their first invoice is payable.",
                    "Invoices with payment terms shorter than NET-15 require finance manager sign-off.",
                    "Any single invoice exceeding $2,500.00 requires dual approval regardless of vendor status.",
                ])

    print(f"Demo dataset written to {os.path.abspath(OUT_DIR)}")


if __name__ == "__main__":
    main()
