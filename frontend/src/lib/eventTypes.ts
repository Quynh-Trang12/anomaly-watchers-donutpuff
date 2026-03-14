import { TransactionType } from "@/types/transaction";

// Maps internal Kaggle values to user-friendly "Event" labels for the Analyst Workbench
export const EVENT_TYPE_LABELS: Record<TransactionType, string> = {
  "CASH IN": "ATM Deposit",
  "CASH OUT": "ATM Withdrawal",
  PAYMENT: "Merchant Purchase",
  DEBIT: "Direct Debit / Auto-Pay",
  TRANSFER: "P2P / Wire Transfer",
};

export function getEventTypeLabel(type: TransactionType): string {
  return EVENT_TYPE_LABELS[type] || type;
}

// Helper to calculate time context from step (1 step = 1 hour)
export function getTimeContext(step: number): { day: number; hour: number; formatted: string; period: string } {
  const day = Math.floor((step - 1) / 24) + 1;
  const hour = ((step - 1) % 24);
  
  const hourFormatted = hour.toString().padStart(2, '0');
  const period = hour >= 6 && hour < 18 ? 'Day' : 'Night';
  
  return {
    day,
    hour,
    formatted: `Day ${day}, ${hourFormatted}:00`,
    period,
  };
}

// Format currency with $ symbol
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
