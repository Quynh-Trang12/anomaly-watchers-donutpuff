import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { PredictionOutput } from "@/api";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  ArrowLeft, 
  History, 
  AlertTriangle,
  Mail,
  Download,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { OTPChallenge } from "@/components/result/OTPChallenge";
import { toast } from "sonner";
import { formatCurrencyToUSD } from "@/lib/utils";

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [prediction, setPrediction] = useState<PredictionOutput | null>(null);
  const [showOTP, setShowOTP] = useState(false);
  const [state, setState] = useState<"INITIAL" | "VERIFIED" | "REJECTED">("INITIAL");

  useEffect(() => {
    const prediction_data = location.state?.prediction as PredictionOutput;
    if (!prediction_data) {
      navigate("/simulate");
      return;
    }
    setPrediction(prediction_data);
    
    // Show OTP challenge for step-up transactions
    if (prediction_data.status === "PENDING_USER_OTP") {
      setShowOTP(true);
    }
  }, [location, navigate]);

  const handleExportReport = () => {
    if (!prediction) return;

    const report_lines = [
      "=== AnomalyWatchers Transaction Security Report ===",
      `Transaction ID: ${prediction.transaction_id}`,
      `Status: ${prediction.status}`,
      `Risk Level: ${prediction.risk_level}`,
      `Confidence Level: ${(prediction.probability * 100).toFixed(2)}%`,
      `Timestamp: ${new Date().toLocaleString()}`,
      "",
      "--- Security Analysis ---",
      ...prediction.risk_factors.map(factor => `[${factor.severity.toUpperCase()}] ${factor.factor}`),
      "",
      "--- System Explanation ---",
      prediction.explanation ?? "No explanation available.",
      "",
      "=== End of Report ==="
    ];
    
    const report_blob = new Blob([report_lines.join("\n")], { type: "text/plain" });
    const download_url = URL.createObjectURL(report_blob);
    const anchor_element = document.createElement("a");
    anchor_element.href = download_url;
    anchor_element.download = `AnomalyWatchers_${prediction.transaction_id}.txt`;
    anchor_element.click();
    URL.revokeObjectURL(download_url);
    toast.success("Security report exported successfully.");
  };

  const handleOTPSuccess = () => {
    setShowOTP(false);
    setState("VERIFIED");
    toast.success("Security code verified. Transaction authorized.");
  };

  const handleOTPFail = () => {
    setShowOTP(false);
    setState("REJECTED");
    toast.error("Verification failed. Transaction cancelled.");
  };

  if (!prediction) return null;

  const originalData = location.state?.originalData;
  const oldbalanceOrig = originalData?.oldbalanceOrig || 0;
  const amount = originalData?.amount || 0;

  const isBlocked = prediction.status === "BLOCKED" || state === "REJECTED";
  const isApproved = prediction.status === "APPROVED" || state === "VERIFIED";
  const isPending = prediction.status === "PENDING_USER_OTP";

  return (
    <Layout>
      <div className="container py-12 max-w-3xl">
        <div className="space-y-8">
          {/* Header Status */}
          <div className="text-center space-y-4">
            {isApproved ? (
              <div className="inline-flex items-center justify-center p-4 bg-success/10 rounded-full text-success mb-2">
                <ShieldCheck className="h-16 w-16" />
              </div>
            ) : isBlocked ? (
              <div className="inline-flex items-center justify-center p-4 bg-danger/10 rounded-full text-danger mb-2">
                <ShieldAlert className="h-16 w-16" />
              </div>
            ) : isPending ? (
              <div className="inline-flex items-center justify-center p-4 bg-warning/10 rounded-full text-warning mb-2">
                <Clock className="h-16 w-16" />
              </div>
            ) : null}
            
            <h1 className="text-4xl font-black tracking-tight">
              {isApproved ? "Transaction Secure" : 
               isBlocked ? "Transaction Blocked" : 
               isPending ? "Verification Required" : ""}
            </h1>
            <p className="text-muted-foreground text-lg">{prediction.explanation}</p>
          </div>

          {/* Verification / Review Reference Card */}
          <div className="bg-muted/50 border rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold">Confidence level</p>
                <h2 className="text-2xl font-black">{(prediction.probability * 100).toFixed(1)}%</h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Transaction Reference</p>
              <p className="font-mono text-sm font-medium">{prediction.transaction_id}</p>
            </div>
          </div>

          {/* OTP Challenge Component */}
          {showOTP && prediction?.status === "PENDING_USER_OTP" && (
            <div className="bg-card border-2 border-primary/20 rounded-3xl p-8 shadow-xl">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                <Mail className="h-6 w-6 text-amber-500 shrink-0" />
                <div>
                  <p className="font-bold text-amber-600">Action Required: Check Your Email or Terminal</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    A 6-digit security code has been sent to <strong>{userId}@example.com</strong>. 
                    If running locally, check your terminal output for the OTP fallback code.
                  </p>
                </div>
              </div>
              <OTPChallenge 
                transactionId={prediction.transaction_id}
                onSuccess={handleOTPSuccess} 
                onFail={handleOTPFail} 
              />
            </div>
          )}

          {/* Risk Factors - Human Readable XAI */}
          {!showOTP && (
            <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b bg-muted/30">
                <h3 className="font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Security Analysis Details
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {prediction.risk_factors.map((rf, idx) => (
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

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={handleExportReport} 
              variant="outline" 
              size="lg" 
              className="flex-1 h-14 rounded-2xl gap-2 font-bold"
              aria-label="Export transaction security report as text file"
            >
              <Download className="h-5 w-5" />
              Export Report
            </Button>
            <Button asChild variant="secondary" size="lg" className="flex-1 h-14 rounded-2xl gap-2 font-bold">
              <Link to="/history">
                <History className="h-5 w-5" />
                View Activity
              </Link>
            </Button>
            <Button asChild size="lg" className="flex-1 h-14 rounded-2xl gap-2 font-bold shadow-lg shadow-primary/20">
              <Link to="/simulate">
                <ArrowLeft className="h-5 w-5" />
                Return to Wallet
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
