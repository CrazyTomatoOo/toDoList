# T1: Schema migration learnings

- SQLite CHECK constraints pass when the expression evaluates to NULL, so a date CHECK must
  explicitly return FALSE for invalid values. Used a strict YYYY-MM-DD CHECK combining
  `LIKE '____-__-__'`, `date(x) IS NOT NULL`, and `strftime('%Y-%m-%d', x) = x` to enforce
  both format and date validity.
- `ALTER TABLE ADD COLUMN` supports per-column CHECK constraints and NOT NULL DEFAULT values,
  keeping the migration forward-only and non-destructive.
- Existing schema tests use `PRAGMA table_info` and `sqlite_master.sql`; extending them is
  straightforward once column order and dflt_value formats are aligned with SQLite's output.