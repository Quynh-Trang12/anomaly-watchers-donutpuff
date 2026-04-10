import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Simulate from "./pages/Simulate";
import History from "./pages/History";
import Admin from "./pages/Admin";
import Result from "./pages/Result";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "./context/AuthContext";

import Dashboard from "./components/Dashboard";

// ─── Route Protection ────────────────────────────────────────────────────────

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: ("USER" | "ADMIN")[];
  children: React.ReactNode;
}) {
  const { role } = useAuth();
  if (!allowedRoles.includes(role)) {
    return <Navigate to={role === "ADMIN" ? "/dashboard" : "/simulate"} replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/simulate"
          element={
            <ProtectedRoute allowedRoles={["USER"]}>
              <Simulate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/result"
          element={
            <ProtectedRoute allowedRoles={["USER"]}>
              <Result />
            </ProtectedRoute>
          }
        />
        <Route path="/history" element={<History />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
