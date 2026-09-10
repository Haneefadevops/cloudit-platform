-- CloudIT Operations Portal — Phase 3 migration 0004: ingestion functions.
--
-- Private, narrowly scoped entry point for sanitized evidence publishing
-- (Phase 0 specification sections 7 and 8.2). The operations_ingest role has
-- no table privileges; it can only EXECUTE operations_ingest.submit_batch,
-- which:
--   * authenticates a publisher by key + secret (salted SHA-256 digest; the
--     secret is never stored recoverably and never returned);
--   * maps the publisher to its client and environment — tenant identity is
--     never taken from the request body;
--   * rejects disabled publishers/clients, unknown or unallowed record
--     types, envelope fields outside the contract, unknown payload fields,
--     forbidden field names, invalid enums/units/timestamps, stale
--     publishedAt (±5 minutes) and oversized batches (500 records / 1 MiB);
--   * validates the complete batch before writing anything (partial
--     acceptance is forbidden) and counts idempotent replays per
--     (publisher, record_type, idempotency_key) without creating duplicates;
--   * records one append-only receipt per batch and a denied audit event for
--     rejected batches;
--   * returns only the receipt id, safe counts and safe validation codes —
--     never the submitted payload, a stack trace or any secret.
--
-- All functions are SECURITY DEFINER owned by the provisioning superuser with
-- an empty search_path, and PUBLIC execute is revoked.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'operations_ingest' AND t.typname = 'envelope') THEN
    CREATE TYPE operations_ingest.envelope AS (
      record_type     text,
      idempotency_key text,
      source_system   text,
      observed_at     timestamptz,
      published_at    timestamptz,
      status          text,
      severity        text,
      correlation_key text,
      payload         jsonb
    );
  END IF;
END
$$;

-- Safe failure: the exception message is the machine-safe validation code.
CREATE OR REPLACE FUNCTION operations_ingest.fail(p_code text)
RETURNS void
LANGUAGE plpgsql
AS $func$
BEGIN
  RAISE EXCEPTION '%', p_code USING ERRCODE = 'P0001';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.allowed_failure_categories()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT ARRAY[
    'timeout', 'dns', 'tls', 'http_4xx', 'http_5xx', 'authentication',
    'authorization', 'rate_limit', 'quota', 'provider_unavailable',
    'invalid_response', 'missing_evidence', 'overdue', 'stuck_send',
    'unknown_sanitized'
  ];
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.allowed_trigger_kinds()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT ARRAY['cron', 'schedule', 'webhook', 'manual', 'sub_workflow', 'error_workflow', 'unknown'];
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.allowed_statuses()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT ARRAY['GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN'];
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.allowed_severities()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT ARRAY['info', 'warning', 'critical', 'none'];
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.allowed_source_systems()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT ARRAY['n8n', 'uptime_kuma', 'github_actions', 'vercel', 'supabase', 'imagekit', 'google_drive', 'ga4', 'smtp'];
$func$;

-- ---------------------------------------------------------------------------
-- Payload field helpers. Every failure raises a safe code only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations_ingest.req_text(p_obj jsonb, p_key text, p_max_len integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v jsonb;
BEGIN
  v := p_obj -> p_key;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    PERFORM operations_ingest.fail('missing_field');
  END IF;
  IF jsonb_typeof(v) <> 'string' THEN
    PERFORM operations_ingest.fail('invalid_field_type');
  END IF;
  IF length(v #>> '{}') > p_max_len OR length(v #>> '{}') = 0 THEN
    PERFORM operations_ingest.fail('field_too_long');
  END IF;
  RETURN v #>> '{}';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.opt_text(p_obj jsonb, p_key text, p_max_len integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v jsonb;
BEGIN
  v := p_obj -> p_key;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN NULL;
  END IF;
  RETURN operations_ingest.req_text(p_obj, p_key, p_max_len);
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.req_int(p_obj jsonb, p_key text, p_min integer, p_max integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v jsonb;
  n integer;
BEGIN
  v := p_obj -> p_key;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    PERFORM operations_ingest.fail('missing_field');
  END IF;
  IF jsonb_typeof(v) <> 'number' OR v::text !~ '^-?[0-9]+$' THEN
    PERFORM operations_ingest.fail('invalid_field_type');
  END IF;
  n := v::text::integer;
  IF n < p_min OR n > p_max THEN
    PERFORM operations_ingest.fail('field_out_of_range');
  END IF;
  RETURN n;
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.opt_int(p_obj jsonb, p_key text, p_min integer, p_max integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v jsonb;
BEGIN
  v := p_obj -> p_key;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN NULL;
  END IF;
  RETURN operations_ingest.req_int(p_obj, p_key, p_min, p_max);
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.req_bool(p_obj jsonb, p_key text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v jsonb;
BEGIN
  v := p_obj -> p_key;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    PERFORM operations_ingest.fail('missing_field');
  END IF;
  IF jsonb_typeof(v) <> 'boolean' THEN
    PERFORM operations_ingest.fail('invalid_field_type');
  END IF;
  RETURN (v #>> '{}')::boolean;
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.opt_bool(p_obj jsonb, p_key text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v jsonb;
BEGIN
  v := p_obj -> p_key;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN NULL;
  END IF;
  RETURN operations_ingest.req_bool(p_obj, p_key);
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.opt_number(p_obj jsonb, p_key text, p_min numeric, p_max numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v jsonb;
  n numeric;
BEGIN
  v := p_obj -> p_key;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(v) <> 'number' THEN
    PERFORM operations_ingest.fail('invalid_field_type');
  END IF;
  n := v::text::numeric;
  IF n < p_min OR n > p_max THEN
    PERFORM operations_ingest.fail('field_out_of_range');
  END IF;
  RETURN n;
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.req_ts(p_obj jsonb, p_key text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v text;
BEGIN
  v := operations_ingest.req_text(p_obj, p_key, 64);
  BEGIN
    RETURN v::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    PERFORM operations_ingest.fail('invalid_timestamp');
  END;
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.opt_ts(p_obj jsonb, p_key text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v jsonb;
BEGIN
  v := p_obj -> p_key;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN NULL;
  END IF;
  RETURN operations_ingest.req_ts(p_obj, p_key);
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.req_enum(p_obj jsonb, p_key text, p_allowed text[], p_code text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v text;
BEGIN
  v := operations_ingest.req_text(p_obj, p_key, 40);
  IF NOT (v = ANY (p_allowed)) THEN
    PERFORM operations_ingest.fail(p_code);
  END IF;
  RETURN v;
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.opt_enum(p_obj jsonb, p_key text, p_allowed text[], p_code text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v jsonb;
BEGIN
  v := p_obj -> p_key;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN NULL;
  END IF;
  RETURN operations_ingest.req_enum(p_obj, p_key, p_allowed, p_code);
END;
$func$;

-- Rejects payloads containing any field outside the strict allowlist and any
-- forbidden field name (error/stack/token/secret/email/body/...), even
-- nested one level deep in typed objects.
CREATE OR REPLACE FUNCTION operations_ingest.check_payload_keys(p_obj jsonb, p_allowed text[])
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $func$
BEGIN
  IF jsonb_typeof(p_obj) <> 'object' THEN
    PERFORM operations_ingest.fail('invalid_payload');
  END IF;
  -- Forbidden field names are reported before unknown fields so that a
  -- deliberately banned field yields the explicit 'forbidden_field' code.
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_obj) AS k
    WHERE lower(k) IN (
      'message', 'error', 'stack', 'payload', 'request', 'response', 'headers',
      'query', 'sql', 'body', 'email', 'phone', 'name', 'address',
      'connectionstring', 'connection_string', 'token', 'secret', 'password',
      'credential', 'binary', 'data'
    )
  ) THEN
    PERFORM operations_ingest.fail('forbidden_field');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_obj) AS k
    WHERE NOT (k = ANY (p_allowed))
  ) THEN
    PERFORM operations_ingest.fail('unknown_field');
  END IF;
END;
$func$;

-- Safe human-facing text: length-limited, no URLs and no control characters.
CREATE OR REPLACE FUNCTION operations_ingest.safe_text(p_value text, p_max_len integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $func$
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;
  IF length(p_value) > p_max_len THEN
    PERFORM operations_ingest.fail('field_too_long');
  END IF;
  IF p_value ~* 'https?://' THEN
    PERFORM operations_ingest.fail('unsafe_text');
  END IF;
  IF p_value ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' THEN
    PERFORM operations_ingest.fail('unsafe_text');
  END IF;
  RETURN p_value;
END;
$func$;

-- ---------------------------------------------------------------------------
-- Envelope validation (Phase 0 specification section 7.2)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations_ingest.parse_envelope(
  p_rec jsonb,
  p_environment_key text,
  p_allowed_record_types text[]
)
RETURNS operations_ingest.envelope
LANGUAGE plpgsql
STABLE
AS $func$
DECLARE
  v_env operations_ingest.envelope;
  v_keys text[] := ARRAY[
    'contractVersion', 'recordType', 'idempotencyKey', 'environmentKey',
    'sourceSystem', 'observedAt', 'publishedAt', 'freshUntil',
    'status', 'severity', 'correlationKey', 'payload'
  ];
  v_published_at timestamptz;
  v_record_type text;
BEGIN
  IF jsonb_typeof(p_rec) <> 'object' THEN
    PERFORM operations_ingest.fail('invalid_record');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_rec) AS k WHERE NOT (k = ANY (v_keys))
  ) THEN
    PERFORM operations_ingest.fail('unknown_field');
  END IF;

  IF operations_ingest.req_text(p_rec, 'contractVersion', 10) <> '1.0' THEN
    PERFORM operations_ingest.fail('unsupported_contract_version');
  END IF;

  v_record_type := operations_ingest.req_text(p_rec, 'recordType', 80);
  IF NOT (v_record_type = ANY (p_allowed_record_types)) THEN
    PERFORM operations_ingest.fail('record_type_not_allowed');
  END IF;
  v_env.record_type := v_record_type;

  v_env.idempotency_key := operations_ingest.req_text(p_rec, 'idempotencyKey', 160);
  IF v_env.idempotency_key ~ '@' OR v_env.idempotency_key ~ '://' THEN
    PERFORM operations_ingest.fail('invalid_idempotency_key');
  END IF;

  IF operations_ingest.req_text(p_rec, 'environmentKey', 62) <> p_environment_key THEN
    PERFORM operations_ingest.fail('environment_scope_violation');
  END IF;

  v_env.source_system := operations_ingest.req_enum(
    p_rec, 'sourceSystem', operations_ingest.allowed_source_systems(), 'invalid_source_system'
  );
  v_env.observed_at := operations_ingest.req_ts(p_rec, 'observedAt');
  v_published_at := operations_ingest.req_ts(p_rec, 'publishedAt');
  PERFORM operations_ingest.req_ts(p_rec, 'freshUntil');
  IF abs(extract(epoch FROM (v_published_at - now()))) > 300 THEN
    PERFORM operations_ingest.fail('stale_timestamp');
  END IF;
  v_env.published_at := v_published_at;

  v_env.status := operations_ingest.req_enum(
    p_rec, 'status', operations_ingest.allowed_statuses(), 'invalid_status'
  );
  v_env.severity := operations_ingest.req_enum(
    p_rec, 'severity', operations_ingest.allowed_severities(), 'invalid_severity'
  );
  v_env.correlation_key := operations_ingest.opt_text(p_rec, 'correlationKey', 160);
  v_env.payload := p_rec -> 'payload';
  IF v_env.payload IS NULL OR jsonb_typeof(v_env.payload) <> 'object' THEN
    PERFORM operations_ingest.fail('invalid_payload');
  END IF;

  RETURN v_env;
END;
$func$;

COMMIT;
