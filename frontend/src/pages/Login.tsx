import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { clearCurrentRole, getCurrentRole, setCurrentRole } from "@/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentRole = getCurrentRole();

  const nextPath = useMemo(() => {
    const candidate = searchParams.get("next") || "/simulate";
    return candidate.startsWith("/") ? candidate : "/simulate";
  }, [searchParams]);

  const handleSelectRole = (role: "user" | "admin") => {
    setCurrentRole(role);

    if (role !== "admin" && nextPath === "/admin") {
      navigate("/simulate", { replace: true });
      return;
    }

    navigate(nextPath, { replace: true });
  };

  const handleSignOut = () => {
    clearCurrentRole();
    navigate("/", { replace: true });
  };

  return (
    <Layout>
      <div className="container py-8 sm:py-10">
        <div className="max-w-xl mx-auto section-card space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Demo Role Access</h1>
            <p className="text-sm text-muted-foreground">
              This project uses demo RBAC for assignment scope. Choose a role
              to continue.
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            Current role:{" "}
            <span className="font-semibold uppercase">
              {currentRole === "guest" ? "NOT SIGNED IN" : currentRole}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Button onClick={() => handleSelectRole("user")} variant="outline">
              Continue as User
            </Button>
            <Button onClick={() => handleSelectRole("admin")}>
              Continue as Admin
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Admin pages require role = admin
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

