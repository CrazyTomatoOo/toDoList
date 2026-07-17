# ToDoList

An offline-first, cross-platform desktop todo application built with **Electron**, **Vite**, **React**, and **TypeScript**. All task data is stored locally in a SQLite database via `better-sqlite3`, so your data stays on your machine.

## Features

- **Task Management** — Create, edit, delete, and toggle tasks across multiple lists.
- **List Organization** — Group tasks into custom lists with a clean, navigable sidebar.
- **Quadrant Board** — View tasks in an Eisenhower matrix (urgent/important) for priority-based planning.
- **Recurring Tasks** — Set up repeating tasks with end dates.
- **Reminders** — Schedule reminders to keep tasks on your radar.
- **Drag & Drop** — Reorder tasks with a styled drag handle.
- **Search & Filter** — Full-text search and status filtering across tasks.
- **Import / Export** — Backup and restore your tasks as JSON.
- **Light & Dark Theme** — System-aware theme toggle with SQLite-backed persistence.
- **Keyboard Accessible** — Full keyboard navigation, focus management, and ARIA support verified with `@axe-core/playwright`.

## Tech Stack

- **Frontend** — React 18 + TypeScript
- **Build Tool** — Vite via `electron-vite`
- **Desktop Shell** — Electron
- **Database** — `better-sqlite3` (SQLite)
- **State Management** — React hooks + Electron IPC
- **Styling** — CSS custom properties / design tokens
- **Icons** — Lucide React
- **Testing** — Vitest (unit/component), Playwright (E2E), `@axe-core/playwright` (accessibility)

## Design System

The UI follows a **Feishu / Lark** inspired enterprise aesthetic with a token-driven design system:

- Primary brand color: `#1456F0`
- Neutral scale: `N50`–`N900`
- 8px grid spacing system
- Subtle shadows, rounded corners, and consistent hover/press/focus states
- Dark mode uses the same token structure with inverted neutral values for contrast

## Project Structure

```
src/
├── main/               # Electron main process
│   ├── db/             # Database connection, migrations, repositories
│   ├── ipc/            # IPC handlers
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
│   └── styles.css      # Design tokens and component styles
├── shared/             # Shared types and utilities
└── __tests__/          # Unit/component and E2E tests
    ├── components/
    ├── e2e/
    └── main/
```

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Electron app in development mode |
| `npm run build` | Build the renderer and main processes |
| `npm run preview` | Preview the production build |
| `npm test` | Run unit and component tests (rebuilds `better-sqlite3` first) |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run typecheck` | Run TypeScript type checks for both main and renderer |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint and auto-fix issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting with Prettier |
| `npm run build:mac` | Build macOS DMG |
| `npm run build:win` | Build Windows installer |
| `npm run dist` | Build macOS and Windows installers |

## Testing

- **Unit / Component** — Vitest with `@testing-library/react` and `jsdom`.
- **E2E** — Playwright launches the real Electron app and covers CRUD, keyboard navigation, dark mode, visual consistency, and accessibility.
- **Accessibility** — `@axe-core/playwright` scans plus keyboard traversal tests assert zero axe-core violations and visible focus states.

## Build & Packaging

The app is packaged with `electron-builder`. Platform-specific commands are available via `npm run build:mac`, `npm run build:win`, and `npm run dist`.

## Architecture Notes

- **Offline-first**: The SQLite database lives in the user's data directory; no cloud or server is required.
- **IPC bridge**: The main process exposes database and theme operations to the renderer through a typed preload script.
- **Design tokens**: All colors, spacing, typography, and shadows are defined as CSS custom properties in `src/renderer/styles.css` with explicit dark-mode overrides.
- **Performance**: Task rows and sortable wrappers are memoized with `React.memo`; filter state is stabilized to avoid unnecessary re-renders.
