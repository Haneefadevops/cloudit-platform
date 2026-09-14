-- CloudIT Operations Portal — Phase 7 migration 0007: Vercel/ImageKit analytics seed.
--
-- Adds the metric definitions Phase 7 collection and ingestion rely on:
-- the vercel.traffic.* keys matched by operations_ingest.insert_traffic_summary
-- (0005 looks up '<provider>.traffic.visitors', '<provider>.traffic.pageviews'
-- and '<provider>.traffic.top_route', the last requiring the 'path'
-- dimension), the vercel domain-verification flag, and the ImageKit quota
-- keys. The 0006 keys 'vercel.visitors'/'vercel.pageviews' never matched any
-- ingest lookup, so nothing has ever written to them; they are removed at the
-- end of this migration, but only when no metric samples reference them.
--
-- Every statement is idempotent (natural-key ON CONFLICT DO NOTHING, and the
-- DELETE is guarded by a NOT EXISTS on metric samples) so the migration can
-- be re-applied by every deployment.

BEGIN;

-- Vercel Web Analytics and domain verification --------------------------------

INSERT INTO operations.metric_definitions (client_id, metric_key, display_name, value_type, unit, allowed_dimensions, frequency_seconds, freshness_seconds, retention_class)
SELECT c.id, v.metric_key, v.display_name, v.value_type, v.unit, v.allowed_dimensions, v.frequency_seconds, v.freshness_seconds, v.retention_class
FROM operations.clients c
JOIN (VALUES
  ('vercel.traffic.visitors',  'Vercel visitors (Web Analytics)',  'number', 'count', '[]'::jsonb,       86400, 86400, 'daily_24m'),
  ('vercel.traffic.pageviews', 'Vercel pageviews (Web Analytics)', 'number', 'count', '[]'::jsonb,       86400, 86400, 'daily_24m'),
  ('vercel.traffic.top_route', 'Vercel top route views',           'number', 'count', '["path"]'::jsonb, 86400, 86400, 'daily_24m'),
  ('vercel.domain.verified',   'Vercel domain verified',           'boolean', 'flag', '["domain"]'::jsonb, 86400, 86400, 'daily_24m'),
  -- ImageKit (six-hour provider cache per Phase 0 section 7.4)
  ('imagekit.bandwidth_quota_bytes',             'ImageKit bandwidth quota',              'number', 'bytes', '[]'::jsonb, 21600, 43200, 'daily_24m'),
  ('imagekit.media_library_storage_quota_bytes', 'ImageKit Media Library storage quota',  'number', 'bytes', '[]'::jsonb, 21600, 43200, 'daily_24m'),
  ('imagekit.video_processing_units_quota',      'ImageKit video processing units quota', 'number', 'units', '[]'::jsonb, 21600, 43200, 'daily_24m'),
  ('imagekit.extension_units_quota',             'ImageKit extension units quota',        'number', 'units', '[]'::jsonb, 21600, 43200, 'daily_24m')
) AS v(metric_key, display_name, value_type, unit, allowed_dimensions, frequency_seconds, freshness_seconds, retention_class) ON true
WHERE c.client_key = 'cavetta'
ON CONFLICT (client_id, metric_key) DO NOTHING;

-- Remove the dead 0006 keys (never matched by the ingest lookups) --------------
-- The NOT EXISTS guard keeps the rows if any deployment ever wrote samples
-- against them, so re-application stays safe.

DELETE FROM operations.metric_definitions d
USING operations.clients c
WHERE d.client_id = c.id
  AND c.client_key = 'cavetta'
  AND d.metric_key IN ('vercel.visitors', 'vercel.pageviews')
  AND NOT EXISTS (
    SELECT 1 FROM operations.metric_samples ms
    WHERE ms.metric_definition_id = d.id
  );

COMMIT;
