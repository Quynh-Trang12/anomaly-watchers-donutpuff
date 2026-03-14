import axios from "axios";

/**
 * API client for the AnomalyWatchers Fraud Detection backend.
 *
 * The Vite dev server proxies /predict/* to http://localhost:8000,
 * so we use a relative base URL (empty string).
 */

const API_URL = "";

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------
export interface TransactionInput {
  step: number;
  type: string;
  amount: number;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  oldbalanceDest: number;
  newbalanceDest: number;
}

export interface CreditCardInput {
  amt: number;
  lat: number;
  long: number;
  merch_lat: number;
  merch_long: number;
  dob: string;
  city_pop: number;
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------
export interface RiskFactor {
  factor: string;
  severity: "info" | "warning" | "danger";
}

export interface PredictionOutput {
  probability: number;
  is_fraud: boolean;
  risk_level: "Low" | "Medium" | "High";
  explanation?: string;
  risk_factors: RiskFactor[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------
export const predictPrimary = async (
  data: TransactionInput,
): Promise<PredictionOutput> => {
  const response = await axios.post(`${API_URL}/predict/primary`, data);
  return response.data;
};

export const predictSecondary = async (
  data: CreditCardInput,
): Promise<PredictionOutput> => {
  const response = await axios.post(`${API_URL}/predict/secondary`, data);
  return response.data;
};

export const healthCheck = async (): Promise<{
  status: string;
  models_loaded: string[];
}> => {
  const response = await axios.get(`${API_URL}/`);
  return response.data;
};
