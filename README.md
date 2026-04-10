# 🛡️ AnomalyWatchers: Integrated Fraud Detection Simulator

**Assignment 3 Core Objective**: Build a unified application where users submit financial data, a server-side AI model processes the risk in real-time, and results are displayed through interactive visualizations.

---

## 🏗️ Project Overview

AnomalyWatchers is an end-to-end financial security platform designed to predict and prevent fraudulent transactions. The system integrates a high-performance **FastAPI** backend with a modern **React** frontend, powered by a **Machine Learning** core that evaluates risk factors in milliseconds.

### Key Logic: The Three-Tier Decision System
1.  **Low Risk (Approved)**: Transaction is consistent with account history and processed immediately.
2.  **Medium Risk (OTP Required)**: Unusual activity detected; requires a 6-digit security code sent via the integrated mail service.
3.  **High Risk (Blocked)**: High-probability fraud detected; transaction is prevented to protect account integrity.

---

## 🛠️ Technology Stack & Libraries

### Backend (Server-Side AI)
- **FastAPI**: Asynchronous high-performance RESTful framework.
- **Uvicorn**: ASGI server implementation for production.
- **Pydantic**: Data validation and settings management via Python type hints.
- **Scikit-Learn**: Machine Learning library used for Random Forest inference.
- **Joblib**: For serialized model loading and persistence.
- **Pandas/NumPy**: Feature engineering and vectorization pipelines.

### Frontend (Interactive UI)
- **React.js**: Functional components with Hooks for state management.
- **TypeScript**: Static typing for robust enterprise code.
- **Vite**: Ultra-fast build tool and development server.
- **Recharts**: D3-based charting library for real-time traffic visualization.
- **Lucide-React**: Premium iconography for an intuitive interface.

---

## 🚀 Setup & Installation

Follow these steps to configure both environments for local development.

### Prerequisites
- **Python 3.9+**
- **Node.js 18+**

### 1. Backend Configuration
Navigate to the `backend` directory:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Frontend Configuration
Navigate to the `frontend` directory:
```bash
cd frontend
npm install
```

---

## 🚥 Running the Application

To run the full system, you must start both the backend server and the frontend development environment.

### Step 1: Start the Backend (Port 8000)
From the `backend` folder:
```bash
python -m uvicorn app.main:app --reload --port 8000
```
*Verify by visiting: `http://localhost:8000/api/health`*

### Step 2: Start the Frontend
From the `frontend` folder:
```bash
npm run dev
```
*Access the application at: `http://localhost:5173`*

---

## 🧠 AI Model Integration

The system uses a serialized **Random Forest** model trained on millions of synthetic financial records.

### Model Loading
The AI model is integrated into the FastAPI lifespan. Upon startup, the system:
1.  Loads `.pkl` artifacts from `backend/trained_models/`.
2.  Initializes the feature alignment schema (`feature_columns.pkl`).
3.  Validates business rules from `model_configuration.json`.

### Dynamic Configuration
Thresholds for "Step-Up" (OTP) and "Block" decisions can be adjusted without restarting the server via the `model_configuration.json` file. The backend includes **integrity safeguards** that prevent invalid threshold values (e.g., OTP threshold cannot be higher than Block threshold).

### Prediction Pipeline
`Input JSON` ➡️ `Preprocessing (StandardScaler)` ➡️ `Feature Engineering` ➡️ `Inferred Probability` ➡️ `Threshold Logic` ➡️ `Final Result`

---

## 📡 API Endpoints Summary

### User & Transaction Endpoints
- `POST /api/predict/primary`: Main AI inference gate.
- `POST /api/verify-otp`: Verification logic for medium-risk transactions.
- `GET /api/users/{user_id}/balance`: Real-time ledger lookup.
- `GET /api/transactions/{user_id}`: Personal transaction history.

### Administrative Monitoring
- `GET /api/admin/transactions`: Real-time stream for the Monitor Dashboard.
- `GET /api/configuration/thresholds`: Fetch active AI gates.
- `GET /api/admin/audit_log`: System-wide security tracking.

---

© 2026 AnomalyWatchers Team | Secure. Transparent. Automated.
