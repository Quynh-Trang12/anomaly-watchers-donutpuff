# AnomalyWatchers: Fraud Detection Pipeline and Dashboard

## Project Overview

This repository contains a full-stack, enterprise-grade machine learning platform designed for real-time financial fraud detection. The system integrates a four-model machine learning architecture with a FastAPI backend and a React-based frontend dashboard. It features continuous learning capabilities, enabling the models to scale across massive data streams while maintaining highly accurate prediction thresholds.

The primary objective of this project is to detect illicit transactions in highly imbalanced financial datasets without relying on misleading accuracy metrics. Instead, the architecture optimizes for the Area Under the Precision-Recall Curve (AUPRC) and the F1-Score, ensuring malicious behavior is identified while false positives are strictly minimized to preserve the legitimate customer experience.

## Architecture

| Layer                    | Technology                                      | Purpose                                                                  |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **Machine Learning**     | Python, scikit-learn, XGBoost, imbalanced-learn | Four-model architecture with GridSearchCV and SMOTE oversampling.        |
| **Incremental Learning** | Pandas, joblib, sklearn.linear_model            | Prequential evaluation (test-then-train) pipeline for Big Data streams.  |
| **Backend API**          | FastAPI, Pydantic, Uvicorn                      | Asynchronous inference endpoints with deterministic feature engineering. |
| **Frontend UI**          | React, Vite, TypeScript, Tailwind CSS           | Real-time monitoring dashboard and interactive transaction simulator.    |

### Machine Learning Four-Model Architecture

The system evaluates incoming transactions using a multi-layered defense strategy defined in the initial analysis and continuous learning pipelines:

1. **Ensemble Model: Random Forest Classifier**
   The champion ensemble model optimized via `GridSearchCV`. To handle the extreme class imbalance, it utilizes `imblearn.pipeline.Pipeline` to apply the Synthetic Minority Over-sampling Technique (SMOTE) with a sampling strategy of 1.0 strictly within the cross-validation training folds. It achieves the highest AUPRC (0.9986) on the initial test set. During continuous learning, it is updated iteratively using `warm_start=True` to append new decision trees.
2. **Challenger Model: XGBoost Classifier**
   A high-performance gradient boosting model utilized as a parallel evaluation engine. Like the Primary model, it relies on a SMOTE pipeline to artificially balance the fraud class during training, preventing the majority class from washing out the minority signal. It supports direct booster continuation (`xgb_model`) for incremental weight updates on new data chunks.
3. **Baseline Model: Logistic Regression / SGDClassifier**
   A linear model incorporating `class_weight='balanced'` used to establish a performance floor. In the continuous learning phase, it is transitioned to an `SGDClassifier` optimizing for `log_loss` to support `partial_fit` batch training.
4. **Unsupervised Model: Isolation Forest**
   An anomaly detection model trained exclusively on legitimate transactions. It acts as a static monitor to detect completely novel attack patterns that lack historical labels.

## Data Engineering and Continuous Learning

### Feature Engineering Pipeline

The pipeline relies on a strict, deterministic ETL function (`build_feature_matrix`) encapsulated via `Pandas.pipe()`. This function is executed identically during offline training and online API inference to prevent schema mismatch. Key engineering steps include:

- **Data Leakage Prevention**: Post-transaction balances (`newbalanceOrig`, `newbalanceDest`) are dropped immediately, as they act as future-state variables unavailable during real-time prediction.
- **Ratio Features**: Contextual indicators such as `account_drain_ratio` and `amount_to_destination_ratio` are engineered. The Random Forest feature importance analysis confirms `account_drain_ratio` as the most critical predictive variable.
- **Cyclical Time Encoding**: The linear 24-hour cycle is transformed using sine and cosine functions to accurately map temporal patterns.
- **Logarithmic Scaling**: Transaction amounts are compressed using `log1p` to normalize extreme monetary outliers.

### Big Data Scaling Pipeline

The continuous learning notebook processes generated datasets in chunks of approximately 3.4 million rows to prevent system memory overload.

- **Prequential Evaluation**: To prevent data leakage, each new data chunk is evaluated against the existing models before any updates occur.
- **Deferred Oversampling**: SMOTE is applied exclusively to the training subset after the prequential evaluation is complete, preserving the mathematical integrity of the test metrics.

## Repository Structure

```text
anomaly-watchers-donutpuff/
├── backend/                                  # FastAPI application domain
│   ├── app/                                  # Core application logic
│   │   ├── __init__.py                       # Marks ./backend/app as a Python package
│   │   ├── main.py                           # Application entry point, API routes, and heuristic engine
│   │   └── preprocessing.py                  # Shared ETL pipeline logic (build_feature_matrix)
│   │
│   ├── models/                               # Serialized ML models and artifacts with v2 for updated models (continuous learning)
│   │   ├── feature_columns.pkl               # Pickled list of exact column names for schema alignment
│   │   ├── model_rf.pkl                      # Random Forest model pipeline
│   │   ├── model_rf_v2.pkl
│   │   ├── model_xgboost.pkl                 # XGBoost model pipeline
│   │   └── model_xgboost_v2.pkl
│   │
│   ├── tests/                                # Backend test suite
│   │   └── __init__.py                       # Marks ./backend/tests as a Python test package
│   ├── __init__.py                           # Marks ./backend as a Python package
│   └── requirements.txt                      # Python dependencies
│
├── frontend/                                 # React TypeScript application
│   ├── public/                               # Static assets
│   ├── src/                                  # Frontend source code
│   ├── components.json                       # Configuration file for shadcn/ui components
│   ├── eslint.config.js                      # Linter configuration for code quality
│   ├── index.html                            # Main HTML template for the Vite application
│   ├── package.json                          # Node.js project metadata and dependencies
│   ├── postcss.config.js                     # PostCSS configuration for CSS processing (used by Tailwind)
│   ├── tailwind.config.ts                    # Tailwind CSS configuration for utility classes and theme
│   ├── tsconfig.app.json                     # TypeScript configuration specific to the application code
│   ├── tsconfig.json                         # Base TypeScript configuration
│   ├── tsconfig.node.json                    # TypeScript configuration for Node environments
│   ├── vite.config.ts                        # Vite build tool configuration
│   └── vitest.config.ts                      # Vitest testing framework configuration
│
├── ml_pipeline/                              # Machine learning development
│   ├── data/                                 # Storage for generated datasets
│   │   ├── additional_dataset_1692201870.csv # Generated dataset chunk 1
│   │   ├── additional_dataset_1693836805.csv #               ... chunk 2
│   │   ├── additional_dataset_1697052344.csv #               ... chunk 3
│   │   ├── additional_dataset_1697079627.csv #               ... chunk 4
│   │   ├── additional_dataset_1698465888.csv #               ... chunk 5
│   │   └── Stratified_Sampling.webp          # Educational image diagramming the stratified split process
│   │
│   └── notebooks/                            # Jupyter training notebooks
│       ├── .env                              # Environment variables for storing Kaggle API credentials
│       ├── .ipynb_checkpoints/               # Autosave directory for Jupyter
│       ├── 01_primary_analysis.ipynb         # EDA, pipeline creation, and initial model training
│       └── 02_continuous_learning.ipynb      # Incremental learning loop over the additional data chunks
│
├── .gitignore                                # Git ignore rules
├── README.md                                 # This file
└── start_project.bat                         # Windows startup script

```

### Repository Structure Overview

The project is organized into three distinct domains: backend, frontend, and machine learning. Each domain corresponds to the 3 main layers of the application.

- backend/: Contains the FastAPI application that serves the fraud detection API. The `app/` directory houses the core application logic, `models/` stores serialized ML models, and `tests/` contains the test suite.
- frontend/: A React TypeScript single-page application providing an interactive interface for fraud detection. Built with Vite for fast development and optimized production builds.
- ml_pipeline/: Houses all machine learning development work. The `data/` directory contains training datasets, and `notebooks/` contains the two primary Jupyter notebooks that implement the complete ML pipeline.

## Local Setup and Installation

Follow these instructions to configure the environment and start the application locally.

### Prerequisites

1. **Node.js** (version 18.0 or higher) and **npm** (Node Package Manager). You can download them from the official Node.js website.

2. **Python** (version 3.10 or higher). You can download it from the official Python website. Check the box that says "Add Python to PATH" during installation.

### Step 1: Install Backend Dependencies

Navigate to the `backend` directory and install the required Python packages.

```bash
cd backend
pip install -r requirements.txt
cd ..

```

### Step 2: Install Frontend Dependencies

Navigate to the `frontend` directory and install the Node modules.

```bash
cd frontend
npm install
cd ..

```

### Step 3: Configure Machine Learning Data

To execute the Jupyter Notebooks and download the raw data to train the models locally, you must provide Kaggle API credentials.

1. Create an account on Kaggle and generate an API token (this will give you a username and a key).
2. Create a new file named exactly `.env`.
3. **CRITICAL DETAIL**: You must place this `.env` file in the exact same directory as the primary notebook: `ml_pipeline/notebooks/.env`.
4. Open the `.env` file and insert your credentials:

```env
KAGGLE_USERNAME="your_actual_username"
KAGGLE_KEY="your_actual_api_key"

```

Once placed correctly, you can open and run `01_primary_analysis.ipynb` and `02_continuous_learning.ipynb` to download the datasets and serialize the models into the `backend/models/` directory.

Once placed correctly, you can open and run `01_primary_analysis.ipynb` to download the Kaggle dataset and initiate secure data ingestion and generate the foundational .pkl and .json model files in backend/models/. Run `02_continuous_learning.ipynb` to process the sequential datasets in ml_pipeline/data/ and generate the \_v2 artifacts.

### Step 4: Start the Application

**Method A: Automated Startup (Windows Only)**
Run the batch script from the root directory to start both servers concurrently:

```cmd
start_project.bat

```

**Method B: Manual Startup**
Open two separate terminal instances from the root directory.

**Terminal 1 (Backend API):**

```bash
cd backend
uvicorn app.main:app --reload

```

The API is now active at `http://localhost:8000`.

**Terminal 2 (Frontend UI):**

```bash
cd frontend
npm run dev

```

The dashboard is now active at `http://localhost:8080`.

## Acknowledgments

This project builds upon the synthetic data generation tools and foundational research published by PhD. Edgar Lopez-Rojas. We extend our gratitude for his contributions to the fraud detection community.

Our group utilized his original Kaggle dataset for the primary data analysis and deployed his open-source PaySim simulator to generate the five distinct datasets required for the continuous learning implementation.

- **Kaggle Dataset Link:** [Synthetic Financial Datasets For Fraud Detection](https://www.kaggle.com/datasets/ealaxi/paysim1/data)
- **GitHub Repo Link:** [PaySim Simulator Repository](https://github.com/EdgarLopezPhD/PaySim/tree/master)
