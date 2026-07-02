-- Optional: create additional databases for n8n, uptime-kuma, etc.
-- These run on first container start only.

-- n8n database
CREATE DATABASE n8n;
GRANT ALL PRIVILEGES ON DATABASE n8n TO cloudit;

-- uptime-kuma database
CREATE DATABASE uptimekuma;
GRANT ALL PRIVILEGES ON DATABASE uptimekuma TO cloudit;

-- platform database
CREATE DATABASE platform;
GRANT ALL PRIVILEGES ON DATABASE platform TO cloudit;

-- hospitality database
CREATE DATABASE hospitality;
GRANT ALL PRIVILEGES ON DATABASE hospitality TO cloudit;

-- touchorbit database
CREATE DATABASE touchorbit;
GRANT ALL PRIVILEGES ON DATABASE touchorbit TO cloudit;

-- orbitone database
CREATE DATABASE orbitone;
GRANT ALL PRIVILEGES ON DATABASE orbitone TO cloudit;
