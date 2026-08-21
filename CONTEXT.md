# ToDoList

Offline-first, cross-platform desktop todo app (Electron + React) with lists, Eisenhower quadrant board, recurring tasks, and reminders. Single context: the entire app.

## Language

**Chinese UI (中文界面)**:
The app's user-facing language is Simplified Chinese — every string rendered to the user (components, menus, notifications, confirmations, validation and import/export errors) is written in Chinese, without an i18n framework.
_Avoid_: English UI copy, half-translated pages, i18n libraries

**Design tokens**:
The visual vocabulary of the UI — colors, typography, spacing, radii, shadows — defined once as named CSS custom properties in `src/renderer/styles.css` and referenced everywhere via `var(--token)`.
_Avoid_: hardcoded hex/rgba in rules, per-component color constants

**8px grid**:
The spacing scale (4/8/12/16/20/24/32/40/48px) that every padding/margin/gap in the UI lands on; 4, 12 and 20 are deliberate half-steps between 8px increments. The e2e spec f3-ui-redesign-verification pins key selectors to 8px multiples.
_Avoid_: arbitrary px values off the scale, mixed scales per component

**Hairline**:
The 1px border hierarchy — dividers, card outlines and row separators use the lightest tier (`--color-border-light`), interactive controls (inputs, selects, segmented toggles) use the regular tier (`--color-border`) and gain the accent color on hover/focus; the 18px completion checkbox is the only 2px border.
_Avoid_: 0.5px hairlines, heavier borders on static elements

**Brand color**:
The Feishu/Lark blue (#1456F0 light, #6BA1FF dark) used for primary actions, active states and focus rings. The light-mode value is asserted exactly by the f3-ui-redesign-verification e2e spec, so it is change-controlled.
_Avoid_: switching hue, un-derived hover/pressed variants

**Eisenhower quadrant**:
The board view's four cells Q1–Q4 (`Q1：重要且紧急` … `Q4：不重要不紧急`), derived from the task's urgent/important flags. A task belongs to exactly one quadrant.
_Avoid_: Freeform priority quadrants, extra cells

## 提醒与重复

**重复提醒**:
A reminder on a single task that fires repeatedly on a cadence, independent of the task's own recurrence. May be unbounded (stops when the task is completed) or bounded by an end date or the task's duration window; end-date day still fires (inclusive). Missed fire times collapse into one catch-up notification on the next scheduler poll.
_Avoid_: 周期提醒, 循环提醒

**提醒节奏**:
The repeat interval of a repeating reminder: 每天/每周/每月/每年 (calendar arithmetic anchored on the first fire time), or a custom every-N-days interval. The trigger time-of-day lives on the rule itself.
_Avoid_: 周期, 频率

**提醒边界**:
The end condition of a repeating reminder: task completion, a static end date (inclusive), or the task's duration window (dynamic binding — changes to start_date/end_date propagate). When the rule's boundary mode is "follow duration" but the task has no duration set, the UI disables the option until the duration is configured.
_Avoid_: 结束日期 (ambiguous with static end)

**任务重复**:
The task's own repetition settings (每天/每周/每月/每年, with an optional end date) that generate a new task instance when the current one is completed. Independent from repeating reminders; generated instances never inherit reminders.
_Avoid_: 周期, 重复提醒 (different concept)

**持续期**:
The date range a task is expected to span, from its start date to its end date, both ends included. Drives the duration filter; a repeating reminder may use it as its boundary ("daily reminder during the duration").
_Avoid_: 时间段, 时间范围

**Date picker (日期选择器)**:
The app's custom calendar popup (`DatePicker` component) used by all date-only fields. It replaces the native `<input type="date">` popup, which renders with a light-only palette in Electron regardless of theme; a visually hidden native input keeps value semantics, form a11y and the e2e `fill()` path.
_Avoid_: Reintroducing the native date popup as the visible control, datetime-local pickers (still native light popup — known limitation)

## 安装与分发

**一键安装**:
The Windows distribution default: a one-click NSIS installer (`oneClick: true`), no wizard, installs per-user into `%LOCALAPPDATA%\Programs\ToDoList` and supports silent install (`/S`). Deliberate — per-user install avoids UAC, elevation and SmartScreen friction for a single-user offline app.
_Avoid_: 自定义安装, 安装向导

**便携版**:
The optional Windows artifact (a zip) for users who want the app without installing — extract anywhere (D:\, USB) and run. No self-extraction, no registry changes.
_Avoid_: portable-exe 自解压包