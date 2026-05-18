@echo off
cd /d "%~dp0"
echo Preparing Com Tam Dashboard at http://localhost:3002
echo Keep this window open while viewing the dashboard.
echo.
echo Stopping anything currently using port 3002...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>nul
)
echo Cleaning stale Next.js cache...
if exist ".next" rmdir /s /q ".next"
echo Building production preview...
call npm run build
if errorlevel 1 (
  echo Build failed. Please copy the error above.
  pause
  exit /b 1
)
echo.
echo Dashboard is ready: http://localhost:3002
call npm run preview:clean
