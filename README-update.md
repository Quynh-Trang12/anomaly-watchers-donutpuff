# AnomalyWatchers: Fraud Detection Pipeline and Dashboard

## Project Overview

This project focuses on the data engineering and machine learning pipeline for fraud detection.

The current implementation includes:

- Data preprocessing and feature engineering
- Model training and evaluation
- Continuous learning simulation (prequential evaluation)

The frontend interface and full system integration will be developed in Assignment 3.

## Architecture

| Layer                | Technology                                      | Purpose                                                                  |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **Machine Learning** | Python, scikit-learn, XGBoost, imbalanced-learn | Four-model architecture with GridSearchCV and SMOTE oversampling.        |
| **Prequential Loop** | Pandas, joblib, sklearn.linear_model            | Prequential evaluation (test-then-train) pipeline for Big Data streams.  |
| **Backend API**      | FastAPI, Pydantic, Uvicorn                      | Asynchronous inference endpoints with deterministic feature engineering. |
| **Frontend UI**      | React, Vite, TypeScript, Tailwind CSS           | Real-time monitoring dashboard and interactive transaction simulator.    |


## Repository Structure

```text
anomaly-watchers-donutpuff/
├── backend/                                  # FastAPI application domain
│   ├── app/                                  # Core application logic
│   │   ├── __init__.py                       # Marks ./backend/app as a Python package
│   │   ├── main.py                           # Application entry point, API routes, and heuristic engine
│   │   └── preprocessing.py                  # Shared ETL pipeline logic (build_feature_matrix)
│   │
│   ├── trained_models/                       # Serialized ML models and artifacts with v2 for updated models (Prequential Evaluation)
│   │   ├── feature_columns.pkl               # Pickled list of exact column names for schema alignment
│   │   ├── model_rf.pkl                      # Random Forest model pipeline
│   │   ├── model_rf_v2.pkl
│   │   ├── model_xgboost.pkl                 # XGBoost model pipeline
│   │   ├── model_xgboost_v2.pkl
│   │   └── archive/                          # Previous trained models
│   │       ├── model_xgboost_v1.pkl
│   │       ├── model_logistic_regression_v1.pkl
│   │       └── ...*.pkl
│   │
│   ├── tests/                                # Backend test suite
│   │   └── __init__.py                       # Marks ./backend/tests as a Python test package
│   │
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

## Model Training

The models are trained using Jupyter Notebooks located in:

``` ml_pipeline/notebooks/ ```

### Step 1: Run Primary Training

Open and execute: 
`` 01_primary_analysis.ipynb``

This notebook: 
- Downloads the dataset
- Performs data cleaning and preprocessing
- Applies feature engineering
- Trains 4 models: Logistic Regression, Random Forest, XGBoost, Isolation Forest
- Evaluates performance using F1-score and AUPRC

### Step 2: Run Continuous Learning Pipeline
`` 02_continuous_learning.ipynb``

This notebook:
- Simulates real-world streaming data
- Applies prequential evaluation (test-then-train)
- Updates models incrementally

## Output
Trained models are saved in: 
``backend/trained_models/

Example files:

`model_rf.pkl` → Random Forest

`model_xgboost.pkl` → XGBoost

`feature_columns.pkl` → Feature schema

## Model Evaluation
Due to extreme class imbalance (~0.13% fraud), traditional accuracy is not used. Instead, we use:
- **F1-score**: balance of precision and recall 
- **AUPRC**: focuses on detecting rare fraud cases

## Model Inference and Evaluation

At this stage, predictions are generated within the machine learning notebooks during model evaluation and continuous learning experiments, rather than through a deployed API.

The trained models take raw transaction attributes as input, apply the preprocessing and feature engineering pipeline, and then output a fraud classification and evaluation score during notebook execution.

Prediction capability is currently demonstrated through:

- cross-validation results in `01_primary_analysis.ipynb`

- prequential evaluation in 02_continuous_learning.ipynb

A production prediction endpoint and web-based input form will be implemented in Assignment 3.

## Prediction Flow (Current Implementation)
At this stage, predictions are generated within the machine learning pipeline during notebook execution.

1. Raw transaction data is loaded from the dataset  
2. Feature engineering is applied (`build_feature_matrix`)  
3. The trained model generates predictions  
4. Results are evaluated using F1-score and AUPRC  

Note: A real-time prediction API and user interface will be implemented in Assignment 3.

## Continuous Learning (Prequential Evaluation)
The system simulates real-world deployment using a **test-then-train** approach:

- Each data chunk is evaluated before updating the model
- Prevents temporal data leakage
- Reflects real-world fraud detection performance




## Acknowledgments

This project builds upon the synthetic data generation tools and foundational research published by PhD. Edgar Lopez-Rojas. We extend our gratitude for his contributions to the fraud detection community.

Our group utilized his original Kaggle dataset for the primary data analysis and deployed his open-source PaySim simulator to generate the five distinct datasets required for the continuous learning implementation.

- **Kaggle Dataset Link:** [Synthetic Financial Datasets For Fraud Detection](https://www.kaggle.com/datasets/ealaxi/paysim1/data)
- **GitHub Repo Link:** [PaySim Simulator Repository](https://github.com/EdgarLopezPhD/PaySim/tree/master)
