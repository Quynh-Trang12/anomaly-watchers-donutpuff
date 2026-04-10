import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionStatus =
  | "APPROVED"
  | "BLOCKED"
  | "PENDING_USER_OTP"
  | "CANCELLED";

export interface RiskFactor {
  factor:   string;
  severity: "info" | "warning" | "danger";
}

export interface TransactionInput {
  type:                   string;
  amount:                 number;
  oldbalanceOrg:          number;
  newbalanceOrig:         number;
  oldbalanceDest:         number;
  newbalanceDest:         number;
  user_id:                string;
  destination_account_id: string;
  step:                   number;
}

export interface PredictionOutput {
  probability:    number;
  is_fraud:       boolean;
  risk_level:     "Low" | "Medium" | "High";
  status:         TransactionStatus;
  explanation?:   string;
  risk_factors:   RiskFactor[];
  transaction_id: string;
}

export interface TransactionRecord {
  transaction_id:          string;
  owner_user_id:           string;
  destination_account_id?: string;
  amount:                  number;
  type:                    string;
  status:                  TransactionStatus;
  probability_score:       number;
  timestamp:               string;
  risk_factors:            RiskFactor[];
}

export interface BusinessRules {
  restricted_flagged_status: boolean;
}

export interface ConfigurationResponse {
  ml_thresholds:  Record<string, number>;
  business_rules: BusinessRules;
}

export interface HealthResponse {
  status:        string;
  models_loaded: string[];
  feature_count: number;
}

export interface AuditLogEntry {
  log_id:      string;
  timestamp:   string;
  action_type: string;
  admin_id:    string;
  details:     string;
}

export interface FrozenAccountEntry {
  user_id:   string;
  frozen_at: string;
  reason:    string;
}

export interface FreezeConfig {
  max_failed_otp_attempts:    number;
  observation_window_minutes: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const predictPrimary = async (
  data: TransactionInput
): Promise<PredictionOutput> => {
  const res = await axios.post(`${API_BASE_URL}/predict/primary`, data);
  return res.data;
};

export const verifyOTP = async (
  transactionId: string,
  otp: string
): Promise<{ status: string; message: string; transaction_id: string }> => {
  const res = await axios.post(
    `${API_BASE_URL}/verify-otp?transaction_id=${transactionId}&user_provided_otp=${otp}`
  );
  return res.data;
};

export const cancelTransactionOTP = async (
  transactionId: string
): Promise<{ status: string; message: string }> => {
  const res = await axios.post(
    `${API_BASE_URL}/verify-otp/cancel?transaction_id=${transactionId}`
  );
  return res.data;
};

export const getConfiguration = async (): Promise<ConfigurationResponse> => {
  const res = await axios.get(`${API_BASE_URL}/configuration`);
  return res.data;
};

export const updateConfiguration = async (
  data: BusinessRules
): Promise<{ status: string; message: string }> => {
  const res = await axios.put(`${API_BASE_URL}/configuration`, data);
  return res.data;
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
  const res = await axios.get(`${API_BASE_URL}/admin/audit_log`);
  return res.data;
};

export const getAllTransactionsAdmin = async (
  requestingUserId: string
): Promise<TransactionRecord[]> => {
  const res = await axios.get(
    `${API_BASE_URL}/admin/transactions?requesting_user_id=${requestingUserId}`
  );
  return res.data;
};

export const getUserTransactions = async (
  userId: string,
  requestingUserId: string
): Promise<TransactionRecord[]> => {
  const res = await axios.get(
    `${API_BASE_URL}/transactions/${userId}?requesting_user_id=${requestingUserId}`
  );
  return res.data;
};

export const updateTransactionStatus = async (
  transactionId: string,
  action: "approve" | "block",
  adminId: string = "admin_1"
): Promise<{ status: string; transaction_id: string; new_status: string }> => {
  const res = await axios.post(
    `${API_BASE_URL}/transactions/${transactionId}/action?action=${action}&admin_id=${adminId}`
  );
  return res.data;
};

export const getTransactionStatus = async (id: string): Promise<TransactionRecord> => {
  const res = await axios.get(`${API_BASE_URL}/transactions/status/${id}`);
  return res.data;
};

export const healthCheck = async (): Promise<HealthResponse> => {
  const res = await axios.get(`${API_BASE_URL}/health`);
  return res.data;
};

export const getUserBalance = async (
  userId: string
): Promise<{ user_id: string; balance: number }> => {
  const res = await axios.get(`${API_BASE_URL}/users/${userId}/balance`);
  return res.data;
};

export const getActiveThresholds = async (): Promise<{
  block_threshold: number;
  step_up_threshold: number;
}> => {
  const res = await axios.get(`${API_BASE_URL}/configuration/thresholds`);
  return res.data;
};

export const notifyAdminQueueOverflow = async (
  queue_size: number
): Promise<void> => {
  await axios.post(`${API_BASE_URL}/admin/notify/queue_overflow`, { queue_size });
};

export const getFrozenAccounts = async (): Promise<FrozenAccountEntry[]> => {
  const res = await axios.get(`${API_BASE_URL}/admin/frozen-accounts`);
  return res.data;
};

export const unfreezeAccount = async (
  userId: string,
  adminId: string = "admin_1"
): Promise<{ status: string; message: string }> => {
  const res = await axios.post(
    `${API_BASE_URL}/admin/unfreeze/${userId}?admin_id=${adminId}`
  );
  return res.data;
};

export const getFreezeConfig = async (): Promise<FreezeConfig> => {
  const res = await axios.get(`${API_BASE_URL}/admin/freeze-config`);
  return res.data;
};

export const updateFreezeConfig = async (
  config: FreezeConfig,
  adminId: string = "admin_1"
): Promise<{ status: string; message: string }> => {
  const res = await axios.put(
    `${API_BASE_URL}/admin/freeze-config?admin_id=${adminId}`,
    config
  );
  return res.data;
};
