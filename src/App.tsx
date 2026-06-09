import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { InstallPrompt } from "@/components/InstallPrompt";
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
import DriverComplianceReport from "./pages/DriverComplianceReport";
import Alerts from "./pages/Alerts";
import SettingsPage from "./pages/SettingsPage";
import AdminPanel from "./pages/AdminPanel";
import VehicleDetail from "./pages/VehicleDetail";
import InspectionDetail from "./pages/InspectionDetail";
import DataImport from "./pages/DataImport";
import DoctorDemo from "./pages/DoctorDemo";
import FridgeTracker from "./pages/FridgeTracker";
import JobCardForm from "./pages/JobCardForm";
import TechnicianHome from "./pages/TechnicianHome";
import ControlTower from "./pages/ControlTower";
import HSFile from "./pages/HSFile";
import Maintenance from "./pages/Maintenance";
import Compliance from "./pages/Compliance";
import FleetAvailability from "./pages/FleetAvailability";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  },
});

const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InstallPrompt />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/demo/healthcare" element={<DoctorDemo />} />
            <Route path="/tech" element={<ProtectedRoute><TechnicianHome /></ProtectedRoute>} />
            <Route path="/job-card/new" element={<ProtectedRoute><JobCardForm /></ProtectedRoute>} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/vehicles/:id" element={<VehicleDetail />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/drivers/:id" element={<DriverDetail />} />
              <Route path="/certificates" element={<Certificates />} />
              <Route path="/compliance-templates" element={<ComplianceTemplates />} />
              <Route path="/inspections" element={<Inspections />} />
              <Route path="/inspections/:id" element={<InspectionDetail />} />
              <Route path="/fines" element={<Fines />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/driver-compliance" element={<DriverComplianceReport />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/fridge-tracker" element={<FridgeTracker />} />
              <Route path="/control-tower" element={<ControlTower />} />
              <Route path="/hs-file" element={<HSFile />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/fleet-availability" element={<FleetAvailability />} />
              <Route path="/import" element={<DataImport />} />
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
};

export default App;
