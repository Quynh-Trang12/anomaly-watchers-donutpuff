import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Landing from "./pages/Landing";
import Simulate from "./pages/Simulate";
import History from "./pages/History";
import Admin from "./pages/Admin";
import Result from "./pages/Result";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "./components/Dashboard";
import { getCurrentRole, isAuthenticated } from "@/lib/auth";

function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const role = getCurrentRole();

  if (role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/simulate"
          element={
            <RequireAuth>
              <Simulate />
            </RequireAuth>
          }
        />
        <Route
          path="/result"
          element={
            <RequireAuth>
              <Result />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <History />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
