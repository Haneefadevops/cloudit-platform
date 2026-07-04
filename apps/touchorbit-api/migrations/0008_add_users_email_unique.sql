-- Add unique index on users.email so platform provisioning can use ON CONFLICT safely.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email);
