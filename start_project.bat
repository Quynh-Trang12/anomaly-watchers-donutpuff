@echo off
echo ===================================================
echo [COS30049] Starting AnomalyWatchers
echo ===================================================

:: Start Backend in a new window with a clear warning title
echo [*] Starting FastAPI Backend...
start "BACKEND" cmd /k "title BACKEND SERVER - DO NOT CLOSE THIS WINDOW && cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload"

:: Start Frontend in a new window with a clear warning title
echo [*] Starting React Frontend...
start "FRONTEND" cmd /k "title FRONTEND SERVER - DO NOT CLOSE THIS WINDOW && cd frontend && npm install && npm run dev"

echo ---------------------------------------------------
echo [SUCCESS] Both services are starting up.
echo [CRITICAL] KEEP THE TWO NEW TERMINAL WINDOWS OPEN! 
echo Closing them will shut down the servers and cause the Server Error: 500.
echo ---------------------------------------------------
pause