import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  Legend,
  LabelList,
} from "recharts";
import {
  getActiveThresholds,
  getAllTransactionsAdmin,
  getUserTransactions,
  TransactionRecord,
} from "../api";
import {
  AlertTriangle,
  ShieldCheck,
  Activity,
  TrendingUp,
  Download,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  PieChart as PieIcon,
  BarChart3,
  CircleDot,
} from "lucide-react";
import { formatCurrencyToUSD } from "@/lib/utils";
import { toast } from "sonner";

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_HISTORY = 40;

// ─── Animation Variants ─────────────────────────────────────────────────────
const gridVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// ─── Dashboard Component ────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { userId, isAdmin } = useAuth();
  const [txs, setTxs] = useState<TransactionRecord[]>([]);
  const [thresholds, setThresholds] = useState({
    block_threshold: 0.513,
    step_up_threshold: 0.1,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [thr, data] = await Promise.all([
        getActiveThresholds(),
        isAdmin
          ? getAllTransactionsAdmin(userId || "admin_1")
          : getUserTransactions(userId, userId),
      ]);
      setThresholds(thr);
      setTxs(data);
    } catch (error) {
      toast.error("Failed to sync dashboard telemetry.");
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived Telemetry
  const stats = useMemo(() => {
    const total = txs.length;
    const approved = txs.filter((t) => t.status === "APPROVED").length;
    const blocked = txs.filter((t) => t.status === "BLOCKED").length;
    const pending = txs.filter(
      (t) => t.status === "PENDING_USER_OTP" || t.status === "CANCELLED",
    ).length;
    const currentRisk =
      txs.length > 0 ? txs[txs.length - 1].probability_score : 0;
    return { total, approved, blocked, pending, currentRisk };
  }, [txs]);

  // Chart 1: Fraud Risk Over Time
  const riskLineData = useMemo(
    () =>
      txs.slice(-MAX_HISTORY).map((t) => ({
        time: new Date(t.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        risk: t.probability_score,
        id: t.transaction_id,
      })),
    [txs],
  );

  // Chart 2: Security Outcome Distribution
  const outcomeData = [
    { name: "Approved", count: stats.approved, color: "#0f766e" },
    { name: "Blocked", count: stats.blocked, color: "#ef4444" },
    { name: "Caution", count: stats.pending, color: "#f59e0b" },
  ];

  // Chart 3: Transaction Profile (Scatter)
  const scatterData = useMemo(
    () =>
      txs.slice(-MAX_HISTORY).map((t) => ({
        amount: t.amount,
        risk: t.probability_score * 100,
        status: t.status,
      })),
    [txs],
  );

  // Chart 4: Risk Distribution Histogram
  const histogramData = useMemo(() => {
    const bins = Array(10).fill(0);
    txs.forEach((t) => {
      const binIdx = Math.min(Math.floor(t.probability_score * 10), 9);
      bins[binIdx]++;
    });
    return bins.map((count, i) => ({
      range: `${i * 10}-${(i + 1) * 10}%`,
      count,
    }));
  }, [txs]);

  const handleExportCSV = () => {
    const headers = "ReferenceID,Timestamp,Amount,Type,Status,RiskScore\n";
    const rows = txs
      .map(
        (t) =>
          `"${t.transaction_id}",${t.timestamp},${t.amount},${t.type},${t.status},${t.probability_score}`,
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AnomalyWatchers_Audit_${Date.now()}.csv`;
    a.click();
  };

  return (
    <Layout>
      <div className="container py-12 space-y-10">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3">
              <Activity className="h-10 w-10 text-primary" />
              Security Telemetry
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.3em] mt-1 italic">
              Analytical Override & Pattern Monitoring
            </p>
          </div>

          <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-2xl border">
            <Button
              variant="ghost"
              onClick={fetchData}
              className="gap-2 font-black rounded-xl h-10"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </Button>
            <Button
              variant="default"
              onClick={handleExportCSV}
              className="gap-2 font-black rounded-xl h-10 shadow-lg"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </header>

        {/* Stats Grid */}
        <motion.div
          variants={gridVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <StatCard
            label="Total Scans"
            value={stats.total}
            icon={<TrendingUp />}
            color="text-primary"
            index={0}
          />
          <StatCard
            label="Manual Blocks"
            value={stats.blocked}
            icon={<AlertTriangle />}
            color="text-danger"
            index={1}
          />
          <StatCard
            label="Verification Rate"
            value={`${((stats.pending / (stats.total || 1)) * 100).toFixed(1)}%`}
            icon={<ShieldCheck />}
            color="text-warning"
            index={2}
          />
          <StatCard
            label="Pulse Risk"
            value={`${(stats.currentRisk * 100).toFixed(1)}%`}
            icon={<Activity />}
            color={stats.currentRisk > 0.5 ? "text-danger" : "text-success"}
            index={3}
          />
        </motion.div>

        {/* Main Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Chart 1: Line */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="bg-card border rounded-[2.5rem] p-8 shadow-sm"
          >
            <div className="mb-8">
              <h3 className="text-xl font-black flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Real-time Fraud
                Probability
              </h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
                Transaction Stream Behavioral scoring
              </p>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={riskLineData}>
                  <XAxis dataKey="time" hide />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "20px",
                      border: "none",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                      fontWeight: 800,
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#6366f1" }}
                  />
                  <ReferenceLine
                    y={thresholds.block_threshold}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    label={{
                      value: "HARD BLOCK",
                      position: "insideTopRight",
                      fill: "#ef4444",
                      fontSize: 10,
                      fontWeight: 900,
                    }}
                  />
                  <ReferenceLine
                    y={thresholds.step_up_threshold}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{
                      value: "STEP-UP",
                      position: "insideTopRight",
                      fill: "#f59e0b",
                      fontSize: 10,
                      fontWeight: 900,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="risk"
                    stroke="hsl(var(--primary))"
                    strokeWidth={4}
                    dot={{ r: 4, strokeWidth: 2, fill: "white" }}
                    activeDot={{ r: 8, strokeWidth: 4 }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Chart 2: Bar */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="bg-card border rounded-[2.5rem] p-8 shadow-sm"
          >
            <div className="mb-8">
              <h3 className="text-xl font-black flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-primary" /> Outcome
                Distribution
              </h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
                Global security decision breakdown
              </p>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outcomeData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontWeight: 700, fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.02)" }}
                    contentStyle={{ borderRadius: "20px" }}
                  />
                  <Bar dataKey="count" radius={[0, 20, 20, 0]} barSize={40}>
                    {outcomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      style={{ fontWeight: 900, fill: "currentColor" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Chart 3: Scatter */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="bg-card border rounded-[2.5rem] p-8 shadow-sm"
          >
            <div className="mb-8">
              <h3 className="text-xl font-black flex items-center gap-2">
                <CircleDot className="h-5 w-5 text-primary" /> Risk-to-Value
                Profile
              </h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
                Correlation between transaction amount and AI risk score
              </p>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <XAxis
                    type="number"
                    dataKey="amount"
                    name="Amount"
                    unit="$"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="risk"
                    name="Risk"
                    unit="%"
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter name="Transactions" data={scatterData}>
                    {scatterData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.risk > thresholds.block_threshold * 100
                            ? "#ef4444"
                            : "#0f766e"
                        }
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Chart 4: Histogram (NEW) */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="bg-card border rounded-[2.5rem] p-8 shadow-sm"
          >
            <div className="mb-8">
              <h3 className="text-xl font-black flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Probability
                Density
              </h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
                Frequency distribution of ML risk scores
              </p>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData}>
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 10, fontWeight: 700 }}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: "20px" }} />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  index: number;
}

function StatCard({ label, value, icon, color, index }: StatCardProps) {
  return (
    <motion.div
      custom={index}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-card border-2 rounded-[2rem] p-8 shadow-sm hover:shadow-xl transition-all"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-4 rounded-2xl bg-muted/50 ${color}`}>
          {React.cloneElement(icon, { size: 24, strokeWidth: 3 } as any)}
        </div>
        <div className="bg-success/10 text-success text-[10px] font-black px-2 py-0.5 rounded-full">
          +12%
        </div>
      </div>
      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
      <h2 className={`text-4xl font-black mt-2 tracking-tighter ${color}`}>
        {value}
      </h2>
    </motion.div>
  );
}

export default Dashboard;
