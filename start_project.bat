@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "BACKEND_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"

echo ===================================================
echo Starting AnomalyWatchers - FinTech Fraud Simulator
echo ===================================================

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm was not found in PATH.
  echo Please install Node.js LTS and reopen this script.
  pause
  exit /b 1
)

if not exist "%BACKEND_DIR%\requirements.txt" (
  echo [ERROR] Backend requirements file was not found.
  pause
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo [ERROR] Frontend package.json was not found.
  pause
  exit /b 1
)

if not exist "%BACKEND_PY%" (
  where py >nul 2>nul
  if not errorlevel 1 (
    echo Creating backend virtual environment with py...
    pushd "%BACKEND_DIR%"
    py -m venv .venv
    popd
  ) else (
    where python >nul 2>nul
    if errorlevel 1 (
      echo [ERROR] Python was not found in PATH.
      echo Install Python 3.11+ and ensure it is added to PATH.
      pause
      exit /b 1
    )
    echo Creating backend virtual environment with python...
    pushd "%BACKEND_DIR%"
    python -m venv .venv
    popd
  )
)

echo Starting FastAPI backend...
start "AnomalyWatchers Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && ""%BACKEND_PY%"" -m pip install -r requirements.txt && ""%BACKEND_PY%"" -m uvicorn app.main:app --reload"

echo Starting React frontend...
start "AnomalyWatchers Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm install && npm run dev"

echo Opening app in browser...
start "" http://localhost:8080

echo Both services are starting in separate windows.
echo If the simulator shows "No response from AI backend", wait for the backend window to finish starting.
pause
