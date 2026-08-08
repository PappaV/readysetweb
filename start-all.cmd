@echo off
REM =============================================
REM  SiteCraft Autopilot - 24/7 launcher
REM  Start all services: autopilot, dashboard, API
REM  Runs on this machine, starts on login
REM =============================================
cd /d C:\Users\User\demo-site-generator
set "PNPM=C:\Users\User\AppData\Roaming\npm\pnpm.cmd"

echo Starting SiteCraft Autopilot (24/7)...
echo.

REM Load env vars
for /f "usebackq tokens=1,* delims==" %%a in ("apps\generator-api\.env") do (
  if not "%%b"=="" set "%%a=%%b"
)

REM Launch dashboard (port 3001)
start "SiteCraft Dashboard" /min cmd /c ""%PNPM%" --filter dashboard start"

REM Launch API (port 3000)
start "SiteCraft API" /min cmd /c ""%PNPM%" --filter generator-api dev"

REM Wait for API to be ready, then launch autopilot
timeout /t 15 /nobreak >nul
start "SiteCraft Autopilot" /min cmd /c ""%PNPM%" --filter autopilot-runner start"

echo All services started.
