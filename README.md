<div align="center">

# ✅ ToDoList

**An offline-first, cross-platform desktop todo app built with Electron, React, and TypeScript.**

Your tasks live **on your machine** — powered by SQLite, no cloud, no account, no tracking.

![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-37.2-gray?logo=electron&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=flat-square)
![SQLite](https://img.shields.io/badge/storage-better--sqlite3-003B57?logo=sqlite&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/bundler-electron--vite-646CFF?logo=vite&logoColor=white&style=flat-square)

![tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-6B21A8?style=flat-square)
![a11y](https://img.shields.io/badge/a11y-axe--core-brightgreen?style=flat-square)
[![MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

</div>

---

## ✨ Features

| | |
|---|---|
| **📋 Task Management** | Create, edit, delete, and toggle tasks across multiple lists. |
| **🗂️ List Organization** | Group tasks into custom lists in a clean, navigable sidebar. |
| **🎯 Quadrant Board** | View tasks in an **Eisenhower matrix** (urgent / important) for priority planning. |
| **🔁 Recurring Tasks** | Set up repeating tasks, with optional end dates. |
| **⏰ Reminders** | Schedule reminders to keep tasks on your radar. |
| **🤏 Drag & Drop** | Reorder tasks with a styled drag handle. |
| **🔍 Search & Filter** | Full-text search and status filtering across all tasks. |
| **💾 Import / Export** | Backup and restore your tasks as JSON. |
| **🌗 Light & Dark Theme** | System-aware theme toggle with persistent storage. |
| **⌨️ Keyboard Accessible** | Full keyboard navigation, focus management, and ARIA support — zero `axe-core` violations. |

> **Privacy first** — all data stays in a local SQLite database on your device. No cloud, no account, no telemetry.

---

## 🧰 Tech Stack

| Layer | Choice |
|-------|--------|
| UI | React 18 + TypeScript |
| Desktop shell | Electron |
| Build tool | Vite via `electron-vite` |
| Database | `better-sqlite3` (SQLite) |
| State management | React hooks + typed Electron IPC |
| Styling | CSS custom properties / design tokens |
| Icons | Lucide React |
| Drag & drop | `@dnd-kit` |
| Unit / component tests | Vitest (`@testing-library/react`, `jsdom`) |
| E2E / a11y tests | Playwright + `@axe-core/playwright` |

---

## 🎨 Design System

The UI follows a **Feishu / Lark**-inspired enterprise aesthetic with a token-driven design system:

- **Primary brand color:** `#1456F0`
- **Neutral scale:** `N50`–`N900`
- **8px grid** spacing system
- Subtle shadows, rounded corners, and consistent hover / press / focus states
- **Dark mode** uses the same token structure with inverted neutral values for contrast

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm

### Install & run

```bash
# Install dependencies (rebuilds better-sqlite3 for your Electron runtime)
npm install

# Launch the app in development mode
npm run dev
```

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the app in development mode |
| `npm run build` | Build the renderer and main processes |
| `npm run preview` | Preview the production build |
| `npm test` | Run unit/component tests (rebuilds `better-sqlite3` first) |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run typecheck` | Type-check both main and renderer |
| `npm run lint` / `npm run lint:fix` | Lint with ESLint (and auto-fix) |
| `npm run format` / `format:check` | Format with Prettier (and check) |
| `npm run build:mac` | Build the macOS DMG |
| `npm run build:win` | Build the Windows installer |
| `npm run dist` | Build macOS and Windows installers |

---

## 🧪 Testing

- **Unit / Component** — Vitest with `@testing-library/react` and `jsdom`.
- **E2E** — Playwright launches the real Electron app and covers CRUD, keyboard navigation, dark mode, visual consistency, and accessibility.
- **Accessibility** — `@axe-core/playwright` scans plus keyboard-traversal tests assert **zero** axe violations and visible focus states.

---

## 📁 Project Structure

```
src/
├── main/               # Electron main process
│   ├── db/             # Connection, migrations, repositories
│   ├── ipc/            # Typed IPC handlers
│   ├── services/       # Business logic (import/export, theme, reminders)
│   ├── main.ts         # Entry point
│   ├── preload.ts      # Preload script
│   └── window.ts       # Window management
├── renderer/           # React app
│   ├── components/     # UI components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # Renderer-side services
│   ├── App.tsx         # Root component
│   ├── main.tsx        # Renderer entry
│   └── styles.css      # Design tokens & component styles
├── shared/             # Shared types and utilities
└── __tests__/          # Unit/component & E2E tests
    ├── components/
    ├── e2e/
    └── main/
```

---

## 🏗️ Architecture

- **Offline-first** — The SQLite database lives in the user's data directory; no server is required.
- **Typed IPC bridge** — The main process exposes database and theme operations to the renderer through a typed preload script.
- **Design tokens** — Colors, spacing, typography, and shadows are CSS custom properties in `src/renderer/styles.css`, with explicit dark-mode overrides.
- **Performance** — Task rows and sortable wrappers are memoized with `React.memo`; filter state is stabilized to avoid unnecessary re-renders.

---

## 📦 Packaging

The app is packaged with [`electron-builder`](/electron-builder.yml). Platform-specific builds:

```bash
npm run build:mac   # macOS DMG
npm run build:win   # Windows NSIS installer (x64)
npm run dist        # Both platforms
```

`better-sqlite3`'s native module is unpacked from the ASAR archive so it loads correctly at runtime.

---

## 📄 License

[MIT](LICENSE) © 2026 ToDoList