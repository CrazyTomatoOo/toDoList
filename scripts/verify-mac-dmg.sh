#!/bin/bash
set -euo pipefail

APP_NAME="ToDoList"
APP_BUNDLE="${APP_NAME}.app"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DMG_DIR="${PROJECT_DIR}/dist"
EVIDENCE_DIR="${PROJECT_DIR}/.sisyphus/evidence"

DMG_PATH="$(ls "${DMG_DIR}"/*.dmg | head -n 1)"
if [ -z "${DMG_PATH}" ] || [ ! -f "${DMG_PATH}" ]; then
  echo "ERROR: No DMG found in ${DMG_DIR}" >&2
  exit 1
fi

TEMP_DIR="$(mktemp -d -t todolist-dmg-verify)"
USER_DATA_DIR="${TEMP_DIR}/userData"
mkdir -p "${USER_DATA_DIR}"
mkdir -p "${EVIDENCE_DIR}"

MOUNT_POINT=""

cleanup() {
  echo "Cleaning up..."
  if [ -n "${MOUNT_POINT}" ] && [ -d "${MOUNT_POINT}" ]; then
    hdiutil detach "${MOUNT_POINT}" -force >/dev/null 2>&1 || true
  fi
  if pgrep -f "${APP_BUNDLE}" >/dev/null 2>&1; then
    pkill -f "${APP_BUNDLE}" || true
    sleep 2
  fi
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

echo "Mounting DMG: ${DMG_PATH}"
MOUNT_POINT="$(hdiutil attach "${DMG_PATH}" -nobrowse -readonly | tail -n 1 | awk -F'\\t' '{print $3}')"
if [ -z "${MOUNT_POINT}" ] || [ ! -d "${MOUNT_POINT}" ]; then
  echo "ERROR: Failed to mount DMG" >&2
  exit 1
fi

echo "Copying ${APP_BUNDLE} to temp dir..."
cp -R "${MOUNT_POINT}/${APP_BUNDLE}" "${TEMP_DIR}/"

APP_PATH="${TEMP_DIR}/${APP_BUNDLE}"
if [ ! -d "${APP_PATH}" ]; then
  echo "ERROR: App bundle not found at ${APP_PATH}" >&2
  exit 1
fi

echo "Launching ${APP_BUNDLE}..."
TODO_USER_DATA_DIR="${USER_DATA_DIR}" open -g "${APP_PATH}"

# Wait for the app to start and create its database
sleep 5

# Check that the process is running
if ! pgrep -f "${APP_BUNDLE}" >/dev/null 2>&1; then
  echo "ERROR: ${APP_NAME} process is not running; app may have crashed" >&2
  exit 1
fi

echo "App process is running"

# Verify better-sqlite3 loaded by checking the database file was created
if [ -f "${USER_DATA_DIR}/todo.db" ]; then
  echo "Database file created successfully: ${USER_DATA_DIR}/todo.db"
else
  echo "ERROR: Database file was not created; better-sqlite3 may not have loaded" >&2
  exit 1
fi

# Take a screenshot of the running app window
echo "Capturing screenshot..."
SCREENSHOT_PATH="${EVIDENCE_DIR}/task-16-dmg-launch.png"
screencapture -x "${SCREENSHOT_PATH}"
if [ -f "${SCREENSHOT_PATH}" ] && [ -s "${SCREENSHOT_PATH}" ]; then
  echo "Screenshot saved: ${SCREENSHOT_PATH}"
else
  echo "WARNING: Screenshot was not captured successfully" >&2
fi

echo "Verification complete"
