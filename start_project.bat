@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo [COS30049] Starting AnomalyWatchers with Mailpit
echo ===================================================

:: Start Backend with dedicated startup script (ensures Mailpit env vars are set)
echo [*] Starting FastAPI Backend with Mailpit SMTP...
start "BACKEND" cmd /k "call start_backend.bat"

:: Start Frontend
echo [*] Starting React Frontend...
start "FRONTEND" cmd /k "title FRONTEND SERVER - DO NOT CLOSE THIS WINDOW && cd frontend && npm install && npm run dev"

:: Start Mailpit Email Server
echo [*] Starting Mailpit local email server...
start "MAILPIT" cmd /k "title MAILPIT EMAIL SERVER - View emails at http://localhost:8025 && D:\Software\mailpit-windows-amd64\mailpit.exe"

echo ---------------------------------------------------
echo [SUCCESS] All services are starting up.
echo.
echo [INFO] Backend:  http://localhost:8000
echo [INFO] Frontend: http://localhost:5173
echo [INFO] Mailpit:  http://localhost:8025
echo.
echo [INSTRUCTIONS]
echo   1. Wait 5 seconds for all services to start
echo   2. Open browser to http://localhost:5173 (frontend)
echo   3. Make an OTP transaction (amount between $1-$150k)
echo   4. Email appears instantly in http://localhost:8025
echo   5. Copy OTP code and enter in browser
echo.
echo [CRITICAL] KEEP ALL THREE WINDOWS OPEN! 
echo Closing them will cause errors on the frontend.
echo ---------------------------------------------------
pause