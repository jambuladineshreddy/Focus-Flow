@echo off
echo.
echo ================================================
echo   FocusFlow AI - Starting Frontend Dev Server
echo ================================================
echo.

cd /d "%~dp0\frontend"

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo Starting Vite dev server on http://localhost:5173
echo.
npm run dev

pause
