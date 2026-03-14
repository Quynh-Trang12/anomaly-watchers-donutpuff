import {
  Transaction,
  AdminSettings,
  AdminAuditLog,
  DestinationBalance,
  OriginAccount,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_ORIGIN_ACCOUNTS,
} from "@/types/transaction";

const STORAGE_KEYS = {
  TRANSACTIONS: "fraud_sim_transactions",
  ADMIN_SETTINGS: "fraud_sim_admin_settings",
  ADMIN_AUDIT_LOG: "fraud_sim_audit_log",
  DESTINATION_BALANCES: "fraud_sim_dest_balances",
  ORIGIN_ACCOUNTS: "fraud_sim_origin_accounts",
  LAST_STEP: "fraud_sim_last_step",
  PENDING_TRANSACTION: "fraud_sim_pending_transaction",
};

// Transactions
export function getTransactions(): Transaction[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveTransaction(transaction: Transaction): void {
  const transactions = getTransactions();
  transactions.push(transaction);
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

export function updateTransaction(
  id: string,
  updates: Partial<Transaction>,
): void {
  const transactions = getTransactions();
  const index = transactions.findIndex((t) => t.id === id);
  if (index !== -1) {
    transactions[index] = { ...transactions[index], ...updates };
    localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(transactions),
    );
  }
}

export function getTransactionById(id: string): Transaction | undefined {
  return getTransactions().find((t) => t.id === id);
}

// Admin Settings
export function getAdminSettings(): AdminSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ADMIN_SETTINGS);
    return data
      ? { ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(data) }
      : DEFAULT_ADMIN_SETTINGS;
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function saveAdminSettings(settings: AdminSettings): void {
  localStorage.setItem(STORAGE_KEYS.ADMIN_SETTINGS, JSON.stringify(settings));
}

// Admin Audit Log
export function getAdminAuditLog(): AdminAuditLog[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ADMIN_AUDIT_LOG);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addAuditLogEntry(
  entry: Omit<AdminAuditLog, "id" | "changedAt">,
): void {
  const log = getAdminAuditLog();
  log.push({
    ...entry,
    id: crypto.randomUUID(),
    changedAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEYS.ADMIN_AUDIT_LOG, JSON.stringify(log));
}

// Destination Balances
export function getDestinationBalances(): DestinationBalance {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DESTINATION_BALANCES);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function updateDestinationBalance(
  nameDest: string,
  balance: number,
): void {
  const balances = getDestinationBalances();
  balances[nameDest] = balance;
  localStorage.setItem(
    STORAGE_KEYS.DESTINATION_BALANCES,
    JSON.stringify(balances),
  );
}

export function getOriginAccounts(): OriginAccount[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ORIGIN_ACCOUNTS);
    if (!data) return DEFAULT_ORIGIN_ACCOUNTS;

    const storedAccounts = JSON.parse(data) as OriginAccount[];

    // Merge with defaults to ensure displayName exists (migration for old data)
    return storedAccounts.map((account) => {
      const defaultAccount = DEFAULT_ORIGIN_ACCOUNTS.find(
        (d) => d.id === account.id,
      );
      return {
        ...account,
        displayName:
          account.displayName || defaultAccount?.displayName || account.name,
        name: account.name || defaultAccount?.name || account.id,
      };
    });
  } catch {
    return DEFAULT_ORIGIN_ACCOUNTS;
  }
}

export function updateOriginAccount(id: string, balance: number): void {
  const accounts = getOriginAccounts();
  const index = accounts.findIndex((a) => a.id === id);
  if (index !== -1) {
    accounts[index].balance = balance;
    localStorage.setItem(
      STORAGE_KEYS.ORIGIN_ACCOUNTS,
      JSON.stringify(accounts),
    );
  }
}

// Last Step
export function getLastStep(): number {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LAST_STEP);
    return data ? parseInt(data, 10) : 0;
  } catch {
    return 0;
  }
}

export function setLastStep(step: number): void {
  localStorage.setItem(STORAGE_KEYS.LAST_STEP, step.toString());
}

// Pending Transaction (for result page)
export function setPendingTransaction(transaction: Transaction): void {
  localStorage.setItem(
    STORAGE_KEYS.PENDING_TRANSACTION,
    JSON.stringify(transaction),
  );
}

export function getPendingTransaction(): Transaction | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PENDING_TRANSACTION);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearPendingTransaction(): void {
  localStorage.removeItem(STORAGE_KEYS.PENDING_TRANSACTION);
}

// Export data
export function exportTransactions(format: "json" | "csv"): string {
  const transactions = getTransactions();

  if (format === "json") {
    return JSON.stringify(transactions, null, 2);
  }

  // CSV format
  if (transactions.length === 0) return "";

  const headers = [
    "step",
    "type",
    "amount",
    "nameOrig",
    "oldbalanceOrg",
    "newbalanceOrig",
    "nameDest",
    "oldbalanceDest",
    "newbalanceDest",
    "isFraud",
    "isFlaggedFraud",
    "riskScore",
    "decision",
    "reasons",
    "createdAt",
  ];

  const rows = transactions.map((t) =>
    [
      t.step,
      t.type,
      t.amount,
      t.nameOrig,
      t.oldbalanceOrg,
      t.newbalanceOrig,
      t.nameDest,
      t.oldbalanceDest,
      t.newbalanceDest,
      t.isFraud,
      t.isFlaggedFraud,
      t.riskScore.toFixed(4),
      t.decision,
      `"${t.reasons.join("; ")}"`,
      t.createdAt,
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}
