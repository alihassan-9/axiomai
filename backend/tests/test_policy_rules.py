"""Unit tests — deterministic policy rule engine."""
from app.agents.policy_compliance import _evaluate_rule

INVOICE = {
    "vendor": "CloudSoft Inc", "grand_total": 750.0,
    "line_items": [
        {"description": "IDE licence", "category": "Software", "line_total": 600.0},
        {"description": "Team lunch", "category": "Meals", "line_total": 150.0},
    ],
}


def test_threshold_rule_violated():
    rule = {"field": "grand_total", "operator": "gt", "value": 500,
            "severity": "high", "message": "Invoice exceeds $500 approval threshold"}
    violations = _evaluate_rule(rule, INVOICE)
    assert len(violations) == 1
    assert violations[0]["severity"] == "high"
    assert violations[0]["actual"] == 750.0


def test_threshold_rule_passes():
    rule = {"field": "grand_total", "operator": "gt", "value": 1000}
    assert _evaluate_rule(rule, INVOICE) == []


def test_line_item_rule_with_condition():
    rule = {"field": "line_items[].line_total", "operator": "gt", "value": 500,
            "when": {"category": "Software"}, "message": "Software spend cap is $500/mo"}
    violations = _evaluate_rule(rule, INVOICE)
    assert len(violations) == 1
    assert "IDE licence" in violations[0]["location"]


def test_condition_excludes_other_categories():
    rule = {"field": "line_items[].line_total", "operator": "gt", "value": 100,
            "when": {"category": "Travel"}}
    assert _evaluate_rule(rule, INVOICE) == []


def test_vendor_not_in_allowlist():
    rule = {"field": "vendor", "operator": "not_in",
            "value": ["Acme Corp", "Globex"], "message": "Vendor not on approved list"}
    violations = _evaluate_rule(rule, INVOICE)
    assert len(violations) == 1


def test_unknown_operator_ignored():
    assert _evaluate_rule({"field": "grand_total", "operator": "wat", "value": 1}, INVOICE) == []


def test_string_number_coercion():
    rule = {"field": "grand_total", "operator": "gt", "value": 500}
    violations = _evaluate_rule(rule, {"grand_total": "$1,200.00"})
    assert len(violations) == 1
