@echo off
echo ===================================================
echo Starting AnomalyWatchers - FinTech Fraud Simulator
echo ===================================================

:: Start Backend in a new window
echo Starting FastAPI Backend...
start cmd /k "cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload"

:: Start Frontend in a new window
echo Starting React Frontend...
start cmd /k "cd frontend && npm install && npm run dev"

echo Both services are starting up. Please check the new terminal windows.
pause