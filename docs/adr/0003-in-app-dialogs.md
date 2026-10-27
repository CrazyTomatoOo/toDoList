# In-app confirmation dialogs — never `window.confirm` / `window.alert`

Deleting a list used `window.confirm`. Electron's native JavaScript dialogs leave the renderer's focus state desynced after they close (electron/electron#40212, #20821, #51760): the next element that mounts focused — the inline "new list" form with `autoFocus` — is neither focused nor typeable, so creating a list after deleting one silently failed ("新建项目→删除→无法输入名称").

All confirmations and message notices in the renderer now go through `src/renderer/components/ConfirmDialog.tsx`: a `role="alertdialog"` modal built on the existing `.modal-overlay`/`.modal-content` tokens, with focus on the safe (cancel) action, Tab trap, Escape to cancel, focus restoration to the trigger, and `data-testid="confirm-dialog-confirm" | "confirm-dialog-cancel"`.

- **Zero native dialogs in `src/renderer/`**: list delete (`ListSidebar`), task delete (`TaskItem`, reused by `QuadrantBoard`), and the import/export error notices in `App.tsx` (message-only dialog via `cancelLabel={null}`).
- e2e specs click `confirm-dialog-confirm` instead of accepting a Playwright dialog; Playwright's dialog interception never reproduced the bug because it bypasses the native dialog entirely.
- Regression guard: `src/__tests__/e2e/list-recreate-after-delete.spec.ts` (create → delete → create with real keyboard input) plus unit assertions that `window.confirm` is never called.

**Status:** accepted

**Considered options:**

- **Upgrade Electron to a build with the upstream focus fix** — rejected: the fix landed after Electron 37 and only covered Windows/Linux; it would neither fix the macOS report nor be testable here.
- **Blur/refocus workarounds around the native dialog** (e.g. programmatically focusing the input after `confirm` returns) — rejected: treats the symptom, leaves the desynced state reachable on every other native-dialog path.
- **Native `<dialog showModal>`** — rejected: jsdom coverage is uneven and the existing modal pattern (`.modal-overlay`, focus trap, Escape) already exists and is styled with the design tokens.
