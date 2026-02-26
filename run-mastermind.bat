@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%"
set "APP_URL=http://localhost:5173"

if not exist "%APP_DIR%\package.json" (
  echo [ERROR] package.json not found:
  echo         "%APP_DIR%\package.json"
  echo Check folder structure first.
  pause
  exit /b 1
)

pushd "%APP_DIR%"

if not exist "node_modules" (
  echo [SETUP] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    popd
    pause
    exit /b 1
  )
)

echo [RUN] Starting MSTRMND dev server...
echo [INFO] Opening browser at %APP_URL%
start "" "%APP_URL%"
call npm run dev

popd
exit /b 0
