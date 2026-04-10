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
  FileText,
  Calendar,
  User,
  ExternalLink
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
import { motion, AnimatePresence } from "framer-motion";

export default function History() {
  const { userId, role } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  const isAdmin = role === "ADMIN";

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = isAdmin
        ? await getAllTransactionsAdmin(userId || "admin_1")
        : await getUserTransactions(userId, userId);
      setTransactions(data);
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // Per USER request: Only show final outcomes (APPROVED, BLOCKED, CANCELLED)
      if (t.status === "PENDING_USER_OTP") return false;

      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (isAdmin && userFilter !== "ALL" && t.owner_user_id !== userFilter) return false;
      
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      
      return [t.transaction_id, t.type, t.owner_user_id, t.amount.toString()]
        .some(f => f.toLowerCase().includes(term));
    }).reverse();
  }, [transactions, searchTerm, statusFilter, userFilter, isAdmin]);

  return (
    <Layout>
      <div className="container py-12 max-w-6xl">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-4">
              <FileText className="h-3 w-3" /> Ledger Audit Trail
            </div>
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <HistoryIcon className="h-10 w-10 text-primary" />
              Activity Log
            </h1>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {isAdmin && (
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-12 rounded-xl font-bold bg-muted/30">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Customers</SelectItem>
                  {MOCK_USERS.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search Reference ID..." 
                className="pl-11 h-12 rounded-xl font-bold bg-muted/30"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-12 rounded-xl font-bold">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Outcomes</SelectItem>
                <SelectItem value="APPROVED">APPROVED</SelectItem>
                <SelectItem value="BLOCKED">BLOCKED</SelectItem>
                <SelectItem value="CANCELLED">CANCELLED</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-card border animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center bg-card border-2 border-dashed rounded-[2.5rem] mt-4">
            <SearchX className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-10" />
            <h3 className="text-2xl font-black opacity-40">No records found</h3>
            <p className="text-muted-foreground font-medium">Refine your search parameters or process new transactions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {filtered.map(t => (
                <motion.div
                  layout
                  key={t.transaction_id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.005 }}
                  className="bg-card border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-xl transition-all cursor-pointer group"
                  onClick={() => setSelectedTx(t)}
                >
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors ${
                      t.type.includes('TRANSFER') || t.type.includes('OUT') ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                    }`}>
                      {t.type.includes('TRANSFER') || t.type.includes('OUT') ? <ArrowUpRight className="h-7 w-7" /> : <ArrowDownLeft className="h-7 w-7" />}
                    </div>
                    <div>
                      <h4 className="font-black text-xl leading-tight group-hover:text-primary transition-colors">{t.type.replace(/_/g, ' ')}</h4>
                      <p className="text-xs text-muted-foreground font-mono font-bold tracking-tight">{t.transaction_id}</p>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] font-black text-primary/70 uppercase">
                          <User className="h-3 w-3" /> Owner: {t.owner_user_id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center md:items-start">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      t.status === 'APPROVED' ? 'bg-success/10 text-success border border-success/20' :
                      t.status === 'BLOCKED' ? 'bg-danger/10 text-danger border border-danger/20' :
                      t.status === 'CANCELLED' ? 'bg-muted text-muted-foreground border border-muted-foreground/20' :
                      'bg-warning/10 text-warning border border-warning/20'
                    }`}>
                      {t.status === 'PENDING_USER_OTP' ? 'WAITING FOR OTP' : t.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-right w-full md:w-auto">
                    <h3 className={`text-2xl font-black ${
                      t.type.includes('TRANSFER') || t.type.includes('OUT') ? 'text-foreground' : 'text-success'
                    }`}>
                      {t.type.includes('TRANSFER') || t.type.includes('OUT') ? '-' : '+'}{formatCurrencyToUSD(t.amount)}
                    </h3>
                    <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground font-medium mt-1">
                      <Calendar className="h-3 w-3" /> 
                      {new Date(t.timestamp).toLocaleDateString()} at {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ─── Detail Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="bg-card border-2 shadow-2xl rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto relative no-scrollbar"
            >
              <div className="sticky top-0 right-0 p-6 flex justify-end z-10">
                <Button variant="ghost" size="icon" className="rounded-full bg-muted/50" onClick={() => setSelectedTx(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="px-10 pb-10 mt-[-40px]">
                <div className="flex flex-col items-center mb-8">
                  <div className={`p-6 rounded-3xl mb-4 ${
                    selectedTx.status === "APPROVED" ? "bg-success/10 text-success" :
                    selectedTx.status === "BLOCKED" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                  }`}>
                    {selectedTx.status === "APPROVED" ? <ShieldCheck className="h-16 w-16" /> : 
                     selectedTx.status === "BLOCKED" ? <ShieldAlert className="h-16 w-16" /> : <Clock className="h-16 w-16" />}
                  </div>
                  <h2 className="text-3xl font-black text-center">Security Analysis Report</h2>
                  <p className="text-muted-foreground font-bold font-mono text-sm mt-2">{selectedTx.transaction_id}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="p-5 rounded-3xl bg-muted/30 border">
                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Final Amount</p>
                    <p className="text-2xl font-black">{formatCurrencyToUSD(selectedTx.amount)}</p>
                  </div>
                  <div className="p-5 rounded-3xl bg-muted/30 border">
                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">AI Risk Prob.</p>
                    <p className={`text-2xl font-black ${selectedTx.probability_score > 0.5 ? 'text-danger' : 'text-primary'}`}>
                      {(selectedTx.probability_score * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-10 border-t pt-8">
                  <DetailLine label="Ledger Outcome" value={selectedTx.status === 'PENDING_USER_OTP' ? 'WAITING FOR OTP' : selectedTx.status.replace(/_/g, ' ')} highlight />
                  <DetailLine label="Entry Method" value={selectedTx.type.replace(/_/g, ' ')} />
                  <DetailLine label="Originator" value={selectedTx.owner_user_id} />
                  <DetailLine label="Execution Time" value={new Date(selectedTx.timestamp).toLocaleString()} />
                </div>

                <div className="bg-muted/10 border-2 border-dashed rounded-3xl p-6">
                  <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" /> Behavioral Evidence (XAI)
                  </h3>
                  <div className="space-y-4">
                    {selectedTx.risk_factors.map((f, idx) => (
                      <div key={idx} className="flex gap-4 items-start">
                        <div className={`mt-1 h-5 w-5 rounded-full shrink-0 flex items-center justify-center ${
                          f.severity === 'danger' ? 'bg-danger text-white' : 
                          f.severity === 'warning' ? 'bg-warning text-white' : 'bg-primary text-white'
                        }`}>
                          {f.severity === 'danger' ? <X className="h-3 w-3" /> : 
                           f.severity === 'warning' ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <p className="text-sm font-bold text-muted-foreground leading-relaxed">{f.factor}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTx.status === "PENDING_USER_OTP" && (
                  <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                    <p className="text-[11px] font-bold text-warning uppercase leading-tight">
                      This transaction is currently awaiting customer verification. Status will update once security protocols are completed.
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <Button className="w-full h-14 rounded-2xl font-black text-lg shadow-xl" onClick={() => setSelectedTx(null)}>
                    CLOSE REPORT
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function DetailLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center px-2">
      <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`font-black ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
