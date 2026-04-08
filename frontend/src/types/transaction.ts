export type TransactionType = "PAYMENT" | "TRANSFER" | "CASH OUT" | "CASH IN" | "DEBIT";

export const TRANSACTION_TYPES: { value: TransactionType; label: string; description: string }[] = [
  { value: "PAYMENT", label: "Payment", description: "Payment to merchant" },
  { value: "TRANSFER", label: "Transfer", description: "Transfer to another customer" },
  { value: "CASH OUT", label: "Cash Out", description: "Withdraw cash via agent" },
  { value: "CASH IN", label: "Cash In", description: "Deposit cash via agent" },
  { value: "DEBIT", label: "Debit", description: "Bank fee or debit" },
];
