import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  getConfiguration, 
  updateConfiguration, 
  getAuditLogs, 
  getAllTransactionsAdmin,
  updateTransactionStatus,
  TransactionRecord,
  AuditLogEntry,
  BusinessRules,
  notifyAdminQueueOverflow
} from "@/api";
import { 
  Settings, 
  Shield, 
  ClipboardCheck, 
  BarChart3, 
  Save, 
  Activity,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { formatCurrencyToUSD } from "@/lib/utils";

export default function Admin() {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<BusinessRules | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configData, transData, logsData] = await Promise.all([
        getConfiguration(),
        getAllTransactionsAdmin(),
        getAuditLogs()
      ]);
      setConfig(configData.business_rules);
      setTransactions(transData);
      setAuditLogs(logsData);
    } catch (error) {
      toast.error("Failed to load admin data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      await updateConfiguration(config);
      toast.success("Configuration updated successfully");
      const logs = await getAuditLogs();
      setAuditLogs(logs);
    } catch (error) {
      toast.error("Failed to update configuration");
    }
  };

  const handleTransactionAction = async (id: string, action: "approve" | "block") => {
    try {
      await updateTransactionStatus(id, action);
      toast.success(`Transaction ${action}d`);
      loadData(); // Refresh logs and transactions
    } catch (error) {
      toast.error("Failed to perform action");
    }
  };



  const pendingReview = useMemo(() => 
    transactions.filter(t => t.status === "PENDING_ADMIN_REVIEW"), 
  [transactions]);

  useEffect(() => {
    if (pendingReview.length > 10) {
      notifyAdminQueueOverflow(pendingReview.length).catch(error => {
        console.error("Failed to notify admin of queue overflow:", error);
      });
    }
  }, [pendingReview.length]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="container py-8 max-w-7xl">
        <header className="mb-8 p-6 bg-card border rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Control Center</h1>
            <p className="text-muted-foreground mt-1">Enterprise fraud oversight and system orchestration.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadData} className="gap-2">
              <Activity className="h-4 w-4" />
              Refresh Data
            </Button>
          </div>
        </header>

        <Tabs defaultValue="review" className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-xl">
            <TabsTrigger value="review" className="gap-2 rounded-lg">
              <ClipboardCheck className="h-4 w-4" />
              Review Queue
              {pendingReview.length > 0 && (
                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-bold">
                  {pendingReview.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="traffic" className="gap-2 rounded-lg">
              <Activity className="h-4 w-4" />
              Global Traffic
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2 rounded-lg">
              <Settings className="h-4 w-4" />
              System Config
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 rounded-lg">
              <History className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          {/* Pending Review Queue */}
          <TabsContent value="review" className="space-y-4">
            {pendingReview.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/20">
                <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium">Clear Queue. No transactions pending review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingReview.map(t => (
                  <div key={t.transaction_id} className="bg-card border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">{t.transaction_id}</span>
                        <h3 className="text-xl font-bold mt-1">{formatCurrencyToUSD(t.amount)}</h3>
                      </div>
                      <div className="bg-warning-muted text-warning px-3 py-1 rounded-full text-xs font-bold">
                        REVIEW REQ
                      </div>
                    </div>
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">User ID:</span>
                        <span className="font-mono font-medium">{t.owner_user_id}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium">{t.type}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">ML Prob:</span>
                        <span className="font-medium text-danger">{(t.probability_score * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-success hover:bg-success/90 text-white gap-2"
                        onClick={() => handleTransactionAction(t.transaction_id, "approve")}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="flex-1 gap-2"
                        onClick={() => handleTransactionAction(t.transaction_id, "block")}
                      >
                        <XCircle className="h-4 w-4" /> Block
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Global Traffic */}
          <TabsContent value="traffic">
            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b bg-muted/30">
                <h3 className="font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Real-time Transaction Stream
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">Transaction ID</th>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">ML Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {transactions.slice().reverse().map(t => (
                      <tr key={t.transaction_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(t.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 font-mono font-medium">{t.transaction_id}</td>
                        <td className="px-6 py-4">{t.owner_user_id}</td>
                        <td className="px-6 py-4 font-bold">{formatCurrencyToUSD(t.amount)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            t.status === 'APPROVED' ? 'bg-success-muted text-success' :
                            t.status === 'BLOCKED' ? 'bg-danger-muted text-danger' :
                            'bg-warning-muted text-warning'
                          }`}>
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted h-1.5 w-16 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${t.probability_score > 0.7 ? 'bg-danger' : t.probability_score > 0.4 ? 'bg-warning' : 'bg-success'}`}
                                style={{ width: `${t.probability_score * 100}%` }}
                              />
                            </div>
                            <span className="font-medium">{(t.probability_score * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Configuration Editor */}
          <TabsContent value="config">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-card border rounded-2xl p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Business Parameters</h3>
                    <p className="text-sm text-muted-foreground">Adjust limits and flags in real-time.</p>
                  </div>
                </div>

                {config && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="large-txn">High-Value Transfer Limit ($)</Label>
                      <Input 
                        id="large-txn"
                        type="number"
                        value={config.large_transfer_limit_amount}
                        className="font-mono h-12 rounded-xl"
                        onChange={e => setConfig({...config, large_transfer_limit_amount: parseFloat(e.target.value)})}
                      />
                      <p className="text-xs text-muted-foreground italic">
                        Transactions above this amount will be held for manual security review.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="velocity">Standard Daily Sending Limit ($)</Label>
                      <Input 
                        id="velocity"
                        type="number"
                        value={config.daily_velocity_limit}
                        className="font-mono h-12 rounded-xl"
                        onChange={e => setConfig({...config, daily_velocity_limit: parseFloat(e.target.value)})}
                      />
                      <p className="text-xs text-muted-foreground italic">
                        The maximum total volume allowed for a single account within a 24-hour window.
                      </p>
                    </div>

                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-primary mb-4">Autonomous AI Safeguards</h4>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl">
                          <div className="space-y-0.5">
                            <Label>Minimum AI Confidence Score to Auto-Block</Label>
                            <p className="text-xs text-muted-foreground">Threshold for automatic intervention.</p>
                          </div>
                          <span className="font-mono font-bold bg-danger/10 text-danger px-3 py-1 rounded-lg">51.3%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/20 border-2 border-dashed rounded-xl">
                      <div className="space-y-0.5">
                        <Label>Strict Rule Enforcement</Label>
                        <p className="text-xs text-muted-foreground">Automatically block all historically high-risk patterns.</p>
                      </div>
                      <Switch 
                        checked={config.restricted_flagged_status}
                        onCheckedChange={checked => setConfig({...config, restricted_flagged_status: checked})}
                      />
                    </div>

                    <Button onClick={handleSaveConfig} className="w-full h-14 rounded-2xl text-lg font-bold gap-3 shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]">
                      <Save className="h-5 w-5" />
                      Deploy System Configuration
                    </Button>
                  </div>
                )}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 flex flex-col justify-center">
                <Shield className="h-16 w-16 text-primary mb-6 mx-auto opacity-20" />
                <h4 className="text-lg font-bold text-center mb-2">Architectural Safety</h4>
                <p className="text-center text-muted-foreground text-sm max-w-sm mx-auto">
                  Updating these parameters will immediately overwrite the <code className="bg-primary/10 px-1 rounded">model_configuration.json</code> on the backend. ML thresholds can only be modified via the automated generation script.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Audit Logs */}
          <TabsContent value="audit">
            <div className="bg-card border rounded-2xl shadow-sm">
                <div className="p-6 border-b bg-muted/30 flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Administrative Event Log
                  </h3>
                </div>
                <div className="space-y-1 p-4">
                  {auditLogs.slice().reverse().map(log => (
                    <div key={log.log_id} className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors flex gap-4">
                      <div className="shrink-0 mt-1">
                        {log.action_type === 'CONFIG_UPDATE' ? (
                          <Settings className="h-4 w-4 text-primary" />
                        ) : log.action_type === 'STATUS_OVERRIDE' ? (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        ) : (
                          <Shield className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold uppercase tracking-tight text-primary/80">{log.action_type}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-sm font-medium mt-1">{log.details}</p>
                        <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                          <User className="h-3 w-3" /> Operated by: <span className="font-bold text-foreground/80">{log.admin_id}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
