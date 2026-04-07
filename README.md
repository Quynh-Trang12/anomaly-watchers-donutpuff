# AnomalyWatchers: Fraud Detection Pipeline and Dashboard

## Project Overview

This project delivers the Assignment 3 full-stack fraud detection web application.

The current implementation includes:

- Data preprocessing and feature engineering
- Trained model loading and API inference
- React frontend with transaction simulation and results workflow
- FastAPI backend integration for live scoring
- Monitoring, history, admin review workflows, and email notifications via FastAPI-Mail (Mailtrap/Mailhog ready)

The system is built around a deployed Random Forest primary model for runtime predictions, with the training/research pipeline kept in notebooks for model development and comparison.

## Architecture

| Layer | Technology | Purpose |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| **Machine Learning** | Python, scikit-learn, XGBoost, imbalanced-learn | Training, evaluation, and comparison in notebooks. |
| **Backend API** | FastAPI, Pydantic, Uvicorn, FastAPI-Mail | Inference endpoints, schema validation, feature engineering pipeline, model serving, and transactional email delivery to Mailtrap/Mailhog. |
| **Frontend UI** | React, Vite, TypeScript, Tailwind CSS | Transaction simulator, result explainability, dashboard monitoring, history, and admin review tools. |

## Repository Structure

```text
anomaly-watchers-donutpuff/
|-- backend/
|   |-- app/
|   |   |-- main.py                # FastAPI routes, auth, workflow and inference logic
|   |   |-- preprocessing.py       # Shared feature engineering pipeline
|   |   |-- schemas.py             # API request/response schemas
|   |   `-- services/
|   |       `-- mail_service.py    # FastAPI-Mail sender (Mailtrap/Mailhog)
|   |-- trained_models/            # Serialized model artifacts
|   |-- .env.example               # Backend environment template
|   `-- requirements.txt
|
|-- frontend/
|   |-- src/
|   |   |-- api.ts                 # Frontend API client
|   |   |-- pages/                 # Landing, Simulate, Result, History, Admin
|   |   |-- components/            # Dashboard, simulator, result, admin UI
|   |   `-- lib/                   # Storage and scoring helpers
|   `-- package.json
|
|-- ml_pipeline/
|   |-- data/
|   `-- notebooks/                 # Assignment 2 / training and continuous learning work
|
`-- start_project.bat              # Windows startup helper
```

### Repository Structure Overview

The repository is organized into three domains:

- `backend/`: FastAPI inference service, workflow logic, auth, and email notification routes.
- `frontend/`: React TypeScript application and simulator workflows.
- `ml_pipeline/`: model training, evaluation, and continuous learning experiments.

## Local Setup and Installation

Follow these instructions to run the project locally.

### Prerequisites

1. **Node.js** (18+ recommended) and **npm**
2. **Python** (3.10+ recommended)
3. One mail sandbox option:
   - **Mailhog** (fastest local inbox), or
   - **Mailtrap** sandbox SMTP inbox

## Email Setup (FastAPI-Mail + Mailtrap/Mailhog)

This build uses FastAPI-Mail from the backend. It is localhost/demo-ready and does not require Gmail API in this pass.

Copy backend env template and fill values:

```bash
cd backend
copy .env.example .env
```

### Option A: Mailhog (local and fastest)

Use these `.env` values:

- `MAIL_SERVER=127.0.0.1`
- `MAIL_PORT=1025`
- `MAIL_USE_CREDENTIALS=false`
- `MAIL_STARTTLS=false`
- `MAIL_SSL_TLS=false`
- `MAIL_FROM=alerts@anomalywatchers.dev`

Open Mailhog UI (usually `http://127.0.0.1:8025`) to view sent emails.

### Option B: Mailtrap (cloud sandbox)

Use the SMTP credentials from your Mailtrap inbox:

- `MAIL_SERVER`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `MAIL_USE_CREDENTIALS=true`
- `MAIL_STARTTLS=true`
- `MAIL_SSL_TLS=false`
- `MAIL_FROM`

Optional:

- `ADMIN_REVIEW_EMAILS` as comma-separated fallback admin email list
- `APP_FRONTEND_URL` (default `http://localhost:8080`)

## Quick Start (Recommended)

From the repository root:

```bash
start_project.bat
```

This script:

- creates backend virtual environment if needed
- installs backend/frontend dependencies
- starts FastAPI on `http://127.0.0.1:8000`
- starts frontend on `http://localhost:8080`

## Manual Start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env
# edit .env for Mailhog or Mailtrap
.venv\Scripts\python -m uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:8080`.

## Frontend-Backend Integration

The frontend calls the FastAPI backend directly in development:

- `POST /predict/primary` for scoring
- `GET /health` for backend status
- Notification routes:
  - `POST /notifications/user-confirmation`
  - `POST /notifications/user-otp`
  - `POST /notifications/admin-review`

Core inference flow:

1. User enters transaction data in the simulator
2. Frontend sends payload to FastAPI
3. Backend applies preprocessing (`build_feature_matrix`)
4. Random Forest model produces fraud probability
5. Frontend renders risk score, decision mapping, and explainability factors

Decision flow in the current app:

- Low Risk -> direct approval (no email, no OTP)
- Medium Risk -> send user confirmation email -> if YES then OTP email + OTP challenge, if NO then blocked
- High Risk -> route to Admin Review Queue + notify admin + notify user that transaction is under review

## API Endpoints (Current Build)

- `GET /` -> health summary
- `GET /health` -> health summary
- `POST /auth/login` -> issue access token
- `POST /auth/signup` -> create account and issue access token
- `GET /auth/me` -> current user profile
- `POST /predict/primary` -> primary fraud prediction response
- `POST /transactions` -> persist transaction for current user
- `GET /transactions/me` -> current user transactions
- `GET /transactions/all` -> all transactions (admin only)
- `PATCH /transactions/{transaction_id}` -> update decision/review state
- `POST /notifications/user-confirmation` -> send medium-risk confirmation email to user
- `POST /notifications/user-otp` -> send OTP email to user
- `POST /notifications/admin-review` -> send review queue notification to admin recipients

## Model Deployment (Current Build)

The runtime web app uses **Random Forest as the primary deployed model**.

- Primary artifact loading happens in `backend/app/main.py`
- Feature alignment uses `feature_columns.pkl` when available
- Prediction responses include probability, risk level, and risk factors

Other models (for example XGBoost) are kept for training/research work in Assignment 2 notebooks and artifact history, but are not the primary live web inference path in this build.

## Real vs Simulated Behavior

### Real implemented

- End-to-end frontend -> backend -> model inference (`/predict/primary`)
- Backend schema validation and error handling
- Feature engineering pipeline in backend runtime
- Health endpoint and frontend dashboard status indicator
- Real backend email sending via FastAPI-Mail to Mailtrap/Mailhog inbox:
  - medium-risk user confirmation
  - medium-risk OTP delivery
  - high-risk admin review notification
  - high-risk user under-review notification

### Simulated / demo behavior

- Transaction traffic in simulator/dashboard is still synthetic demo data
- OTP verification in app currently uses a fixed demo code path for class demonstration
- User/admin accounts and transaction store are local JSON files (assignment scope, not production IAM/database)

## Evaluation Context

The training/evaluation work (Assignment 2) is in `ml_pipeline/notebooks/`.

- Dataset is highly imbalanced (fraud is a small minority of records)
- Notebook work includes model comparison and continuous learning experiments
- Runtime web app focuses on deterministic inference integration, workflow gating, and explainability display

## Acknowledgments

This project builds upon synthetic data generation tools and foundational fraud-detection research by PhD. Edgar Lopez-Rojas.

- **Kaggle Dataset Link:** [Synthetic Financial Datasets For Fraud Detection](https://www.kaggle.com/datasets/ealaxi/paysim1/data)
- **GitHub Repo Link:** [PaySim Simulator Repository](https://github.com/EdgarLopezPhD/PaySim/tree/master)
