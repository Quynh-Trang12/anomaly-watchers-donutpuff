import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
} from "lucide-react";
import {
  verifyOTP,
  getTransactionStatus,
  cancelTransactionOTP,
  getUserTransactions,
} from "@/api";
import { toast } from "sonner";

interface OTPChallengeProps {
  transactionId: string;
  onSuccess: () => void;
  onFail: () => void;
}

const TIMER_SECONDS = 10; // 5 minutes for OTP verification

export function OTPChallenge({
  transactionId,
  onSuccess,
  onFail,
}: OTPChallengeProps) {
  const [otp, setOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [status, setStatus] = useState<
    "pending" | "success" | "failed" | "verifying"
  >("pending");
  const [attempts, setAttempts] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  const isFinished = useRef(false);

  const announceTime = useCallback((seconds: number) => {
    if (seconds === 60 || seconds === 30 || seconds === 10 || seconds === 5) {
      if (announcerRef.current) {
        announcerRef.current.textContent = `${seconds} seconds remaining`;
      }
    }
  }, []);

  useEffect(() => {
    if (status !== "pending" && status !== "verifying") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        announceTime(next);
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Handle timer expiry: cancel transaction and check if account was frozen
          cancelTransactionOTP(transactionId)
            .then((response) => {
              // Check if account was frozen due to consecutive cancellations
              if (response.account_frozen) {
                toast.error("Account frozen suspicious activity");
              }
            })
            .catch(() => {}); // Ignore cancellation errors
          setStatus("failed");
          setErrorMessage("Verification code has expired.");
          onFail();
          return 0;
        }
        return next;
      });
    }, 1000);

    // BACKGROUND POLLING: Check if transaction was frozen/blocked out-of-band
    const pollInterval = setInterval(async () => {
      try {
        const tx = await getTransactionStatus(transactionId);
        if (tx.status === "BLOCKED") {
          if (timerRef.current) clearInterval(timerRef.current);
          clearInterval(pollInterval);
          setStatus("failed");
          setErrorMessage(
            "Security Alert: This transaction has been blocked by emergency protocols.",
          );
          onFail();
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 3000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(pollInterval);
    };
  }, [status, onFail, announceTime, transactionId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setErrorMessage("Please enter a 6-digit code.");
      return;
    }

    setStatus("verifying");
    setErrorMessage("");

    try {
      await verifyOTP(transactionId, otp);
      isFinished.current = true;
      setStatus("success");
      if (timerRef.current) clearInterval(timerRef.current);
      toast.success("Identity verified. Transaction approved!");
      setTimeout(() => onSuccess(), 2000);
    } catch (error: any) {
      const respMsg = error.response?.data?.detail || "Invalid code.";

      // Determine if account is frozen
      if (respMsg.toLowerCase().includes("frozen")) {
        setStatus("failed");
        isFinished.current = true;
        if (timerRef.current) clearInterval(timerRef.current);
        setErrorMessage(
          "Your account has been frozen due to too many failed attempts. Please contact support.",
        );
        toast.error("Account frozen.");
        onFail();
      } else {
        // Just a wrong code
        setStatus("pending");
        setOtp("");
        setAttempts((prev) => prev + 1);
        setErrorMessage(respMsg);
        inputRef.current?.focus();
      }
    }
  };

  const handleCancel = async () => {
    try {
      const response = await cancelTransactionOTP(transactionId);
      // Check if account was frozen due to consecutive cancellations
      if (response.account_frozen) {
        toast.error("Account frozen suspicious activity");
      } else {
        toast.info("Transaction cancelled.");
      }
    } catch (e) {
      // Logic proceed to UI update regardless of API success
      toast.info("Transaction cancelled.");
    }
    isFinished.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("failed");
    setErrorMessage("Transaction cancelled.");
    onFail();
  };

  // CLEANUP ON UNMOUNT: If user navigates away without finishing, CANCEL the TX
  useEffect(() => {
    return () => {
      // If we are discarding the component without a final result, auto-cancel on backend
      if (!isFinished.current) {
        cancelTransactionOTP(transactionId).catch(() => {});
      }
    };
  }, [transactionId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (status === "success") {
    return (
      <div className="text-center space-y-4" role="status" aria-live="polite">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 border-2 border-success">
          <CheckCircle className="h-8 w-8 text-success" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-success">
          Verification Complete
        </h3>
        <p className="text-sm text-muted-foreground">
          Identity confirmed. Moving to final processing...
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="text-center space-y-4" role="status" aria-live="polite">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger/10 border-2 border-danger">
          <XCircle className="h-8 w-8 text-danger" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-danger">Verification Failed</h3>
        <p className="text-sm text-balance text-muted-foreground">
          {errorMessage || "Transaction has been declined."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        ref={announcerRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-warning/10 border-2 border-warning mb-2">
          <Shield className="h-6 w-6 text-warning" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold">Identity Verification</h3>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to your email. Enter it below to authorize this
          payment.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/30 py-2 rounded-full">
        <Clock className="h-4 w-4" aria-hidden="true" />
        <span
          className={timeLeft <= 30 ? "text-danger font-bold" : "font-mono"}
        >
          Expires in: {formatTime(timeLeft)}
        </span>
      </div>

      {errorMessage && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-danger shrink-0" />
          <p className="text-sm font-medium text-danger">{errorMessage}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label
          htmlFor="otp"
          className="text-xs uppercase tracking-widest text-muted-foreground font-bold"
        >
          Security Code
        </Label>
        <Input
          ref={inputRef}
          id="otp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="h-16 text-center font-mono text-3xl tracking-[0.5em] rounded-2xl bg-muted/50 border-2 focus-visible:ring-primary"
          disabled={status === "verifying"}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Button
          onClick={handleVerify}
          disabled={otp.length !== 6 || status === "verifying"}
          className="h-14 rounded-xl text-lg font-bold shadow-lg"
        >
          {status === "verifying" ? (
            <>
              <Loader className="mr-2 h-5 w-5 animate-spin" />
              Verifying...
            </>
          ) : (
            "Confirm Transaction"
          )}
        </Button>

        <Button
          variant="ghost"
          onClick={handleCancel}
          disabled={status === "verifying"}
          className="text-muted-foreground hover:text-danger hover:bg-danger/5"
        >
          Cancel Transaction
        </Button>
      </div>
    </div>
  );
}
