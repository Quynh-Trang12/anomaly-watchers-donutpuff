import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Clock, CheckCircle, XCircle, AlertCircle, Loader } from "lucide-react";
import { verifyOTP } from "@/api";
import { toast } from "sonner";

interface OTPChallengeProps {
  transactionId: string;
  onSuccess: () => void;
  onFail: () => void;
}

const TIMER_SECONDS = 300; // 5 minutes for OTP verification

export function OTPChallenge({ transactionId, onSuccess, onFail }: OTPChallengeProps) {
  const [otp, setOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [status, setStatus] = useState<"pending" | "success" | "failed" | "verifying">("pending");
  const [attempts, setAttempts] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);

  // Announce time remaining for screen readers
  const announceTime = useCallback((seconds: number) => {
    if (seconds === 30 || seconds === 10 || seconds === 5) {
      if (announcerRef.current) {
        announcerRef.current.textContent = `${seconds} seconds remaining`;
      }
    }
  }, []);

  useEffect(() => {
    if (status !== "pending") return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        announceTime(next);
        if (next <= 0) {
          clearInterval(timerRef.current!);
          setStatus("failed");
          setErrorMessage("Verification code has expired.");
          onFail();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, onFail, announceTime]);

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
      setStatus("success");
      if (timerRef.current) clearInterval(timerRef.current);
      toast.success("OTP verification successful! Transaction approved.");
      setTimeout(() => onSuccess(), 2000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Invalid security code. Please try again.";
      setErrorMessage(errorMsg);
      setAttempts(prev => prev + 1);
      setOtp("");
      inputRef.current?.focus();
      setStatus("pending");

      if (attempts >= 2) {
        setStatus("failed");
        if (timerRef.current) clearInterval(timerRef.current);
        toast.error("Too many failed attempts. Transaction blocked.");
        onFail();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (status === "success") {
    return (
      <div className="text-center space-y-4" role="status" aria-live="polite">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-muted">
          <CheckCircle className="h-8 w-8 text-success" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-success">Verification Successful</h3>
        <p className="text-sm text-muted-foreground">
          Your identity has been verified. Transaction approved.
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="text-center space-y-4" role="status" aria-live="polite">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-muted">
          <XCircle className="h-8 w-8 text-danger" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-danger">Verification Failed</h3>
        <p className="text-sm text-muted-foreground">
          {timeLeft === 0 ? "Verification code has expired." : "Too many failed attempts."} Transaction blocked.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Screen reader announcer */}
      <div ref={announcerRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-warning-muted mb-2">
          <Shield className="h-6 w-6 text-warning" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold">Step-Up Verification Required</h3>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to your email to verify this transaction
        </p>
      </div>

      {/* Timer */}
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" aria-hidden="true" />
        <span className={timeLeft <= 30 ? "text-danger font-medium" : ""}>
          Time remaining: {formatTime(timeLeft)}
        </span>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{errorMessage}</p>
        </div>
      )}

      {/* OTP Input */}
      <div className="space-y-2">
        <Label htmlFor="otp">Verification Code</Label>
        <Input
          ref={inputRef}
          id="otp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter 6-digit code"
          className="text-center font-mono text-xl tracking-widest"
          aria-describedby="otp-hint"
          autoComplete="one-time-code"
          disabled={status === "verifying"}
        />
        <p id="otp-hint" className="text-xs text-muted-foreground text-center">
          {attempts > 0 && (
            <span className="text-danger">
              Incorrect code. {3 - attempts} attempt{3 - attempts !== 1 ? "s" : ""} remaining.
            </span>
          )}
        </p>
      </div>

      <Button
        onClick={handleVerify}
        disabled={otp.length !== 6 || status === "verifying"}
        className="w-full"
      >
        {status === "verifying" ? (
          <>
            <Loader className="mr-2 h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          "Verify"
        )}
      </Button>
    </div>
  );
}
