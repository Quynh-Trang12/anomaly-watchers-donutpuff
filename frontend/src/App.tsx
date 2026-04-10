import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Simulate from "./pages/Simulate";
import History from "./pages/History";
import Admin from "./pages/Admin";
import Result from "./pages/Result";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Dashboard from "./components/Dashboard";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "./context/AuthContext";
import { AnimatePresence } from "framer-motion";

// ─── Route Protection Component ──────────────────────────────────────────────
function ProtectedRoute({ 
  allowedRoles, 
  children 
}: { 
  allowedRoles: ("USER" | "ADMIN")[]; 
  children: React.ReactNode 
}) {
  const { role } = useAuth();
  
  if (!allowedRoles.includes(role)) {
    // Redirect based on current role's natural landing spot
    return <Navigate to={role === "ADMIN" ? "/dashboard" : "/simulate"} replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          
          {/* Admin Restricted Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Admin />
              </ProtectedRoute>
            } 
          />

          {/* User Restricted Routes */}
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

          {/* Shared / Public History */}
          <Route path="/history" element={<History />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
      <Toaster position="top-right" richColors closeButton />
    </Router>
  );
}

export default App;
