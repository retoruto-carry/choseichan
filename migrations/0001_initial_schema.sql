-- Discord 調整ちゃん D1 Database Schema
-- Migration: 0001_initial_schema.sql

-- Drop existing tables if they exist
DROP TABLE IF EXISTS responses;
DROP TABLE IF EXISTS schedule_dates;
DROP TABLE IF EXISTS schedules;

-- Schedules table
CREATE TABLE schedules (
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
  expires_at INTEGER NOT NULL,  -- Unix timestamp for automatic deletion
  
  -- Constraints
  UNIQUE(guild_id, message_id)
);

-- Schedule dates table (normalized)
CREATE TABLE schedule_dates (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  date_id TEXT NOT NULL,
  datetime TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  UNIQUE(schedule_id, date_id)
);

-- Responses table
CREATE TABLE responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  comment TEXT,
  updated_at INTEGER NOT NULL,  -- Unix timestamp
  expires_at INTEGER NOT NULL,  -- Unix timestamp
  
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  UNIQUE(schedule_id, user_id)
);

-- Response status for each date (normalized)
CREATE TABLE response_date_status (
  response_id INTEGER NOT NULL,
  date_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'maybe', 'ng')),
  
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
  PRIMARY KEY (response_id, date_id)
);

-- Create indexes
CREATE INDEX idx_schedules_guild_channel ON schedules(guild_id, channel_id);
CREATE INDEX idx_schedules_guild_status ON schedules(guild_id, status);
CREATE INDEX idx_schedules_deadline ON schedules(deadline);
CREATE INDEX idx_schedules_expires ON schedules(expires_at);

CREATE INDEX idx_schedule_dates_schedule ON schedule_dates(schedule_id);

CREATE INDEX idx_responses_schedule_user ON responses(schedule_id, user_id);
CREATE INDEX idx_responses_guild_schedule ON responses(guild_id, schedule_id);
CREATE INDEX idx_responses_expires ON responses(expires_at);

CREATE INDEX idx_response_date_status_response ON response_date_status(response_id);
CREATE INDEX idx_response_date_status_date ON response_date_status(date_id, status);

-- Create views for common queries

-- View for schedule summaries with response counts
CREATE VIEW schedule_summaries AS
SELECT 
  s.*,
  COUNT(DISTINCT r.user_id) as response_count
FROM schedules s
LEFT JOIN responses r ON s.id = r.schedule_id
GROUP BY s.id;

-- View for date response counts
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

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_schedule_timestamp 
AFTER UPDATE ON schedules
BEGIN
  UPDATE schedules SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_response_timestamp 
AFTER UPDATE ON responses
BEGIN
  UPDATE responses SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Trigger to update total_responses count
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