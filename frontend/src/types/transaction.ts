export type TransactionType = "PAYMENT" | "TRANSFER" | "CASH OUT" | "CASH IN" | "DEBIT";

export type Decision = "APPROVE" | "STEP_UP" | "BLOCK" | "APPROVE_AFTER_STEPUP" | "BLOCK_STEPUP_FAILED";

export interface Transaction {
  id: string;
  step: number;
  type: TransactionType;
  amount: number;
  nameOrig: string;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  nameDest: string;
  oldbalanceDest: number;
  newbalanceDest: number;
  isFraud: 0 | 1;
  isFlaggedFraud: 0 | 1;
  riskScore: number;
  decision: Decision;
  reasons: string[];
  createdAt: string;
}

export interface AdminSettings {
  approveThreshold: number;
  blockThreshold: number;
  flagThresholdAmount: number;
  highRiskAmount: number;
  zeroOutMinAmount: number;
  newDestLargeAmount: number;
  blockInsufficientBalance: boolean;
}

export interface AdminAuditLog {
  id: string;
  changedAt: string;
  field: string;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
  actor: string;
}

export interface DestinationBalance {
  [nameDest: string]: number;
}

export interface OriginAccount {
  id: string;
  name: string;
  displayName: string;
  balance: number;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  approveThreshold: 0.35,
  blockThreshold: 0.70,
  flagThresholdAmount: 200000,
  highRiskAmount: 150000,
  zeroOutMinAmount: 10000,
  newDestLargeAmount: 50000,
  blockInsufficientBalance: true,
};

export const TRANSACTION_TYPES: { value: TransactionType; label: string; description: string }[] = [
  { value: "PAYMENT", label: "Payment", description: "Payment to merchant" },
  { value: "TRANSFER", label: "Transfer", description: "Transfer to another customer" },
  { value: "CASH OUT", label: "Cash Out", description: "Withdraw cash via agent" },
  { value: "CASH IN", label: "Cash In", description: "Deposit cash via agent" },
  { value: "DEBIT", label: "Debit", description: "Bank fee or debit" },
];

export const DEFAULT_ORIGIN_ACCOUNTS: OriginAccount[] = [
  { id: "C1234567890", name: "C1234567890", displayName: "Primary Checking", balance: 50000 },
  { id: "C2345678901", name: "C2345678901", displayName: "Business Account", balance: 150000 },
  { id: "C3456789012", name: "C3456789012", displayName: "Premium Savings", balance: 500000 },
  { id: "C4567890123", name: "C4567890123", displayName: "Personal Savings", balance: 25000 },
  { id: "C5678901234", name: "C5678901234", displayName: "New Account", balance: 0 },
];
