@echo off
REM ===========================================================================
REM One-click launcher for Speak Plainly (Windows).
REM Creates backend\.env on first run, installs dependencies, then opens the
REM backend and frontend in two terminal windows.
REM ===========================================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js not found. Install Node 18+ and retry.
  pause
  exit /b 1
)

if not exist "backend\.env" (
  echo - backend\.env not found - creating it from .env.example
  copy /Y "backend\.env.example" "backend\.env" >nul
  echo   WARNING: edit backend\.env and set your model API key.
  echo            ^(Article generation needs a key; the AI-smell score works offline.^)
)

if not exist "backend\node_modules" (
  echo - Installing backend dependencies...
  pushd backend
  call npm install
  popd
)

if not exist "frontend\node_modules" (
  echo - Installing frontend dependencies...
  pushd frontend
  call npm install
  popd
)

echo Starting backend  -^> http://localhost:8787
start "Speak Plainly - backend" /D "%~dp0backend" cmd /k npm start

echo Starting frontend (dev server URL is shown in its window)
start "Speak Plainly - frontend" /D "%~dp0frontend" cmd /k npm run dev

echo.
echo Two windows opened (backend + frontend). Close them to stop the servers.
endlocal
