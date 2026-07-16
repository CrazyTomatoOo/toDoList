#!/bin/bash
set -euo pipefail

APP_NAME="ToDoList"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${PROJECT_DIR}/dist"

OS="$(uname -s)"

echo "Verifying Windows package for ${APP_NAME} on ${OS}"
echo "Distribution dir: ${DIST_DIR}"

# Look for the NSIS installer first, then fall back to zip/portable artifacts
EXE_PATH="$(ls "${DIST_DIR}"/*.exe 2>/dev/null | head -n 1 || true)"
ZIP_PATH="$(ls "${DIST_DIR}"/*.zip 2>/dev/null | head -n 1 || true)"

if [ -n "${EXE_PATH}" ] && [ -f "${EXE_PATH}" ]; then
  echo "Found EXE installer: ${EXE_PATH}"
  SIZE="$(stat -f%z "${EXE_PATH}" 2>/dev/null || stat -c%s "${EXE_PATH}" 2>/dev/null || echo 'unknown')"
  echo "Size: ${SIZE} bytes"
  if [ "${SIZE}" = "0" ] || [ "${SIZE}" = "unknown" ]; then
    echo "ERROR: EXE is empty or size could not be determined" >&2
    exit 1
  fi
  file "${EXE_PATH}" || true
elif [ -n "${ZIP_PATH}" ] && [ -f "${ZIP_PATH}" ]; then
  echo "Found ZIP archive: ${ZIP_PATH}"
  SIZE="$(stat -f%z "${ZIP_PATH}" 2>/dev/null || stat -c%s "${ZIP_PATH}" 2>/dev/null || echo 'unknown')"
  echo "Size: ${SIZE} bytes"
  if [ "${SIZE}" = "0" ] || [ "${SIZE}" = "unknown" ]; then
    echo "ERROR: ZIP is empty or size could not be determined" >&2
    exit 1
  fi
else
  echo "ERROR: No Windows EXE or ZIP found in ${DIST_DIR}" >&2
  exit 1
fi

# On macOS (and Linux), we cannot run the Windows installer natively.
if [ "${OS}" = "Darwin" ] || [ "${OS}" = "Linux" ]; then
  echo "Runtime launch check skipped: Windows executables cannot be run natively on ${OS}."
  echo "To verify on Windows, run the installer with: ${APP_NAME}-*.exe /S"
  echo "Then launch: %LOCALAPPDATA%\\Programs\\${APP_NAME}\\${APP_NAME}.exe"
  exit 0
fi

# Windows-only runtime verification (would run on a Windows host)
if [ "${OS}" = "Windows_NT" ] || [ "${OS}" = "MINGW"* ] || [ "${OS}" = "CYGWIN"* ]; then
  echo "Windows detected; would install silently and launch the app."
  # EXE_PATH quoted for Windows paths
  # "${EXE_PATH}" /S
  # start "${APP_NAME}"
fi

echo "Verification complete"
