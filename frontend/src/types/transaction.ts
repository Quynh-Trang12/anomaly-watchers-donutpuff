export type TransactionType = "PAYMENT" | "TRANSFER" | "CASH OUT" | "CASH IN" | "DEBIT";

export const TRANSACTION_TYPES: { value: TransactionType; label: string; description: string }[] = [
  { value: "PAYMENT", label: "Payment", description: "Payment to merchant" },
  { value: "TRANSFER", label: "Transfer", description: "Transfer to another customer" },
  { value: "CASH OUT", label: "Cash Out", description: "Withdraw cash via agent" },
  { value: "CASH IN", label: "Cash In", description: "Deposit cash via agent" },
  { value: "DEBIT", label: "Debit", description: "Bank fee or debit" },
];

export interface Transaction {
  step: number;
  type: string;
  amount: number;
  nameOrig: string;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  nameDest: string;
  oldbalanceDest: number;
  newbalanceDest: number;
  isFraud: number;
  isFlaggedFraud: number;
  riskScore: number;
  decision: "APPROVED" | "BLOCKED" | "PENDING_USER_OTP" | "CANCELLED";
  createdAt: string;
}
