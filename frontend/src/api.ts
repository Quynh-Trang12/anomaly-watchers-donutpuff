import axios from "axios";
import { getAuthToken, type AuthUser } from "@/lib/auth";
import { Transaction } from "@/types/transaction";

/**
 * API client for the AnomalyWatchers Fraud Detection backend.
 */
const API_URL = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";

function getAuthConfig() {
  const token = getAuthToken();
  if (!token) return {};

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Auth DTOs
// ---------------------------------------------------------------------------
export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  password: string;
  email: string;
  displayName?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
}

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

export type TransactionUpdatePayload = Partial<
  Pick<
    Transaction,
    | "decision"
    | "status"
    | "reviewState"
    | "isFraud"
    | "riskScore"
    | "reasons"
    | "backendRiskLevel"
    | "backendExplanation"
  >
>;

export interface NotificationResponse {
  sent: boolean;
  provider: "fastapi_mail";
  recipient: string;
  subject: string;
  detail: string;
}

export interface DashboardTimelinePoint {
  date: string;
  count: number;
}

export interface DashboardRecentTransaction {
  id: string;
  type: string;
  amount: number;
  riskScore: number;
  decision: string;
  status?: string | null;
  createdAt: string;
  ownerId: string;
  ownerUsername: string;
}

export interface DashboardResponse {
  total_transactions: number;
  approved_count: number;
  blocked_count: number;
  under_review_count: number;
  average_risk_score: number;
  type_distribution: Record<string, number>;
  timeline: DashboardTimelinePoint[];
  recent_transactions: DashboardRecentTransaction[];
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
  models_used?: string[];
  model_scores?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
export const login = async (payload: LoginRequest): Promise<LoginResponse> => {
  const response = await axios.post(`${API_URL}/auth/login`, payload);
  return response.data;
};

export const signup = async (payload: SignupRequest): Promise<LoginResponse> => {
  const response = await axios.post(`${API_URL}/auth/signup`, payload);
  return response.data;
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const response = await axios.get(`${API_URL}/auth/me`, getAuthConfig());
  return response.data;
};

// ---------------------------------------------------------------------------
// Transaction API
// ---------------------------------------------------------------------------
export const createTransaction = async (
  payload: Transaction,
): Promise<Transaction> => {
  const response = await axios.post(
    `${API_URL}/transactions`,
    payload,
    getAuthConfig(),
  );
  return response.data;
};

export const fetchMyTransactions = async (): Promise<Transaction[]> => {
  const response = await axios.get(`${API_URL}/transactions/me`, getAuthConfig());
  return response.data;
};

export const fetchAllTransactions = async (): Promise<Transaction[]> => {
  const response = await axios.get(
    `${API_URL}/transactions/all`,
    getAuthConfig(),
  );
  return response.data;
};

export const fetchMyDashboard = async (): Promise<DashboardResponse> => {
  const response = await axios.get(`${API_URL}/dashboard/me`, getAuthConfig());
  return response.data;
};

export const fetchAdminDashboard = async (): Promise<DashboardResponse> => {
  const response = await axios.get(`${API_URL}/dashboard/admin`, getAuthConfig());
  return response.data;
};

export const patchTransaction = async (
  transactionId: string,
  updates: TransactionUpdatePayload,
): Promise<Transaction> => {
  const response = await axios.patch(
    `${API_URL}/transactions/${transactionId}`,
    updates,
    getAuthConfig(),
  );
  return response.data;
};

export const sendUserConfirmationEmail = async (payload: {
  amount: number;
  transaction_type: string;
  recipient_account: string;
}): Promise<NotificationResponse> => {
  const response = await axios.post(
    `${API_URL}/notifications/user-confirmation`,
    payload,
    getAuthConfig(),
  );
  return response.data;
};

export const sendUserOtpEmail = async (payload: {
  otp_code: string;
  amount: number;
  transaction_type: string;
}): Promise<NotificationResponse> => {
  const response = await axios.post(
    `${API_URL}/notifications/user-otp`,
    payload,
    getAuthConfig(),
  );
  return response.data;
};

export const sendAdminReviewNotification = async (): Promise<NotificationResponse> => {
  const response = await axios.post(
    `${API_URL}/notifications/admin-review`,
    {},
    getAuthConfig(),
  );
  return response.data;
};

// ---------------------------------------------------------------------------
// Model API
// ---------------------------------------------------------------------------
export const predictPrimary = async (
  data: TransactionInput,
): Promise<PredictionOutput> => {
  const response = await axios.post(`${API_URL}/predict/primary`, data);
  return response.data;
};

export const predictSecondary = async (
  _data: CreditCardInput,
): Promise<PredictionOutput> => {
  throw new Error(
    "Secondary model endpoint is not deployed in this build. Use the primary Random Forest flow.",
  );
};

export const healthCheck = async (): Promise<{
  status: string;
  models_loaded: string[];
  feature_count?: number;
}> => {
  const response = await axios.get(`${API_URL}/health`, { timeout: 4000 });
  return response.data;
};
