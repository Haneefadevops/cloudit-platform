-- Phase 9: atomic, one-use private-PDF retrieval claims. This table contains
-- only a SHA-256 nonce hash and lifecycle timestamps; never a PDF, R2 key,
-- provider URL, credential, or report body.
BEGIN;

CREATE TABLE IF NOT EXISTS operations.report_pdf_retrieval_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  report_id uuid NOT NULL,
  nonce_hash text NOT NULL CHECK (nonce_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_pdf_retrieval_nonce UNIQUE (nonce_hash),
  CONSTRAINT fk_report_pdf_retrieval_report
    FOREIGN KEY (client_id, report_id) REFERENCES operations.reports (client_id, id)
);

REVOKE ALL ON operations.report_pdf_retrieval_nonces FROM PUBLIC;
-- Migration 0003 grants SELECT on future operations tables by default. This
-- replay ledger is intentionally function-only, including for the portal role.
REVOKE ALL ON operations.report_pdf_retrieval_nonces FROM operations_owner, operations_ingest, operations_anon;
ALTER TABLE operations.report_pdf_retrieval_nonces ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION operations_private.claim_report_pdf_retrieval(
  p_report_key text,
  p_nonce_hash text,
  p_expires_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE v_report operations.reports%ROWTYPE;
BEGIN
  IF NOT operations_private.is_owner_context()
     OR p_nonce_hash !~ '^[a-f0-9]{64}$'
     OR p_expires_at <= now() OR p_expires_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'pdf_retrieval_denied' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_report FROM operations.reports
  WHERE report_key = p_report_key AND pdf_available AND document_status IN
    ('DRAFT', 'APPROVED', 'SENDING', 'SENT', 'REJECTED', 'SEND_FAILED');
  IF NOT FOUND THEN RAISE EXCEPTION 'pdf_retrieval_denied' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO operations.report_pdf_retrieval_nonces (client_id, report_id, nonce_hash, expires_at)
  VALUES (v_report.client_id, v_report.id, p_nonce_hash, p_expires_at);
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'pdf_retrieval_denied' USING ERRCODE = 'P0001';
END;
$func$;

REVOKE ALL ON FUNCTION operations_private.claim_report_pdf_retrieval(text, text, timestamptz) FROM PUBLIC, operations_ingest, operations_anon;
GRANT EXECUTE ON FUNCTION operations_private.claim_report_pdf_retrieval(text, text, timestamptz) TO operations_owner;
COMMIT;
