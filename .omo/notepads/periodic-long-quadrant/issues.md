# Issues

# T12: Unit and integration tests for new features

- No product code bugs were revealed by the new tests.
- Test-only issues encountered and fixed:
  - `App.test.tsx` used `getByText('Test List')` which matched both the sidebar item and the header; switched to `getByRole('heading', { level: 1, name: 'Test List' })`.
  - `TaskForm.test.tsx` initially tried to enter an invalid date into a `type="date"` input, which browsers reject; replaced with a UI-testable edge case (start_date > end_date with recurrence set).
  - Added `vi.clearAllMocks()` in the new TaskForm describe block to prevent cross-test mock leakage.

# T13: E2E tests for new features

- Product bug revealed: `src/renderer/components/TaskList.tsx` did not pass the new `TaskFormData` fields (`recurrence`, `recurrence_end_date`, `start_date`, `end_date`, `is_urgent`, `is_important`) to `onCreateTask` or `onUpdateTask`. This caused the list-view create/edit path to silently drop recurrence, duration, and quadrant data. Fixed minimally by adding the fields to both `handleCreate` and `handleEdit` payloads.
- Test harness issue: creating and selecting a fresh list per `beforeEach` was unreliable when using `page.locator('[data-testid="sidebar-item"]').last().click()`. The click sometimes did not change the selected list, especially when the previous test left the app in board view. Resolved by selecting the new list by its exact name (`filter({ hasText: name })`), verifying the header changed, and forcing list view via the `view-toggle-list` button before asserting the empty task state.
- No new runtime or dev dependencies were added.
- `npm run test:e2e` passes with all 49 tests after the fix.

# F3 final E2E verification

- No new product bugs were found during the F3 run.
- The F3 suite added 5 new E2E tests in `src/__tests__/e2e/f3-final-verification.spec.ts` to close the edge-case coverage gaps (board empty quadrants, rapid toggles, and screenshots for the invalid date / recurrence filter states).
- `npm run test:e2e` passes with 54/54 tests after the F3 additions.

# F2 Final Code Quality Review

- No blocking issues found.
- Anti-pattern scan (`as any`, `@ts-ignore`, `console.log`, empty catches) returned zero matches in `src/`.
- No product code changes were required.
- Verdict: APPROVE.


# F4 Scope Fidelity Review

- No unaccounted changes or scope creep detected in the committed range f05f2a5..HEAD.
- All 13 commits map to planned T1-T13 todos.
- No Must NOT Have guardrail violations.
- Verdict: APPROVE.

# F1 Plan Compliance Audit

- No blocking product issues found.
- Minor observation: the plan's QA scenarios named several failure-path evidence files that are not present:
  `task-1-invalid-constraints.txt`, `task-2-type-error.txt`, `task-9-filter-empty.txt`,
  `task-12-failure.txt`, `task-13-e2e-failure.txt`. Each todo still has at least one evidence file
  and the corresponding failure paths are covered by passing tests, so this does not block approval.

