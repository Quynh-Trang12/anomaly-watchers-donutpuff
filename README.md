# AnomalyWatchers: Fraud Detection Pipeline and Dashboard

## Project Overview

This project now delivers the Assignment 3 full-stack fraud detection web application.

The current implementation includes:

- Data preprocessing and feature engineering
- Trained model loading and API inference
- React frontend with transaction simulation and results workflow
- FastAPI backend integration for live scoring
- Monitoring, history, and admin demo workflows

The system is built around a deployed Random Forest primary model for runtime predictions, with the training/research pipeline kept in the notebooks for model development and comparison.

## Architecture

| Layer | Technology | Purpose |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **Machine Learning** | Python, scikit-learn, XGBoost, imbalanced-learn | Training, evaluation, and comparison in notebooks. |
| **Backend API** | FastAPI, Pydantic, Uvicorn | Inference endpoints, schema validation, feature engineering pipeline, and model serving. |
| **Frontend UI** | React, Vite, TypeScript, Tailwind CSS | Transaction simulator, result explainability, dashboard monitoring, history, and admin demo tools. |

## Repository Structure

```text
anomaly-watchers-donutpuff/
|-- backend/
|   |-- app/
|   |   |-- main.py                # FastAPI routes and model inference logic
|   |   |-- preprocessing.py       # Shared feature engineering pipeline
|   |   `-- schemas.py             # API request/response schemas
|   |-- trained_models/            # Serialized model artifacts
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

- `backend/`: FastAPI inference service and shared preprocessing pipeline.
- `frontend/`: React TypeScript application and simulator workflows.
- `ml_pipeline/`: model training, evaluation, and continuous learning experiments.

## Local Setup and Installation

Follow these instructions to run the project locally.

### Prerequisites

1. **Node.js** (18+ recommended) and **npm**
2. **Python** (3.10+ recommended)

### Quick Start (Recommended)

Use the provided startup script from the repository root:

```bash
start_project.bat
```

This script:

- creates backend virtual environment if needed
- installs backend/frontend dependencies
- starts FastAPI on `http://127.0.0.1:8000`
- starts frontend on `http://localhost:8080`

### Manual Start

#### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload
```

#### Frontend

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

Core inference flow:

1. User enters transaction data in the simulator
2. Frontend sends payload to FastAPI
3. Backend applies preprocessing (`build_feature_matrix`)
4. Random Forest model produces fraud probability
5. Frontend renders risk score, decision mapping, and explainability factors

## API Endpoints (Current Build)

- `GET /` -> health summary
- `GET /health` -> health summary
- `POST /predict/primary` -> primary fraud prediction response

## Model Deployment (Current Build)

The runtime web app uses **Random Forest as the primary deployed model**.

- Primary artifact loading happens in `backend/app/main.py`
- Feature alignment uses `feature_columns.pkl` when available
- Prediction responses include probability, risk level, and risk factors

Other models (for example XGBoost) are kept for training/research work in Assignment 2 notebooks and artifact history, but are not the primary live web inference path in this build.

## Real vs Simulated Behavior

This project intentionally mixes real full-stack inference with demo-safe simulation features.

### Real implemented

- End-to-end frontend -> backend -> model inference (`/predict/primary`)
- Backend schema validation and error handling
- Feature engineering pipeline in backend runtime
- Health endpoint and frontend dashboard status indicator

### Simulated / demo behavior

- OTP uses a static demo code for assignment simulation
- Live dashboard stream uses synthetic demo transactions as input
- Admin console is marked demo mode (no production authentication)
- If backend is unavailable, simulator can fall back to local demo rules so the UI flow still works for presentation

## Evaluation Context

The training/evaluation work (Assignment 2) is in `ml_pipeline/notebooks/`.

- Dataset is highly imbalanced (fraud is a small minority of records)
- Notebook work includes model comparison and continuous learning experiments
- Runtime web app is focused on deterministic inference integration and explainability display

## Acknowledgments

This project builds upon synthetic data generation tools and foundational fraud-detection research by PhD. Edgar Lopez-Rojas.

- **Kaggle Dataset Link:** [Synthetic Financial Datasets For Fraud Detection](https://www.kaggle.com/datasets/ealaxi/paysim1/data)
- **GitHub Repo Link:** [PaySim Simulator Repository](https://github.com/EdgarLopezPhD/PaySim/tree/master)

