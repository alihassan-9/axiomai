// API contract types — mirror backend/app/schemas.

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: "admin" | "analyst" | "viewer";
  is_active: boolean;
  created_at: string;
}

export interface Doc {
  id: string;
  type: "invoice" | "policy";
  filename: string;
  content_type: string;
  size_bytes: number;
  status: string;
  error?: string | null;
  created_at: string;
}

export interface LineItem {
  description: string;
  category: string;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  confidence?: number;
}

export interface Invoice {
  vendor: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  line_items: LineItem[];
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  grand_total: number | null;
}

export interface MathFinding {
  check: string;
  expected?: number;
  actual?: number;
  delta?: number;
  citation: string;
  severity: string;
  formula: string;
}

export interface PolicyFinding {
  source: string;
  severity: string;
  message: string;
  location?: string;
  policy_name?: string;
  policy_quote?: string;
  actual?: unknown;
  threshold?: unknown;
}

export interface Violation {
  id: string;
  rule_id: string | null;
  category: string;
  severity: string;
  explanation: string;
  detail_json: Record<string, unknown>;
}

export interface Audit {
  id: string;
  doc_id: string;
  status: "pending" | "running" | "completed" | "failed";
  findings_json: {
    invoice?: Invoice;
    math_findings?: MathFinding[];
    policy_findings?: PolicyFinding[];
    math_passed?: boolean;
    corrected?: boolean;
    extraction_method?: string;
    extraction_confidence?: number;
  };
  narrative: string;
  savings_amount: number;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  violations?: Violation[];
}

export interface PolicyRule {
  field: string;
  operator: "lt" | "lte" | "gt" | "gte" | "eq" | "neq" | "in" | "not_in" | "contains";
  value: unknown;
  when?: Record<string, unknown> | null;
  severity: "info" | "low" | "medium" | "high" | "critical";
  message: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  rule_json: { rules: PolicyRule[] };
  source_doc_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Summary {
  total_audits: number;
  completed_audits: number;
  failed_audits: number;
  total_violations: number;
  compliance_score: number;
  total_savings: number;
  documents_processed: number;
}

export interface TrendPoint {
  date: string;
  audits: number;
  violations: number;
  savings: number;
}

export interface ProgressEvent {
  step: string;
  status: string;
  message?: string;
  progress: number;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  ip_address: string;
  detail: Record<string, unknown>;
  timestamp: string;
}

export interface Usage {
  documents_uploaded: number;
  audits_run: number;
  storage_bytes: number;
  plan_tier: string;
}
