@echo off
echo.
echo ================================================
echo   FocusFlow AI - First Time Setup
echo ================================================
echo.

cd /d "%~dp0"

REM Check if .env exists
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env"
    echo Created backend\.env from example template.
    echo.
    echo IMPORTANT: Edit backend\.env and add your:
    echo   - GOOGLE_API_KEY
    echo   - DATABASE_URL
    echo   - SECRET_KEY and JWT_SECRET_KEY (use random strings)
    echo.
    pause
)

REM Create PostgreSQL database if psql is available
where psql >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo Creating PostgreSQL database 'focusflow'...
    psql -U postgres -c "CREATE DATABASE focusflow;" 2>nul
    echo Done.
)

REM Install backend dependencies
echo.
echo Installing Python backend dependencies...
call venv\Scripts\activate.bat
pip install -r backend\requirements.txt

echo.
echo Installing frontend dependencies...
cd frontend
npm install
cd ..

echo.
echo ================================================
echo   Setup complete!
echo.
echo   To start:
echo     Backend:  start_backend.bat
echo     Frontend: start_frontend.bat
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000/docs
echo ================================================
echo.
pause
