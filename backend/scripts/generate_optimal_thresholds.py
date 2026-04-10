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
    
    # ─────────────────────────────────────────────────────────────────────────────
    # THRESHOLD 1: Block Threshold (Maximizes F1-Score on PR Curve)
    # ─────────────────────────────────────────────────────────────────────────────
    # The F1-Score is the harmonic mean of Precision and Recall:
    #     F1 = 2 × (Precision × Recall) / (Precision + Recall)
    # We select the probability threshold where F1 is maximized on the validation
    # set. This gives the best balance between catching fraud (recall) and not
    # falsely blocking legitimate transactions (precision).
    f1_scores = 2 * (precision * recall) / (precision + recall + 1e-10)
    best_f1_index = np.argmax(f1_scores)
    # thresholds has len(precision) - 1
    if best_f1_index < len(thresholds):
        block_threshold = float(thresholds[best_f1_index])
    else:
        block_threshold = float(thresholds[-1])
    
    # ─────────────────────────────────────────────────────────────────────────────
    # THRESHOLD 2: Step-Up Threshold (Maximizes Recall at 90% Precision)
    # ─────────────────────────────────────────────────────────────────────────────
    # We want to catch as many suspicious transactions as possible (high recall)
    # while ensuring that when we ask users for extra verification, we are right
    # at least 90% of the time (precision ≥ 90%). This minimizes user friction
    # while maintaining security coverage for the majority of genuine fraud.
    indices_meeting_precision_target = np.where(precision >= 0.90)[0]
    if len(indices_meeting_precision_target) > 0:
        earliest_qualifying_index = indices_meeting_precision_target[0]
        step_up_threshold = float(thresholds[min(earliest_qualifying_index, len(thresholds) - 1)])
    else:
        # Fallback: use half the block threshold if 90% precision is never achieved
        step_up_threshold = float(block_threshold * 0.5)
        print(f"Warning: 90% precision target not achievable. Using fallback: {step_up_threshold:.4f}")

    # Architectural constraint: step_up must always be strictly less than block
    step_up_threshold = min(step_up_threshold, block_threshold * 0.99)
    
    print(f"Optimal Thresholds Derived — Block: {block_threshold:.4f}, Step-Up: {step_up_threshold:.4f}")
    
    # Save results
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
