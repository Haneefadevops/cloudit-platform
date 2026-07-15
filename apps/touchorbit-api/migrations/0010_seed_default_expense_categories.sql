INSERT INTO expense_categories (
  organization_id,
  name,
  description,
  is_active
)
SELECT
  o.id,
  'General',
  'General business expenses',
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM expense_categories ec
  WHERE ec.organization_id = o.id
    AND ec.is_active = true
);
