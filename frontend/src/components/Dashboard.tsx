import React, { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { predictPrimary, TransactionInput, PredictionOutput } from "../api";
import {
  AlertTriangle,
  ShieldCheck,
  Activity,
  Play,
  Square,
  TrendingUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SIMULATION_INTERVAL_MS = 800;
const MAX_LIVE_POINTS = 30;
const FRAUD_BURST_WINDOW_MS = 10_000;
const FRAUD_BURST_DURATION_MS = 3_000;

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

const pulseVariant = {
  pulse: {
    scale: [1, 1.05, 1],
    transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const },
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LivePoint {
  time: string;
  risk: number;
  isFraud: boolean;
}

interface Stats {
  safe: number;
  fraud: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Component: Stat Card with motion
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Dashboard Component
// ---------------------------------------------------------------------------
const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({ safe: 0, fraud: 0, total: 0 });
  const [liveData, setLiveData] = useState<LivePoint[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentRisk, setCurrentRisk] = useState(0);
  const [lastResult, setLastResult] = useState<PredictionOutput | null>(null);

  // Generate a realistic fake transaction
  const generateTransaction = useCallback((): TransactionInput => {
    const now = Date.now();
    const isFraudBurst = now % FRAUD_BURST_WINDOW_MS < FRAUD_BURST_DURATION_MS;

    if (isFraudBurst && Math.random() > 0.3) {
      // Fraud-like transaction: CASH_OUT draining account
      return {
        step: 1,
        type: "CASH_OUT",
        amount: 90_000 + Math.random() * 50_000,
        oldbalanceOrg: 90_000 + Math.random() * 50_000,
        newbalanceOrig: 0,
        oldbalanceDest: 0,
        newbalanceDest: 0,
      };
    }

    // Normal transaction
    return {
      step: 1,
      type: "PAYMENT",
      amount: Math.random() * 500,
      oldbalanceOrg: 5_000 + Math.random() * 1_000,
      newbalanceOrig: 4_500 + Math.random() * 1_000,
      oldbalanceDest: 0,
      newbalanceDest: 0,
    };
  }, []);

  // Simulation loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isSimulating) {
      interval = setInterval(async () => {
        const fakeInput = generateTransaction();

        try {
          const result = await predictPrimary(fakeInput);
          setLastResult(result);

          setStats((prev) => ({
            safe: prev.safe + (result.is_fraud ? 0 : 1),
            fraud: prev.fraud + (result.is_fraud ? 1 : 0),
            total: prev.total + 1,
          }));

          setCurrentRisk(result.probability);

          setLiveData((prev) => {
            const next: LivePoint[] = [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                risk: result.probability,
                isFraud: result.is_fraud,
              },
            ];
            if (next.length > MAX_LIVE_POINTS) next.shift();
            return next;
          });
        } catch (e) {
          console.error("Simulation error:", e);
        }
      }, SIMULATION_INTERVAL_MS);
    }

    return () => clearInterval(interval);
  }, [isSimulating, generateTransaction]);

  // Chart data
  const distributionData = [
    { name: "Safe", count: stats.safe },
    { name: "Fraud", count: stats.fraud },
  ];

  const pieData = [
    { name: "Safe", value: stats.safe || 1, fill: "#0f766e" },
    { name: "Fraud", value: stats.fraud || 0, fill: "#ef4444" },
  ];

  const riskColor =
    currentRisk > 0.7
      ? "text-danger"
      : currentRisk > 0.3
        ? "text-warning"
        : "text-success";

  return (
    <Layout>
      <div className="container py-6 sm:py-8 space-y-8">
        {/* Header */}
        <motion.div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Live Risk Monitor
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time fraud detection stream — XGBoost + Heuristic Engine
            </p>
          </div>

          <div className="flex items-center gap-4 bg-card p-2 rounded-lg border border-border shadow-sm">
            <AnimatePresence mode="wait">
              <motion.span
                key={isSimulating ? "active" : "standby"}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isSimulating
                    ? "bg-success-muted text-success"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isSimulating ? "System Active" : "System Standby"}
              </motion.span>
            </AnimatePresence>

            <Button
              onClick={() => setIsSimulating(!isSimulating)}
              variant={isSimulating ? "destructive" : "default"}
              className="gap-2"
            >
              {isSimulating ? (
                <>
                  <Square className="w-4 h-4 fill-current" /> Stop Stream
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> Start Stream
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Transactions Scanned"
            value={stats.total}
            icon={<Activity className="w-6 h-6 text-primary" />}
            iconBg="bg-primary/10"
            index={0}
          />
          <StatCard
            label="Fraud Detected"
            value={
              <motion.span
                key={stats.fraud}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="text-danger"
              >
                {stats.fraud}
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
            icon={
              isSimulating ? (
                <motion.div variants={pulseVariant} animate="pulse">
                  <ShieldCheck
                    className={`w-6 h-6 ${
                      currentRisk > 0.7 ? "text-danger" : "text-success"
                    }`}
                  />
                </motion.div>
              ) : (
                <ShieldCheck className="w-6 h-6 text-success" />
              )
            }
            iconBg={currentRisk > 0.7 ? "bg-danger/10" : "bg-success/10"}
            index={2}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Live Probability Stream */}
          <motion.div
            className="section-card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground">
                Live Fraud Probability
              </h2>
              <p className="text-sm text-muted-foreground">
                Real-time probability stream of incoming transactions
              </p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer>
                <AreaChart data={liveData}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis dataKey="time" hide />
                  <YAxis
                    domain={[0, 1]}
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
                    formatter={(value: number) => [
                      `${(value * 100).toFixed(1)}%`,
                      "Risk",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="risk"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#colorRisk)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Distribution Bar Chart */}
          <motion.div
            className="section-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground">
                Detection Distribution
              </h2>
              <p className="text-sm text-muted-foreground">
                Fraud vs Legitimate probability distribution
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
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 14,
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
                    {distributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === "Fraud" ? "#ef4444" : "#0f766e"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Live Donut / Pie + XAI Factors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart */}
          <motion.div
            className="section-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Classification Ratio
              </h2>
              <p className="text-sm text-muted-foreground">
                Cumulative fraud vs. legitimate classification
              </p>
            </div>
            <div className="h-[280px] w-full flex items-center justify-center">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={`pie-${idx}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0f766e]" />
                Safe ({stats.safe})
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                Fraud ({stats.fraud})
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
                Latest XAI Risk Factors
              </h2>
              <p className="text-sm text-muted-foreground">
                Explainability output from the most recent transaction
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
                  {isSimulating
                    ? "Waiting for data..."
                    : "Start the stream to see live XAI output"}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
