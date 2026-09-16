-- Phase 10: guarded report-command lifecycle primitives.
--
-- Additive completion of the Phase 0 command contract on top of
-- operations.report_commands / operations_private.create_report_command:
--   * lifecycle timestamps, idempotency request key and stored payload
--     signature (re-dispatch of an unclaimed command re-sends the identical
--     signed payload; the plaintext wire nonce is never stored — the nonce
--     column holds its SHA-256 hex, matching the 0010 replay-ledger pattern);
--   * closed status/result-code constraints (status values 'signed'/'sent'
--     from the original Phase 0 constraint are retained so the constraint
--     recreation stays valid on any pre-existing rows, but only the
--     Phase 10 lifecycle values are emitted);
--   * security-definer functions to create (idempotent), dispatch, claim,
--     acknowledge, complete, expire and reconcile commands. Expected
--     business denials RETURN a safe denial_code and persist an append-only
--     audit entry; only programmer-shape errors raise. All DML inside the
--     functions aliases the target table because the RETURNS TABLE out
--     parameters shadow column names. No function writes report state: the
--     portal remains structurally unable to mutate reports.
--
-- Only migration 0011 objects are defined here; older migrations are not
-- edited. Everything is idempotent (IF NOT EXISTS / DROP IF EXISTS).

BEGIN;

-- ---------------------------------------------------------------------------
-- Additive columns
-- ---------------------------------------------------------------------------

ALTER TABLE operations.report_commands
  ADD COLUMN IF NOT EXISTS request_key       text,
  ADD COLUMN IF NOT EXISTS correlation_id    text,
  ADD COLUMN IF NOT EXISTS issued_at         timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at     timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_at   timestamptz,
  ADD COLUMN IF NOT EXISTS payload_signature text;

-- ---------------------------------------------------------------------------
-- Closed constraints (drop + re-add keeps the migration idempotent)
-- ---------------------------------------------------------------------------

-- Status: Phase 10 lifecycle plus the two legacy Phase 0 values so the
-- constraint remains valid on any pre-existing rows. New code only emits
-- the Phase 10 values.
ALTER TABLE operations.report_commands DROP CONSTRAINT IF EXISTS report_commands_status_check;
ALTER TABLE operations.report_commands
  ADD CONSTRAINT report_commands_status_check CHECK (
    status IN (
      'pending', 'dispatched', 'claimed', 'acknowledged', 'completed',
      'failed_safe', 'rejected_stale_version', 'rejected_state',
      'rejected_expired', 'rejected_replay',
      -- legacy Phase 0 values, retained for constraint compatibility only:
      'signed', 'sent'
    )
  );

-- Fixed safe result codes. Everything outside this list is a bug, not a
-- state. NULL is allowed while a command is in flight.
ALTER TABLE operations.report_commands DROP CONSTRAINT IF EXISTS report_commands_result_code_check;
ALTER TABLE operations.report_commands
  ADD CONSTRAINT report_commands_result_code_check CHECK (
    result_code IS NULL OR result_code IN (
      'accepted', 'already_recorded', 'dispatch_pending', 'acknowledged',
      'sent', 'send_failed',
      'rejected_replay', 'rejected_expired', 'rejected_stale_version',
      'rejected_state', 'rejected_pdf_unavailable',
      'rejected_recipient_policy', 'failed_safe'
    )
  );

ALTER TABLE operations.report_commands DROP CONSTRAINT IF EXISTS report_commands_request_key_check;
ALTER TABLE operations.report_commands
  ADD CONSTRAINT report_commands_request_key_check CHECK (
    request_key IS NULL OR request_key ~ '^[A-Za-z0-9_-]{21,120}$'
  );

ALTER TABLE operations.report_commands DROP CONSTRAINT IF EXISTS report_commands_correlation_id_check;
ALTER TABLE operations.report_commands
  ADD CONSTRAINT report_commands_correlation_id_check CHECK (
    correlation_id IS NULL OR correlation_id ~ '^[a-f0-9]{32}$'
  );

ALTER TABLE operations.report_commands DROP CONSTRAINT IF EXISTS report_commands_payload_signature_check;
ALTER TABLE operations.report_commands
  ADD CONSTRAINT report_commands_payload_signature_check CHECK (
    payload_signature IS NULL OR payload_signature ~ '^[a-f0-9]{64}$'
  );

-- Idempotent owner request key: a repeated submission (double click,
-- idempotent client retry) returns the originally recorded command instead
-- of creating a second one. request_key is an opaque server-derived token
-- bound to actor, report, action and render nonce by the caller.
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_commands_request
  ON operations.report_commands (
    client_id,
    command_type,
    report_id,
    request_key,
    COALESCE(requested_by, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE request_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_report_commands_status_expiry
  ON operations.report_commands (status, expires_at)
  WHERE status IN ('pending', 'dispatched', 'claimed');

-- ---------------------------------------------------------------------------
-- Narrow audit writer with closed allowlists for the command lifecycle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations_private.record_report_command_event(
  p_actor_type       text,
  p_actor_key        text,
  p_action           text,
  p_result           text,
  p_client_id        uuid DEFAULT NULL,
  p_command_key      text DEFAULT NULL,
  p_safe_reason_code text DEFAULT NULL,
  p_correlation_key  text DEFAULT NULL,
  p_occurred_at      timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  IF p_actor_type NOT IN ('portal_user', 'n8n', 'system') THEN
    RAISE EXCEPTION 'invalid_actor_type' USING ERRCODE = 'P0001';
  END IF;
  IF p_action NOT IN (
    'report.command.request', 'report.command.dispatch', 'report.command.claim',
    'report.command.acknowledge', 'report.command.complete',
    'report.command.expire', 'report.command.deny'
  ) THEN
    RAISE EXCEPTION 'invalid_command_action' USING ERRCODE = 'P0001';
  END IF;
  IF p_result NOT IN ('success', 'denied', 'error', 'allowed') THEN
    RAISE EXCEPTION 'invalid_command_result' USING ERRCODE = 'P0001';
  END IF;
  IF p_safe_reason_code IS NOT NULL AND p_safe_reason_code NOT IN (
    'accepted', 'already_recorded', 'dispatch_pending', 'acknowledged',
    'sent', 'send_failed', 'denied_role',
    'rejected_replay', 'rejected_expired', 'rejected_stale_version',
    'rejected_state', 'rejected_pdf_unavailable', 'rejected_recipient_policy',
    'rejected_auth', 'rejected_csrf', 'rejected_mfa', 'rejected_rate_limit',
    'failed_safe'
  ) THEN
    RAISE EXCEPTION 'invalid_safe_reason_code' USING ERRCODE = 'P0001';
  END IF;
  RETURN operations_private.record_audit_event(
    p_actor_type, p_actor_key, p_action, 'report_command', p_command_key,
    p_result, p_client_id, p_command_key, p_safe_reason_code,
    p_correlation_key, p_occurred_at
  );
END;
$func$;

-- ---------------------------------------------------------------------------
-- Idempotent command creation (portal, owner context)
-- ---------------------------------------------------------------------------

-- Creates a pending command or returns the originally recorded command for
-- the same idempotency identity. p_nonce_hash must be the SHA-256 hex of the
-- wire nonce; only that hash is persisted (the nonce column stores the hash,
-- so a database read never yields a replayable nonce). Denials return a
-- denial_code and persist audit; only shape errors raise.
CREATE OR REPLACE FUNCTION operations_private.create_report_command_request(
  p_request_key          text,
  p_command_key          text,
  p_report_key           text,
  p_command_type         text,
  p_expected_row_version integer,
  p_expected_state       text,
  p_nonce_hash           text,
  p_expires_at           timestamptz,
  p_correlation_id       text,
  p_requested_by         uuid DEFAULT NULL,
  p_client_id            uuid DEFAULT NULL
)
RETURNS TABLE(
  command_id       uuid,
  command_key      text,
  command_type     text,
  status           text,
  result_code      text,
  expires_at       timestamptz,
  already_recorded boolean,
  denial_code      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_report  operations.reports%ROWTYPE;
  v_command operations.report_commands%ROWTYPE;
  v_new_id  uuid;
BEGIN
  IF p_request_key !~ '^[A-Za-z0-9_-]{21,120}$'
     OR p_command_key !~ '^[a-f0-9]{32}$'
     OR p_correlation_id !~ '^[a-f0-9]{32}$'
     OR p_nonce_hash !~ '^[a-f0-9]{64}$'
     OR p_expected_row_version IS NULL OR p_expected_row_version <= 0
     OR p_expires_at IS NULL
     OR p_expires_at <= now()
     OR p_expires_at > now() + interval '15 minutes' THEN
    RAISE EXCEPTION 'invalid_command_request_shape' USING ERRCODE = 'P0001';
  END IF;

  IF NOT operations_private.is_owner_context() THEN
    PERFORM operations_private.record_report_command_event(
      'portal_user', COALESCE(p_requested_by::text, 'unknown'),
      'report.command.request', 'denied', p_client_id, p_command_key, 'denied_role',
      p_correlation_id
    );
    denial_code := 'denied_role';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Idempotent repeat: return the originally recorded command.
  SELECT c.* INTO v_command
  FROM operations.report_commands AS c
  JOIN operations.reports AS r
    ON r.client_id = c.client_id AND r.id = c.report_id
  WHERE c.client_id = p_client_id
    AND c.command_type = p_command_type
    AND c.request_key = p_request_key
    AND r.report_key = p_report_key
    AND c.requested_by IS NOT DISTINCT FROM p_requested_by;
  IF FOUND THEN
    -- Lazily expire an in-flight command whose window has closed.
    IF v_command.status IN ('pending', 'dispatched', 'claimed')
       AND v_command.expires_at <= now() THEN
      UPDATE operations.report_commands AS t
      SET status = 'rejected_expired', result_code = 'rejected_expired',
          completed_at = now()
      WHERE t.id = v_command.id AND t.status = v_command.status;
      PERFORM operations_private.record_report_command_event(
        'system', 'command-sweep', 'report.command.expire', 'denied',
        p_client_id, v_command.command_key, 'rejected_expired',
        v_command.correlation_id
      );
      v_command.status := 'rejected_expired';
      v_command.result_code := 'rejected_expired';
    END IF;
    command_id := v_command.id;
    command_key := v_command.command_key;
    command_type := v_command.command_type;
    status := v_command.status;
    result_code := v_command.result_code;
    expires_at := v_command.expires_at;
    already_recorded := true;
    denial_code := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_command_type NOT IN ('APPROVE_AND_SEND', 'REJECT', 'RETRY_SEND') THEN
    RAISE EXCEPTION 'unsupported_command_type' USING ERRCODE = 'P0001';
  END IF;
  IF (p_command_type IN ('APPROVE_AND_SEND', 'REJECT') AND p_expected_state <> 'DRAFT')
     OR (p_command_type = 'RETRY_SEND' AND p_expected_state <> 'SEND_FAILED') THEN
    RAISE EXCEPTION 'invalid_expected_state' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_report
  FROM operations.reports
  WHERE client_id = p_client_id AND report_key = p_report_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_report' USING ERRCODE = 'P0001';
  END IF;

  IF v_report.row_version IS DISTINCT FROM p_expected_row_version
     OR v_report.document_status IS DISTINCT FROM p_expected_state THEN
    PERFORM operations_private.record_report_command_event(
      'portal_user', COALESCE(p_requested_by::text, 'unknown'),
      'report.command.request', 'denied', p_client_id, p_command_key,
      'rejected_stale_version', p_correlation_id
    );
    denial_code := 'rejected_stale_version';
    RETURN NEXT;
    RETURN;
  END IF;

  -- SENT is terminal and can never be commanded again.
  IF v_report.sent_at IS NOT NULL OR v_report.document_status = 'SENT' THEN
    PERFORM operations_private.record_report_command_event(
      'portal_user', COALESCE(p_requested_by::text, 'unknown'),
      'report.command.request', 'denied', p_client_id, p_command_key,
      'rejected_state', p_correlation_id
    );
    denial_code := 'rejected_state';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_command_type = 'APPROVE_AND_SEND' AND NOT v_report.pdf_available THEN
    PERFORM operations_private.record_report_command_event(
      'portal_user', COALESCE(p_requested_by::text, 'unknown'),
      'report.command.request', 'denied', p_client_id, p_command_key,
      'rejected_pdf_unavailable', p_correlation_id
    );
    denial_code := 'rejected_pdf_unavailable';
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO operations.report_commands (
    client_id, report_id, command_key, command_type, expected_row_version,
    expected_state, nonce, expires_at, requested_by, status,
    request_key, correlation_id, issued_at
  ) VALUES (
    p_client_id, v_report.id, p_command_key, p_command_type,
    p_expected_row_version, p_expected_state, p_nonce_hash, p_expires_at,
    p_requested_by, 'pending', p_request_key, p_correlation_id, now()
  )
  ON CONFLICT (nonce) DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    PERFORM operations_private.record_report_command_event(
      'portal_user', COALESCE(p_requested_by::text, 'unknown'),
      'report.command.request', 'denied', p_client_id, p_command_key,
      'rejected_replay', p_correlation_id
    );
    denial_code := 'rejected_replay';
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM operations_private.record_report_command_event(
    'portal_user', COALESCE(p_requested_by::text, 'unknown'),
    'report.command.request', 'success', p_client_id, p_command_key,
    'accepted', p_correlation_id
  );

  command_id := v_new_id;
  command_key := p_command_key;
  command_type := p_command_type;
  status := 'pending';
  result_code := NULL;
  expires_at := p_expires_at;
  already_recorded := false;
  denial_code := NULL;
  RETURN NEXT;
EXCEPTION WHEN unique_violation THEN
  -- Concurrent insert with the same idempotency identity: return the winner.
  SELECT c.* INTO v_command
  FROM operations.report_commands AS c
  JOIN operations.reports AS r
    ON r.client_id = c.client_id AND r.id = c.report_id
  WHERE c.client_id = p_client_id
    AND c.command_type = p_command_type
    AND c.request_key = p_request_key
    AND r.report_key = p_report_key
    AND c.requested_by IS NOT DISTINCT FROM p_requested_by;
  IF FOUND THEN
    PERFORM operations_private.record_report_command_event(
      'portal_user', COALESCE(p_requested_by::text, 'unknown'),
      'report.command.request', 'allowed', p_client_id, v_command.command_key,
      'already_recorded', v_command.correlation_id
    );
    command_id := v_command.id;
    command_key := v_command.command_key;
    command_type := v_command.command_type;
    status := v_command.status;
    result_code := v_command.result_code;
    expires_at := v_command.expires_at;
    already_recorded := true;
    denial_code := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  RAISE;
END;
$func$;

-- ---------------------------------------------------------------------------
-- Dispatch claim (portal): exactly one server dispatch owns the signed
-- delivery attempt. The signature is stored so an unclaimed command can be
-- re-dispatched byte-identically.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations_private.dispatch_report_command(
  p_command_key       text,
  p_client_key        text,
  p_payload_signature text
)
RETURNS TABLE(
  command_id  uuid,
  status      text,
  result_code text,
  denial_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_command operations.report_commands%ROWTYPE;
BEGIN
  IF p_command_key !~ '^[a-f0-9]{32}$'
     OR p_client_key !~ '^[a-z0-9][a-z0-9_.-]{1,120}$'
     OR p_payload_signature !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_dispatch_shape' USING ERRCODE = 'P0001';
  END IF;

  IF NOT operations_private.is_owner_context() THEN
    PERFORM operations_private.record_report_command_event(
      'system', 'dispatch', 'report.command.dispatch', 'denied',
      NULL, p_command_key, 'denied_role'
    );
    denial_code := 'denied_role';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT c.* INTO v_command
  FROM operations.report_commands AS c
  JOIN operations.clients AS cl ON cl.id = c.client_id
  WHERE c.command_key = p_command_key AND cl.client_key = p_client_key;
  IF NOT FOUND THEN
    PERFORM operations_private.record_report_command_event(
      'system', 'dispatch', 'report.command.dispatch', 'denied',
      NULL, p_command_key, 'rejected_replay'
    );
    denial_code := 'rejected_replay';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_command.status = 'pending' AND v_command.expires_at <= now() THEN
    UPDATE operations.report_commands AS t
    SET status = 'rejected_expired', result_code = 'rejected_expired',
        completed_at = now()
    WHERE t.id = v_command.id AND t.status = 'pending';
    PERFORM operations_private.record_report_command_event(
      'system', 'command-sweep', 'report.command.expire', 'denied',
      v_command.client_id, v_command.command_key, 'rejected_expired',
      v_command.correlation_id
    );
    denial_code := 'rejected_expired';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE operations.report_commands AS t
  SET status = 'dispatched', dispatched_at = now(),
      payload_signature = p_payload_signature, result_code = 'dispatch_pending'
  WHERE t.id = v_command.id AND t.status = 'pending'
  RETURNING t.id INTO command_id;

  IF command_id IS NULL THEN
    PERFORM operations_private.record_report_command_event(
      'system', 'dispatch', 'report.command.dispatch', 'denied',
      v_command.client_id, v_command.command_key, 'rejected_replay',
      v_command.correlation_id
    );
    denial_code := 'rejected_replay';
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM operations_private.record_report_command_event(
    'system', 'dispatch', 'report.command.dispatch', 'success',
    v_command.client_id, v_command.command_key, 'dispatch_pending',
    v_command.correlation_id
  );
  status := 'dispatched';
  result_code := 'dispatch_pending';
  denial_code := NULL;
  RETURN NEXT;
END;
$func$;

-- ---------------------------------------------------------------------------
-- Atomic webhook claim (n8n command workflow, via platform-api internal
-- endpoint): one-use nonce claim bound to client scope, dispatch state and
-- expiry, with a mirror reload guard against stale versions and wrong
-- states. Denials terminate the command where applicable and never touch
-- report state.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations_private.claim_report_command(
  p_command_key text,
  p_client_key  text,
  p_nonce_hash  text
)
RETURNS TABLE(
  command_id           uuid,
  report_key           text,
  command_type         text,
  expected_row_version integer,
  expected_state       text,
  status               text,
  result_code          text,
  denial_code          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_command operations.report_commands%ROWTYPE;
  v_report  operations.reports%ROWTYPE;
BEGIN
  IF p_command_key !~ '^[a-f0-9]{32}$'
     OR p_client_key !~ '^[a-z0-9][a-z0-9_.-]{1,120}$'
     OR p_nonce_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_claim_shape' USING ERRCODE = 'P0001';
  END IF;

  IF NOT operations_private.is_owner_context() THEN
    PERFORM operations_private.record_report_command_event(
      'n8n', 'command-webhook', 'report.command.claim', 'denied',
      NULL, p_command_key, 'denied_role'
    );
    denial_code := 'denied_role';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT c.* INTO v_command
  FROM operations.report_commands AS c
  JOIN operations.clients AS cl ON cl.id = c.client_id
  WHERE c.command_key = p_command_key AND cl.client_key = p_client_key;
  IF NOT FOUND
     OR v_command.nonce IS DISTINCT FROM p_nonce_hash
     OR v_command.status <> 'dispatched' THEN
    PERFORM operations_private.record_report_command_event(
      'n8n', 'command-webhook', 'report.command.claim', 'denied',
      v_command.client_id, p_command_key, 'rejected_replay'
    );
    denial_code := 'rejected_replay';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_command.expires_at <= now() THEN
    UPDATE operations.report_commands AS t
    SET status = 'rejected_expired', result_code = 'rejected_expired',
        completed_at = now()
    WHERE t.id = v_command.id AND t.status = 'dispatched';
    PERFORM operations_private.record_report_command_event(
      'n8n', 'command-webhook', 'report.command.expire', 'denied',
      v_command.client_id, v_command.command_key, 'rejected_expired',
      v_command.correlation_id
    );
    denial_code := 'rejected_expired';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Mirror reload guard: the authoritative n8n Data Table gets its own
  -- compare-and-set, but a drifted mirror is rejected here, before any
  -- action is attempted.
  SELECT * INTO v_report
  FROM operations.reports
  WHERE client_id = v_command.client_id AND id = v_command.report_id;
  IF v_report.row_version IS DISTINCT FROM v_command.expected_row_version THEN
    UPDATE operations.report_commands AS t
    SET status = 'rejected_stale_version', result_code = 'rejected_stale_version',
        completed_at = now()
    WHERE t.id = v_command.id AND t.status = 'dispatched';
    PERFORM operations_private.record_report_command_event(
      'n8n', 'command-webhook', 'report.command.claim', 'denied',
      v_command.client_id, v_command.command_key, 'rejected_stale_version',
      v_command.correlation_id
    );
    denial_code := 'rejected_stale_version';
    RETURN NEXT;
    RETURN;
  END IF;
  IF v_report.document_status IS DISTINCT FROM v_command.expected_state
     OR v_report.sent_at IS NOT NULL THEN
    UPDATE operations.report_commands AS t
    SET status = 'rejected_state', result_code = 'rejected_state',
        completed_at = now()
    WHERE t.id = v_command.id AND t.status = 'dispatched';
    PERFORM operations_private.record_report_command_event(
      'n8n', 'command-webhook', 'report.command.claim', 'denied',
      v_command.client_id, v_command.command_key, 'rejected_state',
      v_command.correlation_id
    );
    denial_code := 'rejected_state';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE operations.report_commands AS t
  SET status = 'claimed', claimed_at = now(), result_code = 'accepted'
  WHERE t.id = v_command.id AND t.status = 'dispatched'
  RETURNING t.id INTO command_id;

  IF command_id IS NULL THEN
    PERFORM operations_private.record_report_command_event(
      'n8n', 'command-webhook', 'report.command.claim', 'denied',
      v_command.client_id, v_command.command_key, 'rejected_replay',
      v_command.correlation_id
    );
    denial_code := 'rejected_replay';
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM operations_private.record_report_command_event(
    'n8n', 'command-webhook', 'report.command.claim', 'success',
    v_command.client_id, v_command.command_key, 'accepted',
    v_command.correlation_id
  );

  SELECT r.report_key INTO report_key
  FROM operations.reports AS r
  WHERE r.client_id = v_command.client_id AND r.id = v_command.report_id;
  command_type := v_command.command_type;
  expected_row_version := v_command.expected_row_version;
  expected_state := v_command.expected_state;
  status := 'claimed';
  result_code := 'accepted';
  denial_code := NULL;
  RETURN NEXT;
END;
$func$;

-- ---------------------------------------------------------------------------
-- Acknowledge (n8n command workflow): 'acknowledged' keeps the command in
-- flight for sender reconciliation; every other allowed code is a terminal
-- denial with the matching status. Compare-and-set from 'claimed' only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations_private.acknowledge_report_command(
  p_command_key text,
  p_client_key  text,
  p_result_code text
)
RETURNS TABLE(
  command_id  uuid,
  status      text,
  result_code text,
  denial_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_command  operations.report_commands%ROWTYPE;
  v_terminal boolean;
BEGIN
  IF p_command_key !~ '^[a-f0-9]{32}$'
     OR p_client_key !~ '^[a-z0-9][a-z0-9_.-]{1,120}$'
     OR p_result_code IS NULL
     OR p_result_code NOT IN (
       'acknowledged', 'rejected_state', 'rejected_stale_version',
       'rejected_pdf_unavailable', 'rejected_recipient_policy', 'failed_safe'
     ) THEN
    RAISE EXCEPTION 'invalid_acknowledge_shape' USING ERRCODE = 'P0001';
  END IF;

  IF NOT operations_private.is_owner_context() THEN
    PERFORM operations_private.record_report_command_event(
      'n8n', 'command-webhook', 'report.command.acknowledge', 'denied',
      NULL, p_command_key, 'denied_role'
    );
    denial_code := 'denied_role';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT c.* INTO v_command
  FROM operations.report_commands AS c
  JOIN operations.clients AS cl ON cl.id = c.client_id
  WHERE c.command_key = p_command_key AND cl.client_key = p_client_key;
  IF NOT FOUND OR v_command.status <> 'claimed' THEN
    PERFORM operations_private.record_report_command_event(
      'n8n', 'command-webhook', 'report.command.acknowledge', 'denied',
      v_command.client_id, p_command_key, 'rejected_replay'
    );
    denial_code := 'rejected_replay';
    RETURN NEXT;
    RETURN;
  END IF;

  v_terminal := p_result_code <> 'acknowledged';

  UPDATE operations.report_commands AS t
  SET status = CASE WHEN v_terminal THEN p_result_code ELSE 'acknowledged' END,
      acknowledged_at = now(),
      result_code = p_result_code,
      completed_at = CASE WHEN v_terminal THEN now() ELSE completed_at END
  WHERE t.id = v_command.id AND t.status = 'claimed'
  RETURNING t.id INTO command_id;

  IF command_id IS NULL THEN
    PERFORM operations_private.record_report_command_event(
      'n8n', 'command-webhook', 'report.command.acknowledge', 'denied',
      v_command.client_id, v_command.command_key, 'rejected_replay',
      v_command.correlation_id
    );
    denial_code := 'rejected_replay';
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM operations_private.record_report_command_event(
    'n8n', 'command-webhook', 'report.command.acknowledge',
    CASE WHEN v_terminal THEN 'denied' ELSE 'success' END,
    v_command.client_id, v_command.command_key, p_result_code,
    v_command.correlation_id
  );
  status := CASE WHEN v_terminal THEN p_result_code ELSE 'acknowledged' END;
  result_code := p_result_code;
  denial_code := CASE WHEN v_terminal THEN p_result_code ELSE NULL END;
  RETURN NEXT;
END;
$func$;

-- ---------------------------------------------------------------------------
-- Complete (reconciliation): compare-and-set from 'acknowledged' to
-- 'completed' with the observed safe outcome. SENT requires the sender's
-- real sentAt, which the mirror only carries after the authoritative
-- publisher posts it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations_private.complete_report_command(
  p_command_key text,
  p_client_key  text,
  p_result_code text
)
RETURNS TABLE(
  command_id  uuid,
  status      text,
  result_code text,
  denial_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_command operations.report_commands%ROWTYPE;
BEGIN
  IF p_command_key !~ '^[a-f0-9]{32}$'
     OR p_client_key !~ '^[a-z0-9][a-z0-9_.-]{1,120}$'
     OR p_result_code NOT IN ('sent', 'send_failed') THEN
    RAISE EXCEPTION 'invalid_complete_shape' USING ERRCODE = 'P0001';
  END IF;

  IF NOT operations_private.is_owner_context() THEN
    PERFORM operations_private.record_report_command_event(
      'system', 'reconcile', 'report.command.complete', 'denied',
      NULL, p_command_key, 'denied_role'
    );
    denial_code := 'denied_role';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT c.* INTO v_command
  FROM operations.report_commands AS c
  JOIN operations.clients AS cl ON cl.id = c.client_id
  WHERE c.command_key = p_command_key AND cl.client_key = p_client_key;
  IF NOT FOUND OR v_command.status <> 'acknowledged' THEN
    PERFORM operations_private.record_report_command_event(
      'system', 'reconcile', 'report.command.complete', 'denied',
      v_command.client_id, p_command_key, 'rejected_replay'
    );
    denial_code := 'rejected_replay';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE operations.report_commands AS t
  SET status = 'completed', result_code = p_result_code, completed_at = now()
  WHERE t.id = v_command.id AND t.status = 'acknowledged'
  RETURNING t.id INTO command_id;

  IF command_id IS NULL THEN
    PERFORM operations_private.record_report_command_event(
      'system', 'reconcile', 'report.command.complete', 'denied',
      v_command.client_id, v_command.command_key, 'rejected_replay',
      v_command.correlation_id
    );
    denial_code := 'rejected_replay';
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM operations_private.record_report_command_event(
    'system', 'reconcile', 'report.command.complete', 'success',
    v_command.client_id, v_command.command_key, p_result_code,
    v_command.correlation_id
  );
  status := 'completed';
  result_code := p_result_code;
  denial_code := NULL;
  RETURN NEXT;
END;
$func$;

-- ---------------------------------------------------------------------------
-- Reconciliation sweep (platform-api): expire in-flight commands whose
-- window closed and complete acknowledged commands whose authoritative
-- outcome the mirror now shows (SENT / SEND_FAILED, which require the
-- sender's real timestamps). Never writes report state.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations_private.reconcile_report_commands(
  p_limit integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_rec     record;
  v_handled integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'invalid_reconcile_limit' USING ERRCODE = 'P0001';
  END IF;

  IF NOT operations_private.is_owner_context() THEN
    RAISE EXCEPTION 'denied_role' USING ERRCODE = 'P0001';
  END IF;

  FOR v_rec IN
    WITH sel AS (
      SELECT c.id
      FROM operations.report_commands AS c
      WHERE c.status IN ('pending', 'dispatched', 'claimed')
        AND c.expires_at <= now()
      ORDER BY c.expires_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    UPDATE operations.report_commands AS t
    SET status = 'rejected_expired', result_code = 'rejected_expired',
        completed_at = now()
    FROM sel
    WHERE t.id = sel.id AND t.status IN ('pending', 'dispatched', 'claimed')
    RETURNING t.id, t.client_id, t.command_key, t.correlation_id
  LOOP
    PERFORM operations_private.record_report_command_event(
      'system', 'command-sweep', 'report.command.expire', 'denied',
      v_rec.client_id, v_rec.command_key, 'rejected_expired',
      v_rec.correlation_id
    );
    v_handled := v_handled + 1;
  END LOOP;

  FOR v_rec IN
    WITH sel AS (
      SELECT c.id, r.document_status
      FROM operations.report_commands AS c
      JOIN operations.reports AS r
        ON r.client_id = c.client_id AND r.id = c.report_id
      WHERE c.status = 'acknowledged'
        AND r.document_status IN ('SENT', 'SEND_FAILED')
      ORDER BY c.expires_at
      LIMIT p_limit
      FOR UPDATE OF c SKIP LOCKED
    )
    UPDATE operations.report_commands AS t
    SET status = 'completed',
        result_code = CASE
          WHEN sel.document_status = 'SENT' THEN 'sent'
          ELSE 'send_failed'
        END,
        completed_at = now()
    FROM sel
    WHERE t.id = sel.id AND t.status = 'acknowledged'
    RETURNING t.id, t.client_id, t.command_key, t.correlation_id,
      CASE WHEN sel.document_status = 'SENT' THEN 'sent' ELSE 'send_failed' END AS outcome
  LOOP
    PERFORM operations_private.record_report_command_event(
      'system', 'reconcile', 'report.command.complete', 'success',
      v_rec.client_id, v_rec.command_key, v_rec.outcome,
      v_rec.correlation_id
    );
    v_handled := v_handled + 1;
  END LOOP;

  RETURN v_handled;
END;
$func$;

-- ---------------------------------------------------------------------------
-- Grants: portal role only; ingest and anonymous roles have no execute.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION operations_private.record_report_command_event(text, text, text, text, uuid, text, text, text, timestamptz) FROM PUBLIC, operations_ingest, operations_anon;
GRANT EXECUTE ON FUNCTION operations_private.record_report_command_event(text, text, text, text, uuid, text, text, text, timestamptz) TO operations_owner;

REVOKE ALL ON FUNCTION operations_private.create_report_command_request(text, text, text, text, integer, text, text, timestamptz, text, uuid, uuid) FROM PUBLIC, operations_ingest, operations_anon;
GRANT EXECUTE ON FUNCTION operations_private.create_report_command_request(text, text, text, text, integer, text, text, timestamptz, text, uuid, uuid) TO operations_owner;

REVOKE ALL ON FUNCTION operations_private.dispatch_report_command(text, text, text) FROM PUBLIC, operations_ingest, operations_anon;
GRANT EXECUTE ON FUNCTION operations_private.dispatch_report_command(text, text, text) TO operations_owner;

REVOKE ALL ON FUNCTION operations_private.claim_report_command(text, text, text) FROM PUBLIC, operations_ingest, operations_anon;
GRANT EXECUTE ON FUNCTION operations_private.claim_report_command(text, text, text) TO operations_owner;

REVOKE ALL ON FUNCTION operations_private.acknowledge_report_command(text, text, text) FROM PUBLIC, operations_ingest, operations_anon;
GRANT EXECUTE ON FUNCTION operations_private.acknowledge_report_command(text, text, text) TO operations_owner;

REVOKE ALL ON FUNCTION operations_private.complete_report_command(text, text, text) FROM PUBLIC, operations_ingest, operations_anon;
GRANT EXECUTE ON FUNCTION operations_private.complete_report_command(text, text, text) TO operations_owner;

REVOKE ALL ON FUNCTION operations_private.reconcile_report_commands(integer) FROM PUBLIC, operations_ingest, operations_anon;
GRANT EXECUTE ON FUNCTION operations_private.reconcile_report_commands(integer) TO operations_owner;

COMMIT;
