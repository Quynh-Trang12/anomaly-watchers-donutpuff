@echo off
REM Backend startup script with explicit Mailpit environment variables

echo ===================================================
echo [BACKEND] Mailpit SMTP Configuration
echo ===================================================

:: Set Mailpit SMTP configuration (overrides any previous Gmail settings)
set SMTP_SERVER=localhost
set SMTP_PORT=1025
set SMTP_USER=noreply@anomalywatchers.com
set SMTP_PASSWORD=

echo [OK] SMTP_SERVER set to: %SMTP_SERVER%
echo [OK] SMTP_PORT set to: %SMTP_PORT%
echo [OK] SMTP_USER set to: %SMTP_USER%
echo.

:: Navigate to backend and start FastAPI
cd backend
echo [*] Installing dependencies...
pip install -r requirements.txt

echo.
echo [*] Starting FastAPI with Mailpit SMTP (localhost:1025)...
echo [INFO] If you see SMTP errors, they should be caught by terminal fallback.
echo [INFO] Check http://localhost:8025 (Mailpit) for emails.
echo.

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
