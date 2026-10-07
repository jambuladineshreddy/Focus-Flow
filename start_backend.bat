@echo off
echo.
echo ================================================
echo   FocusFlow AI - Starting Backend Server
echo ================================================
echo.

cd /d "%~dp0"

if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found. Run setup.bat first.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

if not exist "backend\.env" (
    echo ERROR: backend\.env not found. Copy backend\.env.example to backend\.env and add your API keys.
    pause
    exit /b 1
)

echo Starting FastAPI backend on http://localhost:8000
echo API docs available at http://localhost:8000/docs
echo.

cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
