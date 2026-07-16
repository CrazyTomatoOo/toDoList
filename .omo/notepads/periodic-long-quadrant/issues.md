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
