import { useEffect, useState, useCallback, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { getUserTransactions, getAllTransactionsAdmin, TransactionRecord, RiskFactor } from "@/api";
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
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrencyToUSD } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function History() {
  const { userId, role } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);

  const isAdmin = role === "ADMIN";

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      let data: TransactionRecord[];
      if (isAdmin) {
        data = await getAllTransactionsAdmin("admin_1");
      } else {
        data = await getUserTransactions(userId, userId);
      }
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      // 1. Filter by Status
      if (statusFilter !== "ALL" && transaction.status !== statusFilter) {
        return false;
      }

      // 2. Filter by User (admin only)
      if (isAdmin && userFilter !== "ALL" && transaction.owner_user_id !== userFilter) {
        return false;
      }
      
      // 3. Filter by Search Term
      const search_term_lower = searchTerm.toLowerCase().trim();
      if (!search_term_lower) return true;
      
      return [
        transaction.transaction_id,
        transaction.type,
        transaction.status.replace(/_/g, " "),
        transaction.amount.toFixed(2),
        transaction.owner_user_id,
      ].some((field) => field.toLowerCase().includes(search_term_lower));
    });
  }, [transactions, searchTerm, statusFilter, userFilter, isAdmin]);

  return (
    <Layout>
      <div className="container py-8 max-w-5xl">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <HistoryIcon className="h-8 w-8 text-primary" />
              Activity Log
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin
                ? "Review all user transaction history and security status."
                : "Review your recent transaction history and security status."}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Admin: User Filter */}
            {isAdmin && (
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-full sm:w-[200px] rounded-xl h-10">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Users</SelectItem>
                  {MOCK_USERS.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search history..." 
                className="pl-10 rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-xl h-10">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="PENDING_USER_OTP">Pending Verification</SelectItem>
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
            {filteredTransactions.slice().reverse().map(t => (
              <div
                key={t.transaction_id}
                className="bg-card border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedTransaction(t)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setSelectedTransaction(t); }}
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className={`p-3 rounded-xl ${
                    t.type === 'TRANSFER' || t.type === 'CASH OUT' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                  }`}>
                    {t.type === 'TRANSFER' || t.type === 'CASH OUT' ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownLeft className="h-6 w-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{t.type.replace(/_/g, ' ')}</h4>
                    <p className="text-sm text-muted-foreground font-mono">{t.transaction_id}</p>
                    {/* Show owner for admin */}
                    {isAdmin && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Owner: <span className="font-semibold">{t.owner_user_id}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-center md:text-left">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    t.status === 'APPROVED' ? 'bg-success-muted text-success' :
                    t.status === 'BLOCKED' ? 'bg-danger-muted text-danger' :
                    'bg-warning-muted text-warning'
                  }`}>
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-right w-full md:w-auto">
                  <h3 className={`text-xl font-black ${
                    t.type === 'TRANSFER' || t.type === 'CASH OUT' ? 'text-foreground' : 'text-success'
                  }`}>
                    {t.type === 'TRANSFER' || t.type === 'CASH OUT' ? '-' : '+'}{formatCurrencyToUSD(t.amount)}
                  </h3>
                  <p className="text-xs text-muted-foreground">{new Date(t.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Transaction Detail Modal ──────────────────────────────────────── */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedTransaction(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Transaction Details"
        >
          <div
            className="bg-card border rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 rounded-full"
              onClick={() => setSelectedTransaction(null)}
              aria-label="Close detail view"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Header */}
            <div className="text-center mb-6">
              {selectedTransaction.status === "APPROVED" ? (
                <div className="inline-flex items-center justify-center p-3 bg-success/10 rounded-full text-success mb-3">
                  <ShieldCheck className="h-10 w-10" />
                </div>
              ) : selectedTransaction.status === "BLOCKED" ? (
                <div className="inline-flex items-center justify-center p-3 bg-danger/10 rounded-full text-danger mb-3">
                  <ShieldAlert className="h-10 w-10" />
                </div>
              ) : (
                <div className="inline-flex items-center justify-center p-3 bg-warning/10 rounded-full text-warning mb-3">
                  <Clock className="h-10 w-10" />
                </div>
              )}
              <h2 className="text-2xl font-black">Transaction Details</h2>
            </div>

            {/* Fields */}
            <div className="space-y-4 mb-6">
              <DetailRow label="Transaction ID" value={<span className="font-mono text-sm">{selectedTransaction.transaction_id}</span>} />
              <DetailRow
                label="Status"
                value={
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    selectedTransaction.status === 'APPROVED' ? 'bg-success-muted text-success' :
                    selectedTransaction.status === 'BLOCKED' ? 'bg-danger-muted text-danger' :
                    'bg-warning-muted text-warning'
                  }`}>
                    {selectedTransaction.status.replace(/_/g, ' ')}
                  </span>
                }
              />
              <DetailRow label="Amount" value={<span className="font-bold">{formatCurrencyToUSD(selectedTransaction.amount)}</span>} />
              <DetailRow label="Transaction Type" value={selectedTransaction.type.replace(/_/g, ' ')} />
              <DetailRow label="Timestamp" value={new Date(selectedTransaction.timestamp).toLocaleString()} />
              {isAdmin && <DetailRow label="Owner" value={selectedTransaction.owner_user_id} />}
              
              {/* Risk Probability Bar */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Risk Probability</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        selectedTransaction.probability_score > 0.7 ? 'bg-danger' :
                        selectedTransaction.probability_score > 0.3 ? 'bg-warning' : 'bg-success'
                      }`}
                      style={{ width: `${selectedTransaction.probability_score * 100}%` }}
                    />
                  </div>
                  <span className="font-bold text-sm">{(selectedTransaction.probability_score * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Risk Level Badge */}
              <DetailRow
                label="Risk Level"
                value={
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    selectedTransaction.probability_score >= 0.5 ? 'bg-danger-muted text-danger' :
                    selectedTransaction.probability_score >= 0.1 ? 'bg-warning-muted text-warning' :
                    'bg-success-muted text-success'
                  }`}>
                    {selectedTransaction.probability_score >= 0.5 ? 'High' :
                     selectedTransaction.probability_score >= 0.1 ? 'Medium' : 'Low'}
                  </span>
                }
              />
            </div>

            {/* Risk Factors */}
            {selectedTransaction.risk_factors && selectedTransaction.risk_factors.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="font-bold flex items-center gap-2 mb-4">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Security Analysis Details
                </h3>
                <div className="space-y-3">
                  {selectedTransaction.risk_factors.map((rf: RiskFactor, idx: number) => (
                    <div key={idx} className={`p-4 rounded-2xl flex gap-4 ${
                      rf.severity === 'danger' ? 'bg-danger/5 border border-danger/10 text-danger' : 
                      rf.severity === 'warning' ? 'bg-warning/5 border border-warning/10 text-warning' : 
                      'bg-muted/50 text-muted-foreground'
                    }`}>
                      <div className="mt-1 shrink-0">
                        {rf.severity === 'danger' ? <XCircle className="h-5 w-5" /> : 
                         rf.severity === 'warning' ? <AlertTriangle className="h-5 w-5" /> : 
                         <CheckCircle2 className="h-5 w-5" />}
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{rf.factor}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close action */}
            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full rounded-2xl h-12"
                onClick={() => setSelectedTransaction(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ─── Helper Component ─────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span>{value}</span>
    </div>
  );
}
