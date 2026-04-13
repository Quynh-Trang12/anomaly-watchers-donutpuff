import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Tabs } from "@/components/ui/tabs";
import {
  getAuditLogs,
  getAllTransactionsAdmin,
  updateTransactionStatus,
  TransactionRecord,
  AuditLogEntry,
} from "@/api";
import { toast } from "sonner";
import { useAuth, MOCK_USERS } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

export default function Admin() {
  const { isAdmin, userId } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configData, transData, logsData] = await Promise.all([
        getAllTransactionsAdmin(userId || "admin_1"),
        getAuditLogs(),
      ]);
      setTransactions(transData);
      setAuditLogs(logsData);
    } catch (error) {
      toast.error("Failed to synchronize administrative data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <Layout>
      <div className="container py-12 max-w-7xl">
        <Tabs defaultValue="config" className="space-y-8"></Tabs>
      </div>
    </Layout>
  );
}
