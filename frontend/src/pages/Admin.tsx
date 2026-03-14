import { useState, useEffect, useRef, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AdminSettings, 
  DEFAULT_ADMIN_SETTINGS,
  Transaction 
} from "@/types/transaction";
import { 
  getAdminSettings, 
  saveAdminSettings, 
  addAuditLogEntry,
  getAdminAuditLog,
  getTransactions,
  exportTransactions
} from "@/lib/storage";
import { GlobalTrafficMonitor } from "@/components/admin/GlobalTrafficMonitor";
import { ReviewQueue } from "@/components/admin/ReviewQueue";
import { 
  Settings, 
  Shield, 
  ClipboardCheck, 
  BarChart3, 
  Save, 
  Download,
  AlertTriangle,
  Activity,
  History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const { toast } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [auditLog, setAuditLog] = useState<{ changedAt: string; field: string; oldValue: any; newValue: any; actor: string }[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const loadedSettings = getAdminSettings();
    setSettings(loadedSettings);
    setOriginalSettings(loadedSettings);
    setTransactions(getTransactions());
    setAuditLog(getAdminAuditLog());
    headingRef.current?.focus();
  }, []);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const validateSettings = (): boolean => {
    if (settings.approveThreshold >= settings.blockThreshold) {
      setValidationError("Approve threshold must be less than block threshold");
      return false;
    }
    if (settings.approveThreshold < 0 || settings.approveThreshold > 1) {
      setValidationError("Approve threshold must be between 0 and 1");
      return false;
    }
    if (settings.blockThreshold < 0 || settings.blockThreshold > 1) {
      setValidationError("Block threshold must be between 0 and 1");
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSaveSettings = () => {
    if (!validateSettings()) return;

    // Log changes
    Object.keys(settings).forEach(key => {
      const k = key as keyof AdminSettings;
      if (settings[k] !== originalSettings[k]) {
        addAuditLogEntry({
          field: key,
          oldValue: originalSettings[k],
          newValue: settings[k],
          actor: "demo_admin",
        });
      }
    });

    saveAdminSettings(settings);
    setOriginalSettings(settings);
    setAuditLog(getAdminAuditLog());
    
    toast({
      title: "Settings saved",
      description: "Admin settings have been updated successfully.",
    });
  };

  const refreshTransactions = () => {
    setTransactions(getTransactions());
  };

  const handleExport = (format: "json" | "csv") => {
    const data = exportTransactions(format);
    const blob = new Blob([data], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Metrics
  const metrics = useMemo(() => {
    if (transactions.length === 0) return null;
    
    const total = transactions.length;
    const approved = transactions.filter(t => t.decision === "APPROVE" || t.decision === "APPROVE_AFTER_STEPUP").length;
    const stepUp = transactions.filter(t => t.decision === "STEP_UP").length;
    const blocked = transactions.filter(t => t.decision === "BLOCK" || t.decision === "BLOCK_STEPUP_FAILED").length;
    const flagged = transactions.filter(t => t.isFlaggedFraud === 1).length;
    const avgRisk = transactions.reduce((sum, t) => sum + t.riskScore, 0) / total;

    // Risk distribution
    const lowRisk = transactions.filter(t => t.riskScore < 0.35).length;
    const medRisk = transactions.filter(t => t.riskScore >= 0.35 && t.riskScore < 0.7).length;
    const highRisk = transactions.filter(t => t.riskScore >= 0.7).length;

    return {
      total,
      approved,
      approveRate: (approved / total * 100).toFixed(1),
      stepUp,
      stepUpRate: (stepUp / total * 100).toFixed(1),
      blocked,
      blockRate: (blocked / total * 100).toFixed(1),
      flagged,
      avgRisk: (avgRisk * 100).toFixed(1),
      distribution: { low: lowRisk, medium: medRisk, high: highRisk },
    };
  }, [transactions]);

  return (
    <Layout>
      <div className="container py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h1 
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl sm:text-3xl font-bold outline-none"
              >
                Admin Console
              </h1>
              <span className="text-xs bg-warning-muted text-warning px-2 py-0.5 rounded">
                Demo Mode
              </span>
            </div>
            <p className="text-muted-foreground">
              Configure thresholds, rules, and view monitoring metrics.
              Not production authentication.
            </p>
          </header>

          <Tabs defaultValue="thresholds" className="space-y-6">
            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="thresholds" className="gap-2">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Thresholds
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-2">
                <Shield className="h-4 w-4" aria-hidden="true" />
                Rules
              </TabsTrigger>
              <TabsTrigger value="review" className="gap-2">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                Review Queue
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="gap-2">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Monitoring
              </TabsTrigger>
              <TabsTrigger value="traffic" className="gap-2">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Global Traffic
              </TabsTrigger>
            </TabsList>

            {/* Thresholds Tab */}
            <TabsContent value="thresholds" className="space-y-6">
              <div className="section-card space-y-6">
                <h2 className="font-semibold">Decision Thresholds</h2>
                
                {validationError && (
                  <div className="bg-danger-muted border border-danger/20 rounded-lg p-3 flex items-center gap-2 text-sm text-danger">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {validationError}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="approveThreshold">Approve Threshold</Label>
                    <Input
                      id="approveThreshold"
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={settings.approveThreshold}
                      onChange={e => setSettings({ ...settings, approveThreshold: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Risk score below this → APPROVE (default: 0.35)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blockThreshold">Block Threshold</Label>
                    <Input
                      id="blockThreshold"
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={settings.blockThreshold}
                      onChange={e => setSettings({ ...settings, blockThreshold: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Risk score at or above this → BLOCK (default: 0.70)
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setSettings(originalSettings)}
                    disabled={!hasChanges}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveSettings} disabled={!hasChanges} className="gap-2">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Rules Tab */}
            <TabsContent value="rules" className="space-y-6">
              <div className="section-card space-y-6">
                <h2 className="font-semibold">Scoring Rules</h2>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="flagThresholdAmount">Flag Threshold Amount</Label>
                    <Input
                      id="flagThresholdAmount"
                      type="number"
                      min={0}
                      value={settings.flagThresholdAmount}
                      onChange={e => setSettings({ ...settings, flagThresholdAmount: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      TRANSFER ≥ this amount sets isFlaggedFraud=1 (default: 200,000)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="highRiskAmount">High Risk Amount</Label>
                    <Input
                      id="highRiskAmount"
                      type="number"
                      min={0}
                      value={settings.highRiskAmount}
                      onChange={e => setSettings({ ...settings, highRiskAmount: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      TRANSFER/CASHOUT ≥ this adds +0.15 risk (default: 150,000)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zeroOutMinAmount">Zero-Out Min Amount</Label>
                    <Input
                      id="zeroOutMinAmount"
                      type="number"
                      min={0}
                      value={settings.zeroOutMinAmount}
                      onChange={e => setSettings({ ...settings, zeroOutMinAmount: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Balance→0 with amount ≥ this adds +0.20 risk (default: 10,000)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newDestLargeAmount">New Dest Large Amount</Label>
                    <Input
                      id="newDestLargeAmount"
                      type="number"
                      min={0}
                      value={settings.newDestLargeAmount}
                      onChange={e => setSettings({ ...settings, newDestLargeAmount: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      New destination + amount ≥ this adds +0.10 risk (default: 50,000)
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="blockInsufficientBalance">Block Insufficient Balance</Label>
                      <p className="text-xs text-muted-foreground">
                        Prevent transactions when amount exceeds balance
                      </p>
                    </div>
                    <Switch
                      id="blockInsufficientBalance"
                      checked={settings.blockInsufficientBalance}
                      onCheckedChange={checked => setSettings({ ...settings, blockInsufficientBalance: checked })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setSettings(originalSettings)}
                    disabled={!hasChanges}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveSettings} disabled={!hasChanges} className="gap-2">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Review Queue Tab */}
            <TabsContent value="review" className="space-y-6">
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} className="gap-1">
                  <Download className="h-3 w-3" aria-hidden="true" />
                  Export JSON
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-1">
                  <Download className="h-3 w-3" aria-hidden="true" />
                  Export CSV
                </Button>
              </div>
              <ReviewQueue transactions={transactions} onUpdate={refreshTransactions} />
            </TabsContent>

            {/* Monitoring Tab */}
            <TabsContent value="monitoring" className="space-y-6">
              {metrics ? (
                <>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="section-card text-center">
                      <div className="text-3xl font-bold">{metrics.total}</div>
                      <div className="text-sm text-muted-foreground">Total Transactions</div>
                    </div>
                    <div className="section-card text-center">
                      <div className="text-3xl font-bold text-success">{metrics.approveRate}%</div>
                      <div className="text-sm text-muted-foreground">Approve Rate</div>
                    </div>
                    <div className="section-card text-center">
                      <div className="text-3xl font-bold text-warning">{metrics.stepUpRate}%</div>
                      <div className="text-sm text-muted-foreground">Step-Up Rate</div>
                    </div>
                    <div className="section-card text-center">
                      <div className="text-3xl font-bold text-danger">{metrics.blockRate}%</div>
                      <div className="text-sm text-muted-foreground">Block Rate</div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="section-card">
                      <h3 className="font-semibold mb-4">Average Risk Score</h3>
                      <div className="text-4xl font-bold">{metrics.avgRisk}%</div>
                    </div>
                    <div className="section-card">
                      <h3 className="font-semibold mb-4">Flagged Transactions</h3>
                      <div className="text-4xl font-bold text-warning">{metrics.flagged}</div>
                      <div className="text-sm text-muted-foreground">isFlaggedFraud = 1</div>
                    </div>
                  </div>

                  <div className="section-card">
                    <h3 className="font-semibold mb-4">Risk Score Distribution</h3>
                    <div className="flex gap-2 h-8">
                      <div 
                        className="bg-success rounded flex items-center justify-center text-success-foreground text-xs font-medium"
                        style={{ width: `${(metrics.distribution.low / metrics.total) * 100}%` }}
                      >
                        {metrics.distribution.low > 0 && `${metrics.distribution.low} Low`}
                      </div>
                      <div 
                        className="bg-warning rounded flex items-center justify-center text-warning-foreground text-xs font-medium"
                        style={{ width: `${(metrics.distribution.medium / metrics.total) * 100}%` }}
                      >
                        {metrics.distribution.medium > 0 && `${metrics.distribution.medium} Med`}
                      </div>
                      <div 
                        className="bg-danger rounded flex items-center justify-center text-danger-foreground text-xs font-medium"
                        style={{ width: `${(metrics.distribution.high / metrics.total) * 100}%` }}
                      >
                        {metrics.distribution.high > 0 && `${metrics.distribution.high} High`}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="section-card text-center py-12">
                  <p className="text-muted-foreground">
                    No transactions yet. Metrics will appear after simulating transactions.
                  </p>
                </div>
              )}

              {/* Audit Log */}
              <div className="section-card">
                <div className="flex items-center gap-2 mb-4">
                  <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="font-semibold">Admin Audit Log</h3>
                </div>
                {auditLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {auditLog.slice().reverse().map((entry, i) => (
                      <div key={i} className="text-xs p-2 bg-muted/30 rounded">
                        <div className="font-medium">
                          {entry.field}: {String(entry.oldValue)} → {String(entry.newValue)}
                        </div>
                        <div className="text-muted-foreground">
                          {new Date(entry.changedAt).toLocaleString()} by {entry.actor}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Global Traffic Tab */}
            <TabsContent value="traffic">
              <GlobalTrafficMonitor transactions={transactions} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
