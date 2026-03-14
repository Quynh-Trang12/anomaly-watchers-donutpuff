# AnomalyWatchers — DonutPuff 🍩

## Fraud Detection Simulator — COS30049 Assignments 2 & 3

A full-stack, AI-powered fraud detection platform that combines a **tri-model ML pipeline** with a **real-time React dashboard** and **explainable AI (XAI)** feedback.

---

## Architecture

| Layer           | Technology                              | Purpose                                     |
| --------------- | --------------------------------------- | ------------------------------------------- |
| **ML Pipeline** | Python · scikit-learn · XGBoost · SMOTE | Tri-model training with GridSearchCV        |
| **Backend**     | FastAPI · Pydantic · joblib             | Async prediction API with XAI factors       |
| **Frontend**    | React · Vite · TypeScript · Tailwind    | Real-time dashboard & transaction simulator |
| **UI Library**  | shadcn/ui · Recharts · Framer Motion    | Charts, animations, premium components      |

### Tri-Model Architecture

1. **Logistic Regression** (Baseline) — Interpretable linear model with balanced class weights.
2. **XGBoost Classifier** (Champion) — Gradient-boosted trees with `GridSearchCV` hyperparameter tuning; scored using AUPRC (Area Under Precision-Recall Curve).
3. **Isolation Forest** (Unsupervised) — Anomaly detector trained only on legitimate transactions for "unknown unknowns."

---

## Datasets

The primary dataset used in this project is the **PaySim Synthetic Mobile-Money Transactions** dataset (`ealaxi/paysim1`) from Kaggle.
This dataset mimics real-world mobile money transactions and features extreme class imbalance, which is typical of financial fraud data. It is used to train and evaluate the machine learning models.

## Local Setup

### Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **Python** ≥ 3.10 with `pip`

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Download Datasets

To download the dataset automatically using `kagglehub`, you will need Kaggle API credentials.
Add your Kaggle credentials to a `.env` file in the `ml_pipeline/notebooks/` directory:

```env
KAGGLE_USERNAME="your-kaggle-username"
KAGGLE_KEY="your-kaggle-api-key"
```

Then, run the cells in `ml_pipeline/notebooks/01_primary_analysis.ipynb` to download the dataset to your local machine.

### 4. Train ML Models

```bash
# Development mode (10% sample, fast iteration)
python scripts/train_models.py

# Full dataset (production-quality training)
python scripts/train_models.py --full
```

This produces model artifacts in `backend/models/`:

```
backend/models/
├── model_primary.pkl          # XGBoost (Champion)
├── model_logistic.pkl         # Logistic Regression (Baseline)
├── model_isolation_forest.pkl # Isolation Forest (Unsupervised)
└── label_encoder_type.pkl     # Transaction-type encoder
```

### 5. Start the Backend

```bash
uvicorn backend.app.main:app --reload
```

The API starts at `http://localhost:8000`.

### 6. Start the Frontend

```bash
npm run dev
```

The app starts at `http://localhost:8080` (proxies `/predict/*` to the backend).

---

## Key Features

### ML Engineering (Assignment 2)

- **SMOTE** for class imbalance handling (documented justification).
- **GridSearchCV** on XGBoost with `scoring='average_precision'`.
- **AUPRC** (Area Under Precision-Recall Curve) as primary metric — not accuracy.
- Confusion matrix analysis for all three models.

### Full-Stack Architecture (Assignment 3)

- **Async endpoints** (`async def`) for <200ms response times.
- **Startup model loading** via lifespan context manager.
- **Pydantic v2** schemas with `Field()` validators on all inputs.
- **Hybrid detection**: ML probability ensembled with heuristic rules.
- **Structured XAI**: Backend returns typed `RiskFactor` objects for frontend display.

### Frontend

- **Live Dashboard** with Recharts (AreaChart, BarChart, PieChart).
- **Framer Motion** animations on all cards, charts, and modals.
- **Transaction Simulator** with preset scenarios and XAI feedback.
- **Explainability Panel** showing risk factors like "High Amount relative to Old Balance."

---

## Project Structure

```
AnomalyWatchers-DonutPuff/
├── backend/                          # FastAPI Python Domain
│   ├── app/                          # Core API Application
│   │   ├── main.py                   # API endpoints, lifecycle, & heuristic engine
│   │   └── schemas.py                # Strict Pydantic input/output validation
│   ├── models/                       # SSOT ML Handoff Directory (*.pkl, *.joblib)
│   │   └── .gitkeep                  # Preserves folder structure (binaries git-ignored)
│   ├── tests/                        # Integration Testing
│   │   ├── test_endpoints.py         # Endpoint health and latency tests
│   │   └── test_prob.py              # Probability boundary tests
│   └── requirements.txt              # Isolated Python dependencies
│
├── frontend/                         # React (Vite + TypeScript) UI Domain
│   ├── public/                       # Static assets (icons, SVGs)
│   ├── src/                          # Core Frontend Logic
│   │   ├── components/               # Modular UI (Dashboard, Simulator, Charts)
│   │   ├── pages/                    # Application Routes (Admin, Simulate, History)
│   │   ├── lib/                      # Utilities, local storage, XAI scoring rules
│   │   └── api.ts                    # Strongly-typed Backend API client
│   ├── package.json                  # Isolated Node.js dependencies
│   ├── tailwind.config.ts            # UI styling configuration
│   └── vite.config.ts                # Frontend bundler configuration
│
├── ml_pipeline/                      # Machine Learning & Data Domain
│   ├── notebooks/                    # Exploratory Data Analysis (EDA)
│   │   └── 01_primary_analysis.ipynb # Paysim feature engineering & SMOTE
│   └── scripts/                      # ML Execution Pipeline
│       └── train_models.py           # Unified model training & serialization
│
├── .gitignore                        # Repository-wide ignore rules (blocks data & models)
├── start_project.bat                 # Unified multi-terminal orchestrator
└── README.md                         # Project documentation (You are here)
```

---

## Team

**AnomalyWatchers — DonutPuff** · COS30049 · Computing Technology Design Project
