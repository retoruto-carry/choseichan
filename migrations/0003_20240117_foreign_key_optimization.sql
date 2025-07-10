-- Foreign key optimization for D1
-- Migration: 0003_20240117_foreign_key_optimization.sql
-- Description: Optimize foreign key handling for better performance

-- Enable deferred foreign key constraints for this migration
PRAGMA defer_foreign_keys = true;

-- Add missing indexes for foreign key relationships
CREATE INDEX IF NOT EXISTS idx_schedule_dates_date_id ON schedule_dates(date_id);
CREATE INDEX IF NOT EXISTS idx_responses_user_id ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_response_date_status_date_response ON response_date_status(date_id, response_id);

-- Create a compound index for better query performance
CREATE INDEX IF NOT EXISTS idx_schedules_guild_deadline_status ON schedules(guild_id, deadline, status);

-- Add index for expired data cleanup
CREATE INDEX IF NOT EXISTS idx_schedules_expires_status ON schedules(expires_at, status);

-- Reset foreign key constraint mode
PRAGMA defer_foreign_keys = false;