import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { getUserTransactions, TransactionRecord } from "@/api";
import { useAuth, MOCK_USERS } from "@/context/AuthContext";
import { 
  History as HistoryIcon, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft,
  SearchX,
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertTriangle,
  User
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrencyToUSD } from "@/lib/utils";
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function History() {
  const { userId } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(userId);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getUserTransactions(selectedAccountId, selectedAccountId);
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId, userId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      // Filter by Status
      if (statusFilter !== "ALL" && transaction.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [transactions, statusFilter]);

  return (
    <Layout>
      <div className="container py-8 max-w-5xl">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <HistoryIcon className="h-8 w-8 text-primary" />
              Activity Log
            </h1>
            <p className="text-muted-foreground mt-1">Review transaction history and status snapshots.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* DEMO CONVENIENCE: Account switcher is visible to everyone in the activity log */}
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-full sm:w-64 rounded-xl h-10">
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Choose account..." />
              </SelectTrigger>
              <SelectContent>
                {MOCK_USERS.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-xl h-10">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-20 text-center bg-card border border-dashed rounded-3xl">
            <SearchX className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">No transactions found</h3>
            <p className="text-muted-foreground">Your recent activity will appear here once you make a transfer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredTransactions.slice().reverse().map(t => {
              const isIncoming = t.destination_account_id === selectedAccountId || t.type === 'CASH_IN';
              
              return (
              <div key={t.transaction_id} className="bg-card border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className={`p-3 rounded-xl ${
                    isIncoming ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}>
                    {isIncoming ? <ArrowDownLeft className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{t.type.replace(/_/g, ' ')}</h4>
                    <p className="text-sm text-muted-foreground font-mono">{t.transaction_id}</p>
                  </div>
                </div>

                <div className="text-center md:text-left">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    t.status === 'APPROVED' ? 'bg-success-muted text-success' :
                    t.status === 'BLOCKED' ? 'bg-danger-muted text-danger' :
                    t.status === 'CANCELLED' ? 'bg-muted text-muted-foreground' :
                    'bg-warning-muted text-warning'
                  }`}>
                    {t.status === 'CANCELLED' ? 'Cancelled by user' : t.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-right w-full md:w-auto">
                  <h3 className={`text-xl font-black ${
                    isIncoming ? 'text-success' : 'text-foreground'
                  }`}>
                    {isIncoming ? '+' : '-'}{formatCurrencyToUSD(t.amount)}
                  </h3>
                  <p className="text-xs text-muted-foreground">{new Date(t.timestamp).toLocaleString()}</p>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
