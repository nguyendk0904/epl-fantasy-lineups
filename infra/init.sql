-- =====================================================================
-- P1-Q02 - PostgreSQL init script
-- Executed ONCE by the postgres:15 image on first DB initialization
-- (mounted at /docker-entrypoint-initdb.d/init.sql in docker-compose.yml)
--
-- NOTE: Business tables (teams, players, shared_lineups) are managed by
-- Alembic migrations (P1-V01). This script only prepares DB-level
-- extensions/settings required by the application schema.
-- =====================================================================

-- pgcrypto provides gen_random_uuid() used by shared_lineups.id (UUID PK)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store all timestamps in UTC consistently (TIMESTAMPTZ friendly)
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone TO ''UTC''', current_database());
END $$;