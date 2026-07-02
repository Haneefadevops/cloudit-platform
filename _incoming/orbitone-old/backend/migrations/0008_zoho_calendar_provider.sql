-- OrbitOne Zoho Calendar provider support.

ALTER TABLE calendar_accounts
DROP CONSTRAINT IF EXISTS calendar_accounts_provider_check;

ALTER TABLE calendar_accounts
ADD CONSTRAINT calendar_accounts_provider_check
CHECK (provider IN ('google', 'microsoft', 'zoho'));
