-- Optional: create additional databases for n8n, uptime-kuma, etc.
-- These run on first container start only.

-- n8n database
CREATE DATABASE n8n;
GRANT ALL PRIVILEGES ON DATABASE n8n TO cloudit;

-- uptime-kuma database
CREATE DATABASE uptimekuma;
GRANT ALL PRIVILEGES ON DATABASE uptimekuma TO cloudit;
