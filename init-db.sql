-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Verify extensions are installed
SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto');