import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import Drivers from "./pages/Drivers";
import DriverDetail from "./pages/DriverDetail";
import Certificates from "./pages/Certificates";
import ComplianceTemplates from "./pages/ComplianceTemplates";
import Inspections from "./pages/Inspections";
import Fines from "./pages/Fines";
import Reports from "./pages/Reports";
import Alerts from "./pages/Alerts";
import SettingsPage from "./pages/SettingsPage";
import AdminPanel from "./pages/AdminPanel";
import VehicleDetail from "./pages/VehicleDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/vehicles/:id" element={<VehicleDetail />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/drivers/:id" element={<DriverDetail />} />
              <Route path="/certificates" element={<Certificates />} />
              <Route path="/compliance-templates" element={<ComplianceTemplates />} />
              <Route path="/inspections" element={<Inspections />} />
              <Route path="/fines" element={<Fines />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin" element={<AdminPanel />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
