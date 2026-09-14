@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_ROOT=%~dp0"
set "MAILPIT_EXE="

if defined MAILPIT_PATH if exist "%MAILPIT_PATH%" set "MAILPIT_EXE=%MAILPIT_PATH%"
if not defined MAILPIT_EXE if exist "%PROJECT_ROOT%mailpit.exe" set "MAILPIT_EXE=%PROJECT_ROOT%mailpit.exe"
if not defined MAILPIT_EXE where mailpit.exe >nul 2>&1 && set "MAILPIT_EXE=mailpit.exe"

echo ===================================================
echo [COS30049] Starting AnomalyWatchers with Mailpit
echo ===================================================

:: Start Backend with dedicated startup script (ensures Mailpit env vars are set)
echo [*] Starting FastAPI Backend with Mailpit SMTP...
start "BACKEND" /D "%PROJECT_ROOT%" cmd /k "call start_backend.bat"

:: Start Frontend
echo [*] Starting React Frontend...
start "FRONTEND" /D "%PROJECT_ROOT%frontend" cmd /k "title FRONTEND SERVER - DO NOT CLOSE THIS WINDOW && npm install && npm run dev"

:: Start Mailpit Email Server
echo [*] Starting Mailpit local email server...
if defined MAILPIT_EXE (
	echo [*] Starting Mailpit local email server...
	start "MAILPIT" /D "%PROJECT_ROOT%" "%MAILPIT_EXE%"
) else (
	echo [INFO] Mailpit was not found. The backend will print OTP codes in its terminal.
)

echo ---------------------------------------------------
echo [SUCCESS] All services are starting up.
echo.
echo [INFO] Backend:  http://localhost:8000
echo [INFO] Frontend: http://localhost:5173
if defined MAILPIT_EXE echo [INFO] Mailpit:  http://localhost:8025
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