-- Migration number: 0004 	 2025-07-15T23:51:13.126Z
-- Remove expires_at fields from schedules and responses tables
-- These fields were defined but not actually used for automatic cleanup

-- Note: SQLite doesn't support DROP COLUMN directly, so we need to recreate tables

-- Enable deferred foreign key constraints for this migration
PRAGMA defer_foreign_keys = true;

-- 0. Drop views first (they depend on tables)
DROP VIEW IF EXISTS schedule_summaries;
DROP VIEW IF EXISTS date_response_counts;

-- 1. Create new schedules table without expires_at
CREATE TABLE schedules_new (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  created_by_id TEXT NOT NULL,
  created_by_username TEXT NOT NULL,
  author_id TEXT NOT NULL,
  deadline INTEGER,  -- Unix timestamp
  reminder_timings TEXT,  -- JSON array of timings (e.g., ["3d", "1d", "8h"])
  reminder_mentions TEXT,  -- JSON array of mentions (e.g., ["@everyone", "User#1234"])
  reminders_sent TEXT,  -- JSON array of sent reminders (e.g., ["3d", "1d"])
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
  total_responses INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,  -- Unix timestamp
  updated_at INTEGER NOT NULL,  -- Unix timestamp
  
  -- Constraints
  UNIQUE(guild_id, message_id)
);

-- 2. Copy data from old schedules table (excluding expires_at)
INSERT INTO schedules_new (
  id, guild_id, channel_id, message_id, title, description,
  created_by_id, created_by_username, author_id, deadline,
  reminder_timings, reminder_mentions, reminders_sent, status,
  notification_sent, total_responses, created_at, updated_at
)
SELECT 
  id, guild_id, channel_id, message_id, title, description,
  created_by_id, created_by_username, author_id, deadline,
  reminder_timings, reminder_mentions, reminders_sent, status,
  notification_sent, total_responses, created_at, updated_at
FROM schedules;

-- 3. Create new responses table without expires_at
CREATE TABLE responses_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  comment TEXT,
  updated_at INTEGER NOT NULL,  -- Unix timestamp
  
  FOREIGN KEY (schedule_id) REFERENCES schedules_new(id) ON DELETE CASCADE,
  UNIQUE(schedule_id, user_id)
);

-- 4. Copy data from old responses table (excluding expires_at)
INSERT INTO responses_new (
  id, schedule_id, guild_id, user_id, username, display_name, comment, updated_at
)
SELECT 
  id, schedule_id, guild_id, user_id, username, display_name, comment, updated_at
FROM responses;

-- 5. Drop old tables
DROP TABLE response_date_status;
DROP TABLE responses;
DROP TABLE schedules;

-- 6. Rename new tables
ALTER TABLE schedules_new RENAME TO schedules;
ALTER TABLE responses_new RENAME TO responses;

-- 7. Recreate response_date_status table with correct foreign key
CREATE TABLE response_date_status (
  response_id INTEGER NOT NULL,
  date_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'maybe', 'ng')),
  
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
  PRIMARY KEY (response_id, date_id)
);

-- 8. Recreate all indexes
CREATE INDEX IF NOT EXISTS idx_schedules_guild_channel ON schedules(guild_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_schedules_guild_status ON schedules(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_schedules_deadline ON schedules(deadline);

CREATE INDEX IF NOT EXISTS idx_schedule_dates_schedule ON schedule_dates(schedule_id);

CREATE INDEX IF NOT EXISTS idx_responses_schedule_user ON responses(schedule_id, user_id);
CREATE INDEX IF NOT EXISTS idx_responses_guild_schedule ON responses(guild_id, schedule_id);

CREATE INDEX IF NOT EXISTS idx_response_date_status_response ON response_date_status(response_id);
CREATE INDEX IF NOT EXISTS idx_response_date_status_date ON response_date_status(date_id, status);

-- 9. Recreate views
CREATE VIEW schedule_summaries AS
SELECT 
  s.*,
  COUNT(DISTINCT r.user_id) as response_count
FROM schedules s
LEFT JOIN responses r ON s.id = r.schedule_id
GROUP BY s.id;

CREATE VIEW date_response_counts AS
SELECT 
  sd.schedule_id,
  sd.date_id,
  rds.status,
  COUNT(*) as count
FROM schedule_dates sd
LEFT JOIN responses r ON sd.schedule_id = r.schedule_id
LEFT JOIN response_date_status rds ON r.id = rds.response_id AND sd.date_id = rds.date_id
WHERE rds.status IS NOT NULL
GROUP BY sd.schedule_id, sd.date_id, rds.status;

-- 10. Recreate triggers
CREATE TRIGGER update_schedule_timestamp 
AFTER UPDATE ON schedules
BEGIN
  UPDATE schedules SET updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = NEW.id;
END;

CREATE TRIGGER update_response_timestamp 
AFTER UPDATE ON responses
BEGIN
  UPDATE responses SET updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = NEW.id;
END;

CREATE TRIGGER update_total_responses_insert
AFTER INSERT ON responses
BEGIN
  UPDATE schedules 
  SET total_responses = (
    SELECT COUNT(DISTINCT user_id) 
    FROM responses 
    WHERE schedule_id = NEW.schedule_id
  )
  WHERE id = NEW.schedule_id;
END;

CREATE TRIGGER update_total_responses_delete
AFTER DELETE ON responses
BEGIN
  UPDATE schedules 
  SET total_responses = (
    SELECT COUNT(DISTINCT user_id) 
    FROM responses 
    WHERE schedule_id = OLD.schedule_id
  )
  WHERE id = OLD.schedule_id;
END;

-- Reset foreign key constraint mode
PRAGMA defer_foreign_keys = false;