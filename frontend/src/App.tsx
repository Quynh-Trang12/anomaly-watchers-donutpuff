import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Simulate from "./pages/Simulate";
import History from "./pages/History";
import Result from "./pages/Result";
import NotFound from "./pages/NotFound";
import { Toaster } from "@/components/ui/sonner";

import Dashboard from "./components/Dashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/simulate" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/simulate" element={<Simulate />} />
        <Route path="/result" element={<Result />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
