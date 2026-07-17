# UI Redesign — Decisions

## [2026-07-16] Orchestrator: T3/T4 run SEQUENTIALLY, not parallel
- Plan's execution strategy lists Wave 2 as T3 ∥ T4; grilling answer said "limited parallelism (T3+T4 parallel)".
- Reality: both tasks modify `src/renderer/App.tsx` AND `src/renderer/styles.css`. Two agents editing+staging the same files concurrently breaks atomic-commit integrity (each `git add App.tsx` sweeps up the other's uncommitted work) and causes edit-anchor conflicts.
- Resolution: named file conflict ⇒ sequential per orchestrator rule. T3 (sidebar+shell) first with strict region partition, then T4 (header/view-toggle).

## [2026-07-16] T3: App.tsx left unmodified (accepted deviation)
- T3 spec mentioned updating App.tsx shell region; agent achieved shell spacing/separator purely via CSS (`.app-layout` gap + background). JSX was already correct. Visual goal satisfied; zero-JSX-change accepted.