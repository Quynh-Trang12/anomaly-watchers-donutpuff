import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { getUserTransactions, TransactionRecord } from "@/api";
import { useAuth } from "@/context/AuthContext";
import { 
  History as HistoryIcon, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft,
  SearchX
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function History() {
  const { userId } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getUserTransactions(userId);
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filteredTransactions = transactions.filter(t => 
    t.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="container py-8 max-w-5xl">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <HistoryIcon className="h-8 w-8 text-primary" />
              Activity Log
            </h1>
            <p className="text-muted-foreground mt-1">Review your recent transaction history and security status.</p>
          </div>
          
          <div className="flex gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search history..." 
                className="pl-10 rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-xl">
              <Filter className="h-4 w-4" />
            </Button>
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
              <div key={t.transaction_id} className="bg-card border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className={`p-3 rounded-xl ${
                    t.type === 'TRANSFER' || t.type === 'CASH_OUT' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                  }`}>
                    {t.type === 'TRANSFER' || t.type === 'CASH_OUT' ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownLeft className="h-6 w-6" />}
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
                    'bg-warning-muted text-warning'
                  }`}>
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-right w-full md:w-auto">
                  <h3 className={`text-xl font-black ${
                    t.type === 'TRANSFER' || t.type === 'CASH_OUT' ? 'text-foreground' : 'text-success'
                  }`}>
                    {t.type === 'TRANSFER' || t.type === 'CASH_OUT' ? '-' : '+'}${t.amount.toLocaleString()}
                  </h3>
                  <p className="text-xs text-muted-foreground">{new Date(t.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
