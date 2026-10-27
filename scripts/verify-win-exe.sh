#!/bin/bash
set -euo pipefail

APP_NAME="ToDoList"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${PROJECT_DIR}/dist"

OS="$(uname -s)"

echo "Verifying Windows package for ${APP_NAME} on ${OS}"
echo "Distribution dir: ${DIST_DIR}"

# The NSIS installer and the portable zip are two separate deliverables: a
# complete Windows distribution has BOTH, and each is verified independently.
# (__uninstaller.exe is an electron-builder build intermediate, never shipped.)
EXE_PATH="$(ls "${DIST_DIR}"/*.exe 2>/dev/null | grep -v '__uninstaller' | head -n 1 || true)"
ZIP_PATH="$(ls "${DIST_DIR}"/*.zip 2>/dev/null | head -n 1 || true)"

# Size + `file` type check for one artifact; returns non-zero if unusable.
verify_artifact() {
  local label="${1}"
  local artifact="${2}"
  echo "Found ${label}: ${artifact}"
  local size
  size="$(stat -f%z "${artifact}" 2>/dev/null || stat -c%s "${artifact}" 2>/dev/null || echo 'unknown')"
  echo "[${label}] Size: ${size} bytes"
  if [ "${size}" = "0" ] || [ "${size}" = "unknown" ]; then
    echo "ERROR: ${label} is empty or size could not be determined" >&2
    return 1
  fi
  if command -v file >/dev/null 2>&1; then
    file "${artifact}" || true
  else
    echo "[${label}] 'file' command not available; skipping type check"
  fi
}

# A zip that exists but does not unpack to a runnable exe is not a deliverable.
verify_zip_contents() {
  local artifact="${1}"
  if ! command -v unzip >/dev/null 2>&1; then
    echo "[ZIP archive] 'unzip' not available; skipping content check"
    return 0
  fi
  # `set -o pipefail` + `grep -q` would report failure when grep exits early and
  # SIGPIPEs unzip, so capture the listing first and match in the shell.
  local listing
  if ! listing="$(unzip -l "${artifact}")"; then
    echo "ERROR: ${artifact} could not be listed by unzip" >&2
    return 1
  fi
  if [[ "${listing}" == *"${APP_NAME}.exe"* ]]; then
    echo "[ZIP archive] Contains ${APP_NAME}.exe"
    return 0
  fi
  echo "ERROR: ${artifact} does not contain ${APP_NAME}.exe" >&2
  return 1
}

EXE_FAILED=0
if [ -n "${EXE_PATH}" ] && [ -f "${EXE_PATH}" ]; then
  verify_artifact "EXE installer" "${EXE_PATH}" || EXE_FAILED=1
else
  echo "ERROR: No EXE installer found in ${DIST_DIR} (expected ${APP_NAME}-<version>-x64.exe)" >&2
  EXE_FAILED=1
fi

ZIP_FAILED=0
if [ -n "${ZIP_PATH}" ] && [ -f "${ZIP_PATH}" ]; then
  if verify_artifact "ZIP archive" "${ZIP_PATH}" && verify_zip_contents "${ZIP_PATH}"; then
    :
  else
    ZIP_FAILED=1
  fi
else
  echo "ERROR: No ZIP archive found in ${DIST_DIR} (expected ${APP_NAME}-<version>-x64.zip)" >&2
  ZIP_FAILED=1
fi

if [ "${EXE_FAILED}" = "1" ] || [ "${ZIP_FAILED}" = "1" ]; then
  echo 'ERROR: Incomplete Windows distribution: the NSIS installer (.exe) AND the portable zip are both required' >&2
  exit 1
fi

# The real install/launch/uninstall flow only works on a Windows host.
case "${OS}" in
MINGW*|MSYS*|CYGWIN*)
  ;;
*)
  echo "Runtime install/launch/uninstall check skipped: Windows executables cannot be run natively on ${OS}."
  echo "On a Windows host (Git Bash) this script performs the full flow:"
  echo "  ${APP_NAME}-<version>-x64.exe /S /D=<temp dir>  silent install (no UAC)"
  echo "  launch ${APP_NAME}.exe and wait for todo.db"
  echo "  silent uninstall, then confirm the install directory is gone"
  exit 0
  ;;
esac

# --- Windows host: real /S /D=<dir> install -> launch -> todo.db -> uninstall ---

# NSIS switches ("/S", "/D=", "_?=") must reach the installer verbatim; Git
# Bash / MSYS2 would otherwise rewrite them as POSIX paths ("/S" would become
# "C:\...\Git\S"). Disabled for every native invocation below.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

if ! command -v cygpath >/dev/null 2>&1; then
  echo 'ERROR: cygpath not found; run this script from Git Bash (or MSYS2/Cygwin) on Windows' >&2
  exit 1
fi

# mktemp -d keeps every path below space-free, which /D= and _?= require:
# NSIS mandates they are the last argument and never quoted.
TEMP_ROOT="$(mktemp -d)"
INSTALL_DIR="${TEMP_ROOT}/install"
USER_DATA_DIR="${TEMP_ROOT}/user-data"
mkdir -p "${USER_DATA_DIR}"

EXE_PATH_WIN="$(cygpath -w "${EXE_PATH}")"
INSTALL_DIR_WIN="$(cygpath -w "${INSTALL_DIR}")"
USER_DATA_DIR_WIN="$(cygpath -w "${USER_DATA_DIR}")"

case "${INSTALL_DIR_WIN}" in
*[[:space:]]*)
  echo "ERROR: Install dir '${INSTALL_DIR_WIN}' contains spaces; /D= cannot pass a quoted path" >&2
  exit 1
  ;;
esac

APP_PID=''
cleanup() {
  if [ -n "${APP_PID}" ]; then
    kill "${APP_PID}" 2>/dev/null || true
  fi
  taskkill /F /IM "${APP_NAME}.exe" >/dev/null 2>&1 || true
  rm -rf "${TEMP_ROOT}"
}
trap cleanup EXIT

echo "Silent install: ${EXE_PATH_WIN} /S /D=${INSTALL_DIR_WIN}"
if ! "${EXE_PATH_WIN}" /S "/D=${INSTALL_DIR_WIN}"; then
  echo 'ERROR: Silent install failed (installer exited non-zero)' >&2
  exit 1
fi

APP_EXE="${INSTALL_DIR}/${APP_NAME}.exe"
APP_EXE_WIN="$(cygpath -w "${APP_EXE}")"
UNINSTALLER="${INSTALL_DIR}/Uninstall ${APP_NAME}.exe"
# /D= installs into the exact directory given: the assisted installer's
# directory-page callback that appends the app name never runs in silent mode.
if [ ! -f "${APP_EXE}" ] || [ ! -f "${UNINSTALLER}" ]; then
  echo "ERROR: Install incomplete; expected '${APP_EXE}' and '${UNINSTALLER}'" >&2
  ls -la "${INSTALL_DIR}" 2>/dev/null || true
  exit 1
fi
echo "Installed to: ${INSTALL_DIR_WIN}"

# TODO_USER_DATA_DIR is the app's highest-priority data-dir override (test
# hook), so this launch check never touches the real %APPDATA% profile.
echo "Launching ${APP_NAME}.exe (TODO_USER_DATA_DIR=${USER_DATA_DIR_WIN})"
TODO_USER_DATA_DIR="${USER_DATA_DIR_WIN}" "${APP_EXE_WIN}" &
APP_PID=$!

DB_PATH="${USER_DATA_DIR}/todo.db"
echo "Waiting for database file: ${DB_PATH}"
WAITED=0
while [ ! -f "${DB_PATH}" ] && [ "${WAITED}" -lt 30 ]; do
  sleep 2
  WAITED=$((WAITED + 1))
done
if [ ! -f "${DB_PATH}" ]; then
  echo 'ERROR: todo.db was not created within 60 seconds; the app may have failed to start' >&2
  tasklist /FI "IMAGENAME eq ${APP_NAME}.exe" || true
  exit 1
fi
echo "Database created: ${DB_PATH}"

echo 'Stopping app...'
kill "${APP_PID}" 2>/dev/null || true
wait "${APP_PID}" 2>/dev/null || true
APP_PID=''
taskkill /F /IM "${APP_NAME}.exe" >/dev/null 2>&1 || true
sleep 2

# Copy the uninstaller out of the install dir before running it (electron-
# builder's own upgrade path does the same): a directly-invoked uninstaller
# cannot delete the exe it is running from, which would leave the install
# dir behind. "_?=" makes the uninstaller run synchronously.
UNINSTALLER_COPY="${TEMP_ROOT}/old-uninstaller.exe"
UNINSTALLER_COPY_WIN="$(cygpath -w "${UNINSTALLER_COPY}")"
cp "${UNINSTALLER}" "${UNINSTALLER_COPY}"

echo "Silent uninstall: ${UNINSTALLER_COPY_WIN} /S _?=${INSTALL_DIR_WIN}"
if ! "${UNINSTALLER_COPY_WIN}" /S "_?=${INSTALL_DIR_WIN}"; then
  echo 'ERROR: Silent uninstall failed (uninstaller exited non-zero)' >&2
  exit 1
fi

if [ -e "${INSTALL_DIR}" ]; then
  echo "ERROR: Install dir still exists after uninstall: ${INSTALL_DIR_WIN}" >&2
  ls -la "${INSTALL_DIR}" 2>/dev/null || true
  exit 1
fi
echo 'Install directory removed by uninstaller'

# deleteAppDataOnUninstall: false — the database must survive the uninstall.
if [ ! -f "${DB_PATH}" ]; then
  echo "ERROR: ${DB_PATH} disappeared after uninstall; user data must be kept (deleteAppDataOnUninstall: false)" >&2
  exit 1
fi
echo 'User data (todo.db) survived the uninstall'

echo 'Verification complete'
