-- Run this query in the Supabase SQL Editor to get the full public schema as DDL.
-- 1. Open the SQL Editor in your TouchOrbit Supabase project.
-- 2. Paste this entire script and click Run.
-- 3. When results appear, click "Download results" (CSV or JSON) or copy the rows.
-- 4. Save the output as a plain text file, e.g. `touchorbit_schema.sql`, and share the path.
-- 5. I will clean it (remove auth/storage/realtime/RLS artifacts) and use it as the baseline migration.

WITH table_columns AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    string_agg(
      '  ' || quote_ident(a.attname) || ' ' ||
      format_type(a.atttypid, a.atttypmod) ||
      CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
      CASE WHEN a.atthasdef
        THEN ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid)
        ELSE '' END,
      E',\n' ORDER BY a.attnum
    ) AS columns
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  WHERE c.relkind = 'r' AND n.nspname = 'public'
  GROUP BY n.nspname, c.relname
),

table_defs AS (
  SELECT 10 AS sort_order,
         format(E'CREATE TABLE %I.%I (\n%s\n);',
                schema_name, table_name, columns) AS ddl
  FROM table_columns
),

pk_defs AS (
  SELECT 20 AS sort_order,
         format('ALTER TABLE %I.%I ADD CONSTRAINT %I PRIMARY KEY (%s);',
                n.nspname, cl.relname, con.conname,
                string_agg(quote_ident(a.attname), ', ' ORDER BY array_position(con.conkey, a.attnum)))
         AS ddl
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(con.conkey)
  WHERE con.contype = 'p' AND n.nspname = 'public'
  GROUP BY n.nspname, cl.relname, con.conname
),

fk_defs AS (
  SELECT 30 AS sort_order,
         format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %I.%I(%s)%s;',
                n.nspname, cl.relname, con.conname,
                string_agg(quote_ident(a1.attname), ', ' ORDER BY array_position(con.conkey, a1.attnum)),
                nf.nspname, clf.relname,
                string_agg(quote_ident(a2.attname), ', ' ORDER BY array_position(con.confkey, a2.attnum)),
                CASE con.confupdtype
                  WHEN 'c' THEN ' ON UPDATE CASCADE'
                  WHEN 'd' THEN ' ON UPDATE SET DEFAULT'
                  WHEN 'n' THEN ' ON UPDATE SET NULL'
                  ELSE '' END ||
                CASE con.confdeltype
                  WHEN 'c' THEN ' ON DELETE CASCADE'
                  WHEN 'd' THEN ' ON DELETE SET DEFAULT'
                  WHEN 'n' THEN ' ON DELETE SET NULL'
                  ELSE '' END)
         AS ddl
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_class clf ON clf.oid = con.confrelid
  JOIN pg_namespace nf ON nf.oid = clf.relnamespace
  JOIN pg_attribute a1 ON a1.attrelid = cl.oid AND a1.attnum = ANY(con.conkey)
  JOIN pg_attribute a2 ON a2.attrelid = clf.oid AND a2.attnum = ANY(con.confkey)
  WHERE con.contype = 'f' AND n.nspname = 'public'
  GROUP BY n.nspname, cl.relname, con.conname, nf.nspname, clf.relname, con.confupdtype, con.confdeltype
),

unique_defs AS (
  SELECT 40 AS sort_order,
         format('ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE (%s);',
                n.nspname, cl.relname, con.conname,
                string_agg(quote_ident(a.attname), ', ' ORDER BY array_position(con.conkey, a.attnum)))
         AS ddl
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(con.conkey)
  WHERE con.contype = 'u' AND n.nspname = 'public'
  GROUP BY n.nspname, cl.relname, con.conname
),

check_defs AS (
  SELECT 50 AS sort_order,
         format('ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (%s);',
                n.nspname, cl.relname, con.conname,
                pg_get_constraintdef(con.oid, true))
         AS ddl
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE con.contype = 'c' AND n.nspname = 'public'
),

index_defs AS (
  SELECT 60 AS sort_order,
         pg_get_indexdef(i.indexrelid) || ';' AS ddl
  FROM pg_index i
  JOIN pg_class cl ON cl.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE n.nspname = 'public'
),

function_defs AS (
  SELECT 70 AS sort_order,
         pg_get_functiondef(p.oid) || ';' AS ddl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),

trigger_defs AS (
  SELECT 80 AS sort_order,
         pg_get_triggerdef(t.oid, true) || ';' AS ddl
  FROM pg_trigger t
  JOIN pg_class cl ON cl.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
),

all_defs AS (
  SELECT * FROM table_defs
  UNION ALL SELECT * FROM pk_defs
  UNION ALL SELECT * FROM fk_defs
  UNION ALL SELECT * FROM unique_defs
  UNION ALL SELECT * FROM check_defs
  UNION ALL SELECT * FROM index_defs
  UNION ALL SELECT * FROM function_defs
  UNION ALL SELECT * FROM trigger_defs
)
SELECT sort_order, ddl
FROM all_defs
ORDER BY sort_order, ddl;
