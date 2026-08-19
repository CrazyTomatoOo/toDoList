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