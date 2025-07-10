-- Cleanup expired data procedure
-- Migration: 0002_cleanup_expired_data.sql

-- Note: D1 doesn't support stored procedures, so this would need to be run periodically
-- via a cron job or scheduled worker

-- Delete expired schedules (and cascade to related tables)
DELETE FROM schedules WHERE expires_at < unixepoch();

-- Delete expired responses (in case some are orphaned)
DELETE FROM responses WHERE expires_at < unixepoch();