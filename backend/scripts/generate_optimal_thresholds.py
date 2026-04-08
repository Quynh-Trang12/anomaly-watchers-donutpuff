import sys
import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import precision_recall_curve

# Add the parent directory to sys.path to allow importing from 'app'
# This assumes the script is run from the backend/scripts directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.preprocessing import build_feature_matrix
except ImportError:
    # Fallback for different execution contexts
    sys.path.append(os.path.join(os.getcwd(), "backend"))
    from app.preprocessing import build_feature_matrix

def main():
    # Define paths relative to the root of the project (assuming script is run from project root or backend)
    # We will use paths relative to the backend directory for consistency
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(backend_dir, "trained_models", "model_rf_v2.pkl")
    data_path = os.path.join(os.path.dirname(backend_dir), "ml_pipeline", "data", "additional_dataset_1692201870.csv")
    config_path = os.path.join(backend_dir, "trained_models", "model_configuration.json")

    print(f"Loading model from {model_path}...")
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        return
    model = joblib.load(model_path)

    print(f"Loading validation data from {data_path}...")
    if not os.path.exists(data_path):
        print(f"Error: Dataset not found at {data_path}")
        return
    
    # Load a substantial subset for meaningful metric calculation
    df_raw = pd.read_csv(data_path, nrows=200000)

    print("Preprocessing data...")
    df_processed = build_feature_matrix(df_raw)
    
    X = df_processed.drop(columns=["is_fraud"])
    y = df_processed["is_fraud"]

    print("Generating probability scores...")
    # Get probabilities for the positive class (fraud)
    probabilities = model.predict_proba(X)[:, 1]

    print("Calculating optimal thresholds...")
    precision, recall, thresholds = precision_recall_curve(y, probabilities)
    
    # 1. Maximize F1-Score for Blocking
    # Avoid division by zero
    f1_scores = 2 * (precision * recall) / (precision + recall + 1e-10)
    best_f1_index = np.argmax(f1_scores)
    # thresholds has len(precision) - 1
    if best_f1_index < len(thresholds):
        block_threshold = float(thresholds[best_f1_index])
    else:
        block_threshold = float(thresholds[-1])

    # 2. Maximize Recall at 90% Precision for Step-Up Verification
    # We want the lowest threshold where precision is >= 0.90
    precision_90_indices = np.where(precision >= 0.90)[0]
    if len(precision_90_indices) > 0:
        idx = precision_90_indices[0]
        if idx < len(thresholds):
            step_up_threshold = float(thresholds[idx])
        else:
            step_up_threshold = float(thresholds[-1])
    else:
        # Fallback if 90% precision is never reached
        step_up_threshold = float(block_threshold * 0.5)

    # Hard engineering constraints: step_up must be <= block
    step_up_threshold = min(step_up_threshold, block_threshold)

    configuration = {
        "model_metadata": {
            "model_version": "2.0.0",
            "optimization_date": "2026-04-08",
            "validation_sample_size": 200000
        },
        "ml_thresholds": {
            "block_threshold": block_threshold,
            "step_up_threshold": step_up_threshold
        },
        "business_rules": {
            "large_transfer_limit_amount": 150000.0,
            "daily_velocity_limit": 500000.0,
            "restricted_flagged_status": True
        }
    }

    print(f"Optimal Block Threshold: {block_threshold:.4f}")
    print(f"Optimal Step-Up Threshold: {step_up_threshold:.4f}")
    
    with open(config_path, "w") as f:
        json.dump(configuration, f, indent=4)
        
    print(f"Configuration written to {config_path}")

if __name__ == "__main__":
    main()
