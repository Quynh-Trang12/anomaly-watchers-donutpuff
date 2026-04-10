import React, { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
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
import { getActiveThresholds, getAllTransactionsAdmin, getUserOwnTransactions, TransactionRecord } from "../api";
import {
  AlertTriangle,
  ShieldCheck,
  Activity,
  TrendingUp,
  Download,
  RefreshCw,
} from "lucide-react";
import { formatCurrencyToUSD } from "@/lib/utils";
import { toast } from "sonner";

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_CHART_POINTS = 30;

// ─── Animation Variants ─────────────────────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChartPoint {
  time: string;
  risk: number;
  isFraud: boolean;
  amount: number;
  status: string;
}

interface Stats {
  approved: number;
  blocked: number;
  cancelled: number;
  total: number;
}

// ─── Stat Card Component ────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  index: number;
}> = ({ label, value, icon, iconBg, index }) => (
  <motion.div
    className="section-card flex items-center justify-between"
    custom={index}
    initial="hidden"
    animate="visible"
    variants={cardVariants}
  >
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <h3 className="text-3xl font-bold text-foreground mt-2">{value}</h3>
    </div>
    <div className={`p-3 rounded-full ${iconBg}`}>{icon}</div>
  </motion.div>
);

// ─── Dashboard Component ────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { userId, isAdmin } = useAuth();
  const [stats, setStats] = useState<Stats>({ approved: 0, blocked: 0, cancelled: 0, total: 0 });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [currentRisk, setCurrentRisk] = useState(0);
  const [lastResult, setLastResult] = useState<TransactionRecord | null>(null);
  const [thresholds, setThresholds] = useState({ block_threshold: 0.5, step_up_threshold: 0.4 });

  // ─── Data Fetching ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const thresholdData = await getActiveThresholds();
      setThresholds(thresholdData);

      let historicalData: TransactionRecord[];
      if (isAdmin) {
        historicalData = await getAllTransactionsAdmin(userId);
      } else {
        historicalData = await getUserOwnTransactions(userId, userId);
      }
      
      // Transform historical data for the charts
      const mappedData: ChartPoint[] = historicalData.slice(-MAX_CHART_POINTS).map(txn => ({
        time: new Date(txn.timestamp).toLocaleTimeString(),
        risk: txn.probability_score,
        isFraud: txn.status === "BLOCKED",
        amount: txn.amount,
        status: txn.status,
      }));
      setChartData(mappedData);

      // Compute stats with cancelled category
      const summary = historicalData.reduce(
        (acc, txn) => ({
          approved: acc.approved + (txn.status === "APPROVED" ? 1 : 0),
          blocked: acc.blocked + (txn.status === "BLOCKED" ? 1 : 0),
          cancelled: acc.cancelled + (txn.status === "CANCELLED" ? 1 : 0),
          total: acc.total + 1,
        }),
        { approved: 0, blocked: 0, cancelled: 0, total: 0 },
      );
      setStats(summary);

      // Populate last result for XAI panel from most recent transaction
      if (historicalData.length > 0) {
        const mostRecent = historicalData[historicalData.length - 1];
        setLastResult(mostRecent);
        setCurrentRisk(mostRecent.probability_score);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Chart Data ───────────────────────────────────────────────────────────

  const distributionData = [
    { name: "Approved", count: stats.approved },
    { name: "Blocked", count: stats.blocked },
    { name: "Cancelled", count: stats.cancelled },
  ];

  // ─── Histogram Data ───────────────────────────────────────────────────────
  const histogramData = Array.from({ length: 10 }, (_, i) => {
    const low = i * 0.1;
    const high = low + 0.1;
    return {
      range: `${i * 10}–${i * 10 + 10}%`,
      count: chartData.filter(d => d.risk >= low && d.risk < high).length,
      isHighRisk: i >= 5,
    };
  });

  const handleExportCSV = () => {
    const csv_header = "Timestamp,Amount,Risk Probability,Status,Is Fraud\n";
    const csv_rows = chartData.map(point => 
      `"${point.time}",${point.amount},${point.risk},${point.status},${point.isFraud}`
    ).join("\n");
    
    const csv_blob = new Blob([csv_header + csv_rows], { type: "text/csv" });
    const download_url = URL.createObjectURL(csv_blob);
    const anchor_element = document.createElement("a");
    anchor_element.href = download_url;
    anchor_element.download = `AnomalyWatchers_Dashboard_${new Date().toISOString()}.csv`;
    anchor_element.click();
    URL.revokeObjectURL(download_url);
    toast.success("Dashboard data exported as CSV.");
  };

  const riskColor =
    currentRisk > 0.7
      ? "text-danger"
      : currentRisk > 0.3
        ? "text-warning"
        : "text-success";

  return (
    <Layout>
      <div className="container py-6 sm:py-8 space-y-8">
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <motion.div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Transaction Security Monitoring
            </h1>
            <p className="text-muted-foreground mt-1">
              Historical analysis of payment activity
            </p>
          </div>

          <div className="flex items-center gap-4 bg-card p-2 rounded-lg border border-border shadow-sm">
            <span className="px-3 py-1 rounded-full text-sm font-medium text-muted-foreground">
              Last updated: {new Date().toLocaleTimeString()}
            </span>

            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="gap-2"
              disabled={chartData.length === 0}
            >
              <Download className="w-4 h-4" /> Export CSV
            </Button>

            <Button
              onClick={fetchData}
              variant="default"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        </motion.div>

        {/* ─── Stats Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Transactions Scanned"
            value={stats.total}
            icon={<Activity className="w-6 h-6 text-primary" />}
            iconBg="bg-primary/10"
            index={0}
          />
          <StatCard
            label="Security Alerts"
            value={
              <motion.span
                key={stats.blocked}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="text-danger"
              >
                {stats.blocked}
              </motion.span>
            }
            icon={<AlertTriangle className="w-6 h-6 text-danger" />}
            iconBg="bg-danger/10"
            index={1}
          />
          <StatCard
            label="Current Risk Level"
            value={
              <span className={riskColor}>
                {(currentRisk * 100).toFixed(1)}%
              </span>
            }
            icon={<ShieldCheck className="w-6 h-6 text-success" />}
            iconBg={currentRisk > 0.7 ? "bg-danger/10" : "bg-success/10"}
            index={2}
          />
        </div>

        {/* ─── Charts Grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart 1: Fraud Risk Score Over Time */}
          <motion.div
            className="section-card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Fraud Risk Score Over Time
              </h2>
              <p className="text-sm text-muted-foreground">
                ML model probability for each processed transaction — higher values indicate greater fraud likelihood
              </p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    minTickGap={30}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
                    tick={{
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--card-foreground))",
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "risk") return [`${(value * 100).toFixed(1)}%`, "Risk Score"];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={() => "Fraud Risk Score (%)"}
                  />
                  <Line
                    type="monotone"
                    dataKey="risk"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <ReferenceLine 
                    y={thresholds.block_threshold} 
                    label={{ position: 'right', value: 'Auto-Block Limit', fill: '#ef4444', fontSize: 10 }} 
                    stroke="#ef4444" 
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                  <ReferenceLine 
                    y={thresholds.step_up_threshold} 
                    label={{ position: 'right', value: 'Extra Verification Limit', fill: '#f59e0b', fontSize: 10 }} 
                    stroke="#f59e0b" 
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Chart 2: Security Decision Breakdown */}
          <motion.div
            className="section-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground">
                Security Decision Breakdown
              </h2>
              <p className="text-sm text-muted-foreground">
                Distribution of AI-driven security outcomes across all processed transactions
              </p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer>
                <BarChart data={distributionData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={90}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 13,
                      fontWeight: 500,
                      fill: "hsl(var(--foreground))",
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={40}>
                    <LabelList dataKey="count" position="right" style={{ fill: "hsl(var(--foreground))", fontSize: 13, fontWeight: 600 }} />
                    {distributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === "Blocked" ? "#ef4444" : entry.name === "Approved" ? "#0f766e" : "#f59e0b"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Colour Legend */}
            <div className="flex gap-4 mt-3 justify-center text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#0f766e] inline-block" /> Approved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#ef4444] inline-block" /> Blocked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#f59e0b] inline-block" /> Cancelled
              </span>
            </div>
          </motion.div>
        </div>

        {/* ─── Scatter + XAI Factors ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart 3: Transaction Risk Profile */}
          <motion.div
            className="section-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Transaction Risk Profile
              </h2>
              <p className="text-sm text-muted-foreground">
                Each point represents a transaction — colour indicates the AI security decision
              </p>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    dataKey="amount" 
                    name="Amount" 
                    unit="$" 
                    tickFormatter={(val) => `$${val > 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="risk" 
                    name="Risk" 
                    domain={[0, 1]}
                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <ZAxis type="number" range={[50, 400]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                    }}
                    formatter={(value: number | string, name: string) => {
                      if (name === "Risk") return [`${(value as number * 100).toFixed(1)}%`, name];
                      if (name === "Amount") return [formatCurrencyToUSD(value as number), name];
                      return [value, name];
                    }}
                  />
                  <ReferenceLine 
                    y={thresholds.block_threshold} 
                    stroke="#ef4444" 
                    strokeDasharray="5 5"
                    label={{ value: 'Auto-Block Limit', position: 'right', fill: '#ef4444', fontSize: 10 }}
                  />
                  <ReferenceLine 
                    y={thresholds.step_up_threshold} 
                    stroke="#f59e0b" 
                    strokeDasharray="5 5"
                    label={{ value: 'Step-Up Threshold', position: 'right', fill: '#f59e0b', fontSize: 10 }}
                  />
                  <Scatter name="Transactions" data={chartData} isAnimationActive={false}>
                    {chartData.map((entry, index) => {
                      let dotColor = "#0f766e";
                      if (entry.risk >= thresholds.block_threshold) {
                        dotColor = "#ef4444";
                      } else if (entry.risk >= thresholds.step_up_threshold) {
                        dotColor = "#f59e0b";
                      }
                      return <Cell key={`cell-${index}`} fill={dotColor} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            {/* Scatter Legend */}
            <div className="flex gap-4 mt-3 justify-center text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#0f766e] inline-block" /> Low Risk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#f59e0b] inline-block" /> Medium Risk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block" /> High Risk
              </span>
            </div>
          </motion.div>

          {/* Latest XAI Risk Factors */}
          <motion.div
            className="section-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground">
                Security Decision Factors
              </h2>
              <p className="text-sm text-muted-foreground">
                Natural language explanation of the most recent activity
              </p>
            </div>

            <AnimatePresence mode="wait">
              {lastResult && lastResult.risk_factors.length > 0 ? (
                <motion.ul
                  key={stats.total}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {lastResult.risk_factors.map((rf, idx) => {
                    const severityStyles = {
                      info: "bg-muted/50 text-muted-foreground border-muted",
                      warning:
                        "bg-warning-muted text-warning border-warning/20",
                      danger: "bg-danger-muted text-danger border-danger/20",
                    };

                    return (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08 }}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${severityStyles[rf.severity]}`}
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="text-sm">{rf.factor}</span>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground text-center py-12"
                >
                  No transaction data available. Process transactions to see security analysis.
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ─── Chart 4: Fraud Probability Distribution (Histogram) ────────── */}
        <motion.div
          className="section-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Fraud Probability Distribution
            </h2>
            <p className="text-sm text-muted-foreground">
              Frequency of transactions at each ML risk score bracket
            </p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer>
              <BarChart data={histogramData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                  }}
                  formatter={(value: number) => [value, "Transactions"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
                  <LabelList dataKey="count" position="top" style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }} />
                  {histogramData.map((entry, index) => {
                    // Green 0–40%, Amber 40–70%, Red 70–100%
                    let color = "#0f766e";
                    if (index >= 7) color = "#ef4444";
                    else if (index >= 4) color = "#f59e0b";
                    return <Cell key={`hist-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Dashboard;
