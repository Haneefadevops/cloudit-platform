-- Ensure users.id has a default UUID generator so platform provisioning can insert without an explicit id.
ALTER TABLE IF EXISTS users ALTER COLUMN id SET DEFAULT gen_random_uuid();
