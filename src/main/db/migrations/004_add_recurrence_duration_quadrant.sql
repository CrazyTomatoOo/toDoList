ALTER TABLE tasks ADD COLUMN recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly', 'yearly'));
ALTER TABLE tasks ADD COLUMN recurrence_end_date TEXT CHECK (recurrence_end_date IS NULL OR (recurrence_end_date LIKE '____-__-__' AND date(recurrence_end_date) IS NOT NULL AND strftime('%Y-%m-%d', recurrence_end_date) = recurrence_end_date));
ALTER TABLE tasks ADD COLUMN start_date TEXT CHECK (start_date IS NULL OR (start_date LIKE '____-__-__' AND date(start_date) IS NOT NULL AND strftime('%Y-%m-%d', start_date) = start_date));
ALTER TABLE tasks ADD COLUMN end_date TEXT CHECK (end_date IS NULL OR (end_date LIKE '____-__-__' AND date(end_date) IS NOT NULL AND strftime('%Y-%m-%d', end_date) = end_date));
ALTER TABLE tasks ADD COLUMN is_urgent INTEGER NOT NULL DEFAULT 0 CHECK (is_urgent IN (0, 1));
ALTER TABLE tasks ADD COLUMN is_important INTEGER NOT NULL DEFAULT 0 CHECK (is_important IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(recurrence);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_end_date ON tasks(recurrence_end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_tasks_end_date ON tasks(end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_urgent ON tasks(is_urgent);
CREATE INDEX IF NOT EXISTS idx_tasks_is_important ON tasks(is_important);
