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
  notifyAdminQueueOverflow,
  getFrozenAccounts,
  unfreezeAccount,
  getFreezeConfig,
  updateFreezeConfig,
  FrozenAccountEntry,
  FreezeConfig,
} from "@/api";
import { 
  Settings, 
  Shield, 
  ClipboardCheck, 
  Save, 
  Activity,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Lock,
  Unlock,
  RefreshCw,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, MOCK_USERS } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { formatCurrencyToUSD } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function Admin() {
  const { isAdmin, userId } = useAuth();
  const [config, setConfig] = useState<BusinessRules | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Account Security State
  const [frozenAccounts, setFrozenAccounts] = useState<FrozenAccountEntry[]>([]);
  const [freezeCfg, setFreezeCfg] = useState<FreezeConfig>({
    max_failed_otp_attempts: 3,
    max_consecutive_cancellations: 3,
    observation_window_minutes: 10,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configData, transData, logsData, frozenData, fCfg] = await Promise.all([
        getConfiguration(),
        getAllTransactionsAdmin(userId || "admin_1"),
        getAuditLogs(),
        getFrozenAccounts(),
        getFreezeConfig(),
      ]);
      setConfig(configData.business_rules);
      setTransactions(transData);
      setAuditLogs(logsData);
      setFrozenAccounts(frozenData);
      setFreezeCfg(fCfg);
    } catch (error) {
      toast.error("Failed to synchronize administrative data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      await updateConfiguration(config);
      toast.success("Heuristic business rules updated and deployed.");
      loadData();
    } catch (error) {
      toast.error("Configuration deployment failed.");
    }
  };

  const handleTransactionAction = async (id: string, action: "approve" | "block") => {
    try {
      await updateTransactionStatus(id, action, userId || "admin_1");
      toast.success(`Transaction manually overridden: ${action.toUpperCase()}`);
      loadData();
    } catch (error) {
      toast.error("Manual override rejected by system.");
    }
  };

  const handleUnfreeze = async (accId: string) => {
    try {
      await unfreezeAccount(accId, userId || "admin_1");
      toast.success(`Security hold removed for ${accId}`);
      loadData();
    } catch (error) {
      toast.error("Unfreeze operation failed.");
    }
  };

  const handleSaveFreezeCfg = async () => {
    try {
      await updateFreezeConfig(freezeCfg, userId || "admin_1");
      toast.success("Security thresholds updated and synchronized.");
      loadData();
    } catch (error) {
      toast.error("Threshold update failed.");
    }
  };

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <Layout>
      <div className="container py-12 max-w-7xl">
        <header className="mb-10 p-8 bg-card border rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
            <Zap className="h-64 w-64 text-primary" />
          </div>
          <div className="relative z-10">
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-4">
              <Shield className="h-3 w-3" /> System Orchestrator
            </div>
            <h1 className="text-4xl font-black tracking-tight">Enterprise Control Center</h1>
            <p className="text-muted-foreground font-medium mt-1">Manage global heuristic rules, security thresholds, and manual overrides.</p>
          </div>
          <Button onClick={loadData} variant="outline" className="h-12 rounded-xl gap-2 font-black border-2 transition-all hover:bg-muted relative z-10">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Sync Data
          </Button>
        </header>

        <Tabs defaultValue="security" className="space-y-8">
          <TabsList className="bg-muted/50 p-1.5 rounded-2xl h-16 w-full sm:w-auto shadow-inner flex overflow-x-auto no-scrollbar">
            <TabsTrigger value="security" className="gap-2 rounded-xl font-black px-6 data-[state=active]:shadow-lg">
              <Lock className="h-4 w-4" /> Account Security
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2 rounded-xl font-black px-6 data-[state=active]:shadow-lg">
              <Settings className="h-4 w-4" /> Rule Tuning
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 rounded-xl font-black px-6 data-[state=active]:shadow-lg">
              <History className="h-4 w-4" /> Audit Trailing
            </TabsTrigger>
          </TabsList>

          {/* ─── Account Security Tab ─────────────────────────────────────── */}
          <TabsContent value="security" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-card border rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-danger/10 text-danger rounded-2xl">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Frozen Account Registry</h3>
                    <p className="text-sm text-muted-foreground font-medium">Suspend/Unsuspend suspicious customer profiles.</p>
                  </div>
                </div>

                {frozenAccounts.length === 0 ? (
                  <div className="p-16 text-center border-2 border-dashed rounded-3xl bg-muted/10 items-center justify-center flex flex-col">
                    <CheckCircle2 className="h-16 w-16 text-success opacity-10 mb-4" />
                    <p className="text-muted-foreground font-black uppercase text-xs tracking-widest">Global Green Status</p>
                    <p className="text-[10px] text-muted-foreground mt-1">All accounts are currently active and unrestricted.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {frozenAccounts.map((acc) => (
                      <motion.div 
                        layout 
                        key={acc.user_id} 
                        className="flex items-center justify-between p-5 rounded-2xl bg-danger/5 border border-danger/10 group hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-danger/10 rounded-xl group-hover:scale-110 transition-transform">
                            <Lock className="h-5 w-5 text-danger" />
                          </div>
                          <div>
                            <p className="font-black text-lg leading-tight">{acc.user_id}</p>
                            <p className="text-xs text-danger font-bold uppercase tracking-tight">{acc.reason}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-1">
                              Time: {new Date(acc.frozen_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-xl h-10 px-4 font-black border-2"
                          onClick={() => handleUnfreeze(acc.user_id)}
                        >
                          <Unlock className="h-4 w-4" /> REINSTATE
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-card border rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Security Threshold Tuning</h3>
                    <p className="text-sm text-muted-foreground font-medium">Define automated account lockdown parameters.</p>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                      OTP Violation Limit
                      <span className="text-primary font-mono">{freezeCfg.max_failed_otp_attempts} ATTEMPTS</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={freezeCfg.max_failed_otp_attempts}
                      className="h-14 rounded-2xl font-black bg-muted/30 text-xl"
                      onChange={(e) => setFreezeCfg({ ...freezeCfg, max_failed_otp_attempts: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-[10px] text-muted-foreground font-medium">Number of failed OTP attempts before automatic account freeze.</p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                      Cancelled Medium-Risk Limit
                      <span className="text-primary font-mono">{freezeCfg.max_consecutive_cancellations} CANCELLATIONS</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={freezeCfg.max_consecutive_cancellations}
                      className="h-14 rounded-2xl font-black bg-muted/30 text-xl"
                      onChange={(e) => setFreezeCfg({ ...freezeCfg, max_consecutive_cancellations: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-[10px] text-muted-foreground font-medium">Number of consecutive cancelled medium-risk transactions before automatic account freeze.</p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                      Violation Window (Min)
                      <span className="text-primary font-mono">{freezeCfg.observation_window_minutes} MINUTES</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={freezeCfg.observation_window_minutes}
                      className="h-14 rounded-2xl font-black bg-muted/30 text-xl"
                      onChange={(e) => setFreezeCfg({ ...freezeCfg, observation_window_minutes: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-[10px] text-muted-foreground font-medium">Time window for counting security violations (applies to both OTP and cancellations).</p>
                  </div>

                  <Button onClick={handleSaveFreezeCfg} className="w-full h-16 rounded-2xl text-lg font-black gap-3 shadow-xl transition-all hover:scale-[1.01] active:scale-[0.98]">
                    <Save className="h-5 w-5" /> SYNC THRESHOLDS
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>


          {/* ─── Rule Tuning Tab (Config) ─────────────────────────────────── */}
          <TabsContent value="config">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-card border rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Heuristic Decision Matrix</h3>
                    <p className="text-sm text-muted-foreground font-medium">Adjust non-ML overrides and global flags.</p>
                  </div>
                </div>

                {config && (
                  <div className="space-y-8">
                    <div className="p-6 rounded-2xl bg-muted/30 border border-dashed relative overflow-hidden">
                      <div className="absolute right-0 top-0 p-4 opacity-5">
                        <Activity className="h-16 w-16" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                        <div className="space-y-0.5">
                          <Label className="text-lg font-black">Strict Pattern Validation</Label>
                          <p className="text-xs text-muted-foreground font-bold">Automatically block 100% of historically toxic patterns.</p>
                        </div>
                        <Switch 
                          className="scale-125 data-[state=checked]:bg-primary"
                          checked={config.restricted_flagged_status}
                          onCheckedChange={v => setConfig({...config, restricted_flagged_status: v})}
                        />
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${config.restricted_flagged_status ? 'w-full bg-primary' : 'w-1/3 bg-muted-foreground/30'}`} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest mt-4 text-muted-foreground">System Security Level: <span className={config.restricted_flagged_status ? 'text-primary' : 'text-warning'}>{config.restricted_flagged_status ? 'HIGH ENFORCEMENT' : 'ADAPTIVE'}</span></p>
                      </div>
                    </div>

                    <Button onClick={handleSaveConfig} className="w-full h-16 rounded-2xl text-lg font-black gap-3 shadow-xl transition-all hover:scale-[1.01] active:scale-[0.98]">
                      <Save className="h-5 w-5" /> SYNC BUSINESS RULES
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-6">
                 <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-[2.5rem] p-10 flex flex-col items-center justify-center flex-1 text-center">
                    <Shield className="h-20 w-20 text-primary opacity-20 mb-6" />
                    <h4 className="text-2xl font-black mb-2 tracking-tight">Autonomous Calibration</h4>
                    <p className="text-muted-foreground font-medium text-sm leading-relaxed max-w-xs">
                      The Donutpuff system uses a hybrid model of ML scoring and heuristic rule sets. These parameters calibrate the out-of-band (OOB) step-up triggers.
                    </p>
                 </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── Audit Trail Tab ─────────────────────────────────────────── */}
          <TabsContent value="audit">
            <div className="bg-card border rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="p-8 border-b bg-muted/20 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                    <History className="h-6 w-6 text-primary" />
                    System Ledger Logs
                  </h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1 italic">Immutable Admin Event Chain</p>
                </div>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto no-scrollbar">
                {auditLogs.slice().reverse().map(log => (
                  <div key={log.log_id} className="p-6 hover:bg-muted/30 transition-colors flex gap-6 items-start">
                    <div className={`h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center ${
                      log.action_type === 'CONFIG_UPDATE' ? 'bg-primary/10 text-primary' : 
                      log.action_type.includes('FREEZE') ? 'bg-danger/10 text-danger' : 'bg-muted text-muted-foreground'
                    }`}>
                      {log.action_type === 'CONFIG_UPDATE' ? <Settings className="h-6 w-6" /> : 
                       log.action_type.includes('FREEZE') ? <Lock className="h-6 w-6" /> : <Activity className="h-6 w-6" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-muted rounded-md">{log.action_type}</span>
                        <span className="text-[10px] text-muted-foreground font-mono font-bold">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug">{log.details}</p>
                      <div className="flex items-center gap-1 mt-2 text-[10px] font-black text-muted-foreground uppercase">
                        <User className="h-3 w-3" /> Operator Identity: <span className="text-foreground ml-1">{log.admin_id}</span>
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
