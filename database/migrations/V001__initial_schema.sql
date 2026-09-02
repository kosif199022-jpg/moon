-- ============================================================================
-- Organizations (Multi-tenant boundary)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  legal_name VARCHAR NOT NULL,
  country_code CHAR(2),
  audit_framework VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Users (Team members)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations,
  email VARCHAR UNIQUE NOT NULL,
  full_name VARCHAR,
  role VARCHAR, -- partner, engagement_manager, senior_auditor, junior_auditor, client_user, qa_reviewer
  auth_subject VARCHAR UNIQUE,
  status VARCHAR DEFAULT 'active', -- active, inactive, suspended
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT user_org_unique UNIQUE(organization_id, email)
);

-- ============================================================================
-- Engagements (Audit files)
-- ============================================================================

CREATE TABLE IF NOT EXISTS engagements (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations,
  client_name VARCHAR NOT NULL,
  period_start DATE,
  period_end DATE,
  status JSONB DEFAULT '{"state":"draft"}',
  framework VARCHAR, -- IFRS, IFRS_SME, Other
  currency VARCHAR DEFAULT 'SAR',
  revision INT DEFAULT 1,
  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagements_org ON engagements(organization_id);
CREATE INDEX IF NOT EXISTS idx_engagements_status ON engagements(status);
CREATE INDEX IF NOT EXISTS idx_engagements_created ON engagements(created_at DESC);

-- ============================================================================
-- Trial Balance Accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES engagements ON DELETE CASCADE,
  code VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  balance_minor NUMERIC NOT NULL, -- SAR cents, not floats
  balance_exp INT DEFAULT 2, -- Decimal exponent (always 2)
  currency VARCHAR DEFAULT 'SAR',
  balance_type VARCHAR, -- DEBIT, CREDIT
  revision INT DEFAULT 1,
  review_state VARCHAR DEFAULT 'draft', -- draft, reviewed, approved
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (balance_exp = 2),
  CONSTRAINT account_unique UNIQUE(engagement_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_engagement ON accounts(engagement_id);

-- ============================================================================
-- Evidence (Audit evidence/proof)
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES engagements ON DELETE CASCADE,
  object_key VARCHAR NOT NULL, -- s3://bucket/path
  sha256 VARCHAR(64) NOT NULL,
  filename VARCHAR,
  file_size BIGINT,
  classification VARCHAR, -- document, spreadsheet, email, communication, media
  relevance_score INT, -- 1-5
  reliability_score INT, -- 1-5
  review_state VARCHAR DEFAULT 'captured', -- captured, linked, evaluated, accepted, rejected
  source_ref VARCHAR,
  uploaded_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT evidence_unique UNIQUE(engagement_id, sha256)
);

CREATE INDEX IF NOT EXISTS idx_evidence_engagement ON evidence(engagement_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sha256 ON evidence(sha256);
CREATE INDEX IF NOT EXISTS idx_evidence_state ON evidence(review_state);

-- ============================================================================
-- Risks (Audit risks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS risks (
  id UUID PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES engagements ON DELETE CASCADE,
  area VARCHAR, -- revenue, payables, inventory, etc.
  assertions VARCHAR ARRAY, -- ARRAY['existence', 'completeness', ...]
  risk_type VARCHAR, -- inherent, control, detection
  score NUMERIC(5,2),
  factors JSONB DEFAULT '[]'::jsonb,
  rationale TEXT,
  status VARCHAR DEFAULT 'identified', -- identified, assessed, significant, responded, closed
  revision INT DEFAULT 1,
  review_state VARCHAR DEFAULT 'draft',
  created_by VARCHAR,
  reviewed_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risks_engagement ON risks(engagement_id);
CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status);

-- ============================================================================
-- Procedures (Audit procedures)
-- ============================================================================

CREATE TABLE IF NOT EXISTS procedures (
  id UUID PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES engagements ON DELETE CASCADE,
  risk_id UUID REFERENCES risks ON DELETE SET NULL,
  type VARCHAR, -- substantive, control, analytical, sampling, fraud
  objective TEXT NOT NULL,
  status VARCHAR DEFAULT 'proposed', -- proposed, planned, in_progress, completed, reviewed
  revision INT DEFAULT 1,
  preparer_id VARCHAR,
  reviewer_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_procedures_engagement ON procedures(engagement_id);
CREATE INDEX IF NOT EXISTS idx_procedures_risk ON procedures(risk_id);

-- ============================================================================
-- Workpapers (Procedure documentation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workpapers (
  id UUID PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES engagements ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES procedures ON DELETE CASCADE,
  content JSONB,
  version INT DEFAULT 1,
  status VARCHAR DEFAULT 'draft', -- draft, prepared, reviewer_open, cleared, approved, locked
  preparer_id VARCHAR,
  reviewer_id VARCHAR,
  signoff_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT workpaper_unique_version UNIQUE(id, version)
);

CREATE INDEX IF NOT EXISTS idx_workpapers_engagement ON workpapers(engagement_id);
CREATE INDEX IF NOT EXISTS idx_workpapers_procedure ON workpapers(procedure_id);

-- ============================================================================
-- Materiality Assessments (Version controlled)
-- ============================================================================

CREATE TABLE IF NOT EXISTS materiality_assessments (
  id UUID PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES engagements ON DELETE CASCADE,
  benchmark_code VARCHAR, -- revenue, net_income, total_assets, etc.
  benchmark_value_minor NUMERIC NOT NULL,
  percentage NUMERIC(5,2),
  overall_materiality_minor NUMERIC NOT NULL,
  performance_materiality_minor NUMERIC NOT NULL,
  trivial_threshold_minor NUMERIC NOT NULL,
  rationale TEXT,
  version INT DEFAULT 1,
  status VARCHAR DEFAULT 'draft', -- draft, calculated, manager_review, approved
  review_state VARCHAR DEFAULT 'draft',
  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (benchmark_value_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_materiality_engagement ON materiality_assessments(engagement_id);

-- ============================================================================
-- AI Decision Records (Proposals with full context)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_decision_records (
  id UUID PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES engagements ON DELETE CASCADE,
  agent_name VARCHAR,
  prompt_version VARCHAR,
  evidence_snapshot_hash VARCHAR(64),
  model_name VARCHAR,
  output JSONB,
  review_state VARCHAR DEFAULT 'draft', -- draft, reviewed, approved, rejected
  reviewer_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_engagement ON ai_decision_records(engagement_id);

-- ============================================================================
-- Audit Events (Immutable, tamper-evident log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
  event_id VARCHAR UNIQUE NOT NULL PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES engagements ON DELETE CASCADE,
  actor_type VARCHAR, -- human, ai, system
  actor_id VARCHAR,
  action VARCHAR NOT NULL, -- WORKPAPER_APPROVED, RISK_IDENTIFIED, etc.
  target_type VARCHAR,
  target_id VARCHAR,
  target_version INT,
  correlation_id VARCHAR,
  causation_id VARCHAR,
  details JSONB,
  integrity_hash VARCHAR(64),
  occurred_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_engagement ON audit_events(engagement_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_target ON audit_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_occurred ON audit_events(occurred_at DESC);

-- ============================================================================
-- Provenance Records (Traceability for computed artifacts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS provenance_records (
  id UUID PRIMARY KEY,
  artifact_id VARCHAR NOT NULL,
  artifact_type VARCHAR NOT NULL,
  source_ids VARCHAR ARRAY,
  engine VARCHAR, -- moon, kosif-v2, ai
  engine_version VARCHAR,
  input_hash VARCHAR(64),
  generated_at TIMESTAMP,
  actor_id VARCHAR,
  review_state VARCHAR DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provenance_artifact ON provenance_records(artifact_type, artifact_id);

-- ============================================================================
-- Confirm schema creation
-- ============================================================================

SELECT 'Schema initialized successfully' AS status;
