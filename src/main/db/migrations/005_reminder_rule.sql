-- Repeating reminders (ADR-0001): one reminder rule per task, independent of task recurrence.
-- reminder_at stays the materialized next-fire time; the rule fields below describe cadence and boundary.
ALTER TABLE tasks ADD COLUMN reminder_recurrence TEXT NOT NULL DEFAULT 'once' CHECK (reminder_recurrence IN ('once', 'daily', 'weekly', 'monthly', 'yearly', 'everyN'));
ALTER TABLE tasks ADD COLUMN reminder_interval INTEGER CHECK (reminder_interval IS NULL OR (reminder_interval BETWEEN 1 AND 365));
ALTER TABLE tasks ADD COLUMN reminder_end_date TEXT CHECK (reminder_end_date IS NULL OR (reminder_end_date LIKE '____-__-__' AND date(reminder_end_date) IS NOT NULL AND strftime('%Y-%m-%d', reminder_end_date) = reminder_end_date));
ALTER TABLE tasks ADD COLUMN reminder_follow_duration INTEGER NOT NULL DEFAULT 0 CHECK (reminder_follow_duration IN (0, 1));
ALTER TABLE tasks ADD COLUMN reminder_time TEXT CHECK (reminder_time IS NULL OR reminder_time GLOB '[0-2][0-9]:[0-5][0-9]');