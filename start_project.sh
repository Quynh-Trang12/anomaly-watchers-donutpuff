#!/bin/bash

echo "==================================================="
echo "[COS30049] Starting AnomalyWatchers (macOS/Linux)"
echo "==================================================="

# 1. Define a cleanup function to kill both servers when you exit
cleanup() {
    echo ""
    echo "==================================================="
    echo "[*] Shutting down AnomalyWatchers securely..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "[SUCCESS] All servers stopped. Goodbye!"
    echo "==================================================="
    exit
}

# 2. Trap CTRL+C (SIGINT) or window close (SIGTERM) to trigger cleanup
trap cleanup SIGINT SIGTERM

# 3. Start Backend in the background
echo "[*] Starting FastAPI Backend..."
cd backend
pip3 install -r requirements.txt
uvicorn app.main:app --reload &
BACKEND_PID=$!  # Save the Process ID so we can kill it later
cd ..

# 4. Start Frontend in the background 
echo "[*] Starting React Frontend..."
cd frontend
npm install
npm run dev &
FRONTEND_PID=$! # Save the Process ID so we can kill it later
cd ..

echo "---------------------------------------------------"
echo "[SUCCESS] Both services are running in THIS terminal."
echo "[CRITICAL] DO NOT CLOSE THIS WINDOW!"
echo "To stop the servers safely, press CTRL+C."
echo "---------------------------------------------------"

# Wait keeps the script running and listening for the CTRL+C trap
wait