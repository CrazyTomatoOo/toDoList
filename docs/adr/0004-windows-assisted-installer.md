# Windows distribution — assisted installer with a chosen install directory

Windows shipped a one-click NSIS installer that always landed in
`%LOCALAPPDATA%\Programs\ToDoList` with no directory choice — deliberate at the
time (ADR-0002), with the portable zip as the escape hatch for users who wanted
the app elsewhere. The escape hatch was never built. We are reversing the
no-choice clause instead: Windows ships an **assisted** NSIS installer
(`oneClick: false` + `allowToChangeInstallationDirectory: true`) that installs
per-user and never elevates, and the promised portable `zip` artifact is added
alongside it.

- **Directory choice without elevation.** `perMachine: false` +
  `allowElevation: false`. Elevation is what makes `C:\Program Files` writable,
  so that location is explicitly _not_ promised; any writable local directory
  (`D:\Apps\ToDoList`, a user profile) works. The default stays
  `%LOCALAPPDATA%\Programs\ToDoList`, and picking `C:\Program Files` in per-user
  mode fails at extraction with access-denied — an accepted, documented
  limitation rather than a silently half-working path. Cosmetic cost: the
  install-mode page still appears, with "Install for All Users" disabled.
- **Silent install keeps working.** `/S` is NSIS-level and unaffected by
  `oneClick`; without a previous install it targets the per-user default, and
  `/D=<path>` overrides it (must be the last argument, unquoted even when the
  path contains spaces). `scripts/verify-win-exe.sh` gains a real
  `/S /D=<temp dir>` install-and-launch check on a Windows host; CI packaging in
  `release.yml` needs no change.
- **Upgrades reuse the installed location.** `initMultiUser` reads the
  `InstallLocation` registry value, so both a silent upgrade and the wizard's
  directory page prefill the previous path. NSIS's "silent upgrade of a
  per-machine install auto-elevates" branch is unreachable here: with
  `allowElevation: false` a per-machine install can never be created, so the
  0.2.0 per-user one-click install upgrades in place without a UAC prompt.
- **Portable zip, not the `portable` target.** `win.target` adds `zip` — a plain
  archive of the unpacked app, no self-extraction at launch. The `portable`
  target is rejected: it unpacks to a fresh temp directory on every run (so data
  cannot sit beside the app) and is the only target that sets
  `PORTABLE_EXECUTABLE_DIR`. The app locates its own folder with
  `path.dirname(process.execPath)`, which is stable for an extracted zip and
  unaffected by asar; `app.isPackaged` is `true` for installed and extracted
  builds alike, so a **`portable.txt` marker next to the exe** is what opts into
  "data travels with the app" (`<exe dir>/data`). The marker's position in the
  data-directory resolution order is owned by ADR-0005.
- **Uninstall keeps user data.** `deleteAppDataOnUninstall` stays `false`: its
  delete scope is `%APPDATA%\ToDoList`, which is where ADR-0005 puts the
  bootstrap config, and an offline app's database is the user's only copy. The
  uninstaller's `--delete-app-data` flag remains the explicit escape hatch.
- **macOS untouched.** The DMG keeps drag-to-`/Applications`; no fake directory
  picker is added there.
- **The installer never asks for the data directory.** It is technically
  possible (`nsis.include` plus the shipped `customPageAfterChangeDir` hook), but
  the installer would write a per-user config as the installing user, and silent
  runs skip every page callback. Data-directory selection lives in the app's
  settings (ADR-0005).
- **This supersedes ADR-0002.** Its "no directory choice, one-click only" clause
  is reversed, and the portable zip plus `portable.txt` it promised are now
  specified here instead of staying unimplemented.

**Status:** accepted

**Considered options:**

- **Keep the one-click installer and ship only the portable zip** — rejected:
  the zip does not give users an installation at all, let alone a chosen one, and
  neither `v0.1.0` nor `v0.2.0` shipped one.
- **Two Windows artifacts (one-click plus a separate "custom install" exe)** —
  rejected: doubles the signed outputs and makes users guess which of two files
  to download for the same app.
- **`perMachine: true`, or leaving `allowElevation` on** — rejected: UAC and
  SmartScreen friction is exactly what ADR-0002 was avoiding; per-user plus an
  arbitrary writable directory covers the request without elevation.
- **Asking for the data directory inside the installer (`customPageAfterChangeDir`)** —
  rejected: installer-context config writes do not reach other users, and silent
  installs cannot answer the question.
- **The `portable` self-extracting target instead of a zip** — rejected: it
  extracts to a new temp directory on every launch, which forbids data beside the
  app.
