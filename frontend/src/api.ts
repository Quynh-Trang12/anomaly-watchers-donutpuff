import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api";

export type TransactionStatus = "APPROVED" | "BLOCKED" | "PENDING_USER_OTP" | "PENDING_ADMIN_REVIEW";

export interface RiskFactor {
  factor: string;
  severity: "info" | "warning" | "danger";
}

export interface TransactionInput {
  type: string;
  amount: number;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  oldbalanceDest: number;
  newbalanceDest: number;
  user_id: string;
}

export interface PredictionOutput {
  probability: number;
  is_fraud: boolean;
  risk_level: "Low" | "Medium" | "High";
  status: TransactionStatus;
  explanation?: string;
  risk_factors: RiskFactor[];
  models_used: string[];
  model_scores: Record<string, number>;
  transaction_id: string;
}

export interface TransactionRecord {
  transaction_id: string;
  owner_user_id: string;
  amount: number;
  type: string;
  status: TransactionStatus;
  probability_score: number;
  timestamp: string;
  risk_factors: RiskFactor[];
}

export interface BusinessRules {
  large_transfer_limit_amount: number;
  daily_velocity_limit: number;
  restricted_flagged_status: boolean;
}

export interface ConfigurationResponse {
  ml_thresholds: Record<string, number>;
  business_rules: BusinessRules;
}

export interface AuditLogEntry {
  log_id: string;
  timestamp: string;
  action_type: string;
  admin_id: string;
  details: string;
}

// API functions
export const predictPrimary = async (data: TransactionInput): Promise<PredictionOutput> => {
  const response = await axios.post(`${API_BASE_URL}/predict/primary`, data);
  return response.data;
};

export const getConfiguration = async (): Promise<ConfigurationResponse> => {
  const response = await axios.get(`${API_BASE_URL}/configuration`);
  return response.data;
};

export const updateConfiguration = async (data: BusinessRules): Promise<any> => {
  const response = await axios.put(`${API_BASE_URL}/configuration`, data);
  return response.data;
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
  const response = await axios.get(`${API_BASE_URL}/admin/audit_log`);
  return response.data;
};

export const getAllTransactionsAdmin = async (): Promise<TransactionRecord[]> => {
  const response = await axios.get(`${API_BASE_URL}/admin/transactions`);
  return response.data;
};

export const getUserTransactions = async (userId: string): Promise<TransactionRecord[]> => {
  const response = await axios.get(`${API_BASE_URL}/transactions/${userId}`);
  return response.data;
};

export const updateTransactionStatus = async (transactionId: string, action: "approve" | "block", adminId: string = "admin_1"): Promise<any> => {
  const response = await axios.post(`${API_BASE_URL}/transactions/${transactionId}/action?action=${action}&admin_id=${adminId}`);
  return response.data;
};

export const healthCheck = async () => {
  const response = await axios.get(`${API_BASE_URL}/health`);
  return response.data;
};
