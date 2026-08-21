# Repeating reminders — reminder rules independent of task recurrence

Reminders were a one-shot timestamp (`reminder_at`) cleared on fire, and recurring tasks never inherited reminders. We decided to upgrade the reminder to a single per-task **repeating-reminder rule** with its own cadence (每天/每周/每月/每年, or every-N-days), its own trigger time-of-day, and an optional boundary — so "periodic reminders" and "daily reminders during a task's duration" are one feature, not two.

- **One rule per task, columns on `tasks`** (migration 005). `reminder_at` becomes the materialized *next fire time*; the scheduler advances it on fire instead of clearing it, and clears the rule when the boundary passes. Existing rows become `once` rules automatically — no behavior change.
- **Independent of task recurrence.** Recurring task instances never inherit reminders (behavior kept from before).
- **Missed fires collapse into one catch-up notification** on the next poll; completing the task stops the rule; un-completing resumes it from the next cadence tick.
- **Boundary modes:** none (unbounded, stops on completion), static end date (inclusive), or follow the task's duration window (dynamic; the option is disabled until the task has a duration).

**Status:** accepted

**Considered options:**

- **Separate reminders table (multiple rules per task)** — rejected for now: one rule covers the requested use cases and keeps the form and import/export simple; upgradeable later without changing the rule semantics.
- **Reminders inherited by each recurring task instance** ("remind 30 min before each occurrence") — a different UX; out of scope, would complicate the model.
- **Reusing `reminder_at`'s time-of-day as the cadence time** — rejected: the rule owns its trigger time; `reminder_at` is pure state, not config.