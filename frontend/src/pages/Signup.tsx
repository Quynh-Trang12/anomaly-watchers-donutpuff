import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearAuthSession,
  getCurrentUser,
  isAuthenticated,
  setAuthSession,
} from "@/lib/auth";
import { fetchCurrentUser, signup } from "@/api";
import { clearPendingTransaction } from "@/lib/storage";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as any).response === "object"
  ) {
    const responseData = (error as any).response?.data;
    const detail = responseData?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      const field =
        Array.isArray(first?.loc)
          ? first.loc
              .filter((part: unknown) => part !== "body")
              .join(".")
          : "";
      const message = typeof first?.msg === "string" ? first.msg : "";

      if (field && message) {
        return `${field}: ${message}`;
      }
      if (message) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Sign up failed. Please check your inputs and try again.";
}

export default function Signup() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupDisplayName, setSignupDisplayName] = useState("");
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const handleLogout = () => {
    clearAuthSession();
    clearPendingTransaction();
    navigate("/signup", { replace: true });
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignupError(null);
    setIsSignupSubmitting(true);

    try {
      const response = await signup({
        username: signupUsername,
        password: signupPassword,
        email: signupEmail,
        displayName: signupDisplayName || undefined,
      });
      setAuthSession(response.access_token, response.user);
      clearPendingTransaction();

      try {
        const me = await fetchCurrentUser();
        setAuthSession(response.access_token, me);
      } catch {
        // Keep signup response user as fallback if /auth/me check fails.
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setSignupError(getErrorMessage(err));
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const continuePath =
    currentUser?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <Layout>
      <div className="container py-8 sm:py-10">
        <div className="max-w-xl mx-auto section-card space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Sign Up</h1>
            <p className="text-sm text-muted-foreground">
              Create a user account. Your email is used for Medium Risk alert and OTP emails.
            </p>
          </div>

          {isAuthenticated() && currentUser && (
            <div className="rounded-md border border-success/30 bg-success-muted p-3 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                Signed in as{" "}
                <span className="font-semibold">
                  {currentUser.displayName || currentUser.username}
                </span>{" "}
                (
                <span className="font-mono uppercase">{currentUser.role}</span>)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(continuePath)}
                >
                  Continue
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSignupSubmit}>
            <div className="space-y-2">
              <Label htmlFor="signup-display-name">Display Name (optional)</Label>
              <Input
                id="signup-display-name"
                value={signupDisplayName}
                onChange={(event) => setSignupDisplayName(event.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-username">Username</Label>
              <Input
                id="signup-username"
                value={signupUsername}
                onChange={(event) => setSignupUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>

            {signupError && (
              <div className="rounded-md border border-danger/30 bg-danger-muted p-3 text-sm text-danger">
                {signupError}
              </div>
            )}

            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={isSignupSubmitting}
            >
              {isSignupSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="border-t border-border pt-5">
            <p className="text-sm text-muted-foreground mb-3">
              Already have an account?
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Go to Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
