-- 0013_reader_role_catalog.sql — extend the operations_reader role with
-- SELECT on the small catalogue tables the soak driver must JOIN for
-- tenant scoping (clients, environments) and endpoint classification
-- (endpoints). Still strictly read-only; no DML, no audit/command tables.

GRANT SELECT ON
  operations.clients,
  operations.environments,
  operations.endpoints
TO operations_reader;
