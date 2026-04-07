import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, Truck, ShieldCheck, FileText, ClipboardCheck,
  DollarSign, History, Loader2, AlertTriangle, Upload, Plus, X, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";

const statusStyles: Record<string, string> = {
  compliant: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  critical: "bg-destructive/20 text-destructive",
  expired: "bg-destructive/30 text-destructive",
};

const conditionColors: Record<string, string> = {
  good: "bg-success/20 text-success",
  fair: "bg-warning/20 text-warning",
  poor: "bg-destructive/20 text-destructive",
  unroadworthy: "bg-destructive/30 text-destructive",
};

function riskColor(score: number) {
  if (score <= 25) return "text-success";
  if (score <= 50) return "text-warning";
  return "text-destructive";
}

function riskBg(score: number) {
  if (score <= 25) return "bg-success/20 text-success";
  if (score <= 50) return "bg-warning/20 text-warning";
  return "bg-destructive/20 text-destructive";
}

function kmColor(km: number) {
  if (km > 2000) return "text-success";
  if (km > 500) return "text-warning";
  return "text-destructive";
}

function kmProgressColor(km: number) {
  if (km > 2000) return "bg-success";
  if (km > 500) return "bg-warning";
  return "bg-destructive";
}

const tabs = [
  { id: "overview", label: "Overview", icon: Truck },
  { id: "certificates", label: "Certificates", icon: FileText },
  { id: "inspections", label: "Inspections", icon: ClipboardCheck },
  { id: "fines", label: "Fines", icon: DollarSign },
  { id: "history", label: "History", icon: History },
];

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showOdometer, setShowOdometer] = useState(false);
  const [odometerValue, setOdometerValue] = useState("");
  const [savingOdometer, setSavingOdometer] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);

  const openPdf = async (fileUrl: string | null) => {
    if (!fileUrl) { toast.error("No file attached"); return; }
    const { data } = await supabase.storage.from("documents").createSignedUrl(fileUrl, 3600);
    if (data?.signedUrl) setViewingPdf(data.signedUrl);
    else toast.error("Could not load file");
  };

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, branches(name), compliance_templates(template_name, required_certificates)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: certificates } = useQuery({
    queryKey: ["vehicle_certificates", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("vehicle_id", id!)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: inspections } = useQuery({
    queryKey: ["vehicle_inspections", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_inspections")
        .select("*, inspector:users!damage_inspections_inspector_id_fkey(full_name)")
        .eq("vehicle_id", id!)
        .order("inspection_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: fines } = useQuery({
    queryKey: ["vehicle_fines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select("*, drivers(full_name)")
        .eq("vehicle_id", id!)
        .order("offence_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["vehicle_audit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*, user:users!audit_log_user_id_fkey(full_name)")
        .eq("table_name", "vehicles")
        .eq("record_id", id!)
        .order("timestamp", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleUpdateOdometer = async () => {
    const km = parseInt(odometerValue);
    if (isNaN(km) || km < 0) {
      toast.error("Enter a valid KM reading");
      return;
    }
    setSavingOdometer(true);
    const { error } = await supabase
      .from("vehicles")
      .update({ current_odometer_km: km })
      .eq("id", id!);
    setSavingOdometer(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Odometer updated");
      setShowOdometer(false);
      setOdometerValue("");
      queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-6">
        <button onClick={() => navigate("/vehicles")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Vehicles
        </button>
        <p className="text-muted-foreground">Vehicle not found.</p>
      </div>
    );
  }

  const lastServiceKm = vehicle.last_service_km ?? 0;
  const currentKm = vehicle.current_odometer_km ?? 0;
  const nextServiceKm = vehicle.next_service_due_km ?? 0;
  const kmRemaining = vehicle.km_until_service ?? (nextServiceKm - currentKm);
  const serviceRange = nextServiceKm - lastServiceKm;
  const serviceProgress = serviceRange > 0 ? Math.min(100, Math.max(0, ((currentKm - lastServiceKm) / serviceRange) * 100)) : 0;

  // Missing certificates check
  const requiredCerts = (vehicle as any).compliance_templates?.required_certificates as string[] | null;
  const existingCertTypes = (certificates || []).map((c) => c.certificate_type.toLowerCase());
  const missingCerts = (requiredCerts || []).filter((r: string) => !existingCertTypes.includes(r.toLowerCase()));

  const totalOutstandingFines = (fines || [])
    .filter((f) => f.payment_status !== "paid")
    .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/vehicles")} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{vehicle.registration_number}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${statusStyles[vehicle.compliance_status || "compliant"]}`}>
              {vehicle.compliance_status || "compliant"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ""} · {vehicle.fleet_number || "No fleet number"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vehicle Info */}
          <div className="stat-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground mb-4">Vehicle Information</h3>
            <InfoRow label="Registration" value={vehicle.registration_number} />
            <InfoRow label="Fleet Number" value={vehicle.fleet_number || "-"} />
            <InfoRow label="Make" value={vehicle.make || "-"} />
            <InfoRow label="Model" value={vehicle.model || "-"} />
            <InfoRow label="Year" value={vehicle.year?.toString() || "-"} />
            <InfoRow label="VIN" value={vehicle.vin_number || "-"} />
            <InfoRow label="Colour" value={vehicle.colour || "-"} />
            <InfoRow label="Vehicle Type" value={vehicle.vehicle_type || "-"} />
            <InfoRow label="Branch" value={(vehicle as any).branches?.name || "-"} />
          </div>

          {/* Service & Risk */}
          <div className="space-y-4">
            {/* KM Service Tracker */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Service Tracker</h3>
                <button
                  onClick={() => { setShowOdometer(true); setOdometerValue(currentKm.toString()); }}
                  className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90"
                >
                  Update Odometer
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Last Service: {lastServiceKm.toLocaleString()} km</span>
                  <span>Next Due: {nextServiceKm.toLocaleString()} km</span>
                </div>
                <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${kmProgressColor(kmRemaining)}`}
                    style={{ width: `${serviceProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current: {currentKm.toLocaleString()} km</span>
                  <span className={`text-lg font-bold ${kmColor(kmRemaining)}`}>
                    {kmRemaining.toLocaleString()} km remaining
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Score */}
            <div className="stat-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Risk Assessment</h3>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${riskBg(vehicle.risk_score ?? 0)}`}>
                  {vehicle.risk_score ?? 0}
                </div>
                <div>
                  <p className={`text-lg font-semibold ${riskColor(vehicle.risk_score ?? 0)}`}>
                    {(vehicle.risk_score ?? 0) <= 25 ? "Low Risk" : (vehicle.risk_score ?? 0) <= 50 ? "Medium Risk" : "High Risk"}
                  </p>
                  <p className="text-xs text-muted-foreground">Based on compliance, service, fines & damage</p>
                </div>
              </div>
            </div>

            {/* Compliance Status */}
            <div className="stat-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Compliance Status</h3>
              <div className="flex items-center gap-3">
                <ShieldCheck className={`w-8 h-8 ${riskColor(vehicle.risk_score ?? 0)}`} />
                <div>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full uppercase ${statusStyles[vehicle.compliance_status || "compliant"]}`}>
                    {vehicle.compliance_status || "compliant"}
                  </span>
                  {(vehicle as any).compliance_templates?.template_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Template: {(vehicle as any).compliance_templates.template_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "certificates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Certificates ({(certificates || []).length})</h3>
          </div>

          {/* Missing certificates */}
          {missingCerts.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">Missing Required Certificates</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {missingCerts.map((c: string) => (
                  <span key={c} className="bg-destructive/20 text-destructive text-xs font-semibold px-2 py-1 rounded">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card overflow-hidden">
            {(certificates || []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No certificates found for this vehicle.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Number</th>
                     <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Expiry</th>
                     <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Days Left</th>
                     <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                     <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">View</th>
                  </tr>
                </thead>
                <tbody>
                  {(certificates || []).map((cert) => {
                    const days = cert.expiry_date
                      ? Math.ceil((new Date(cert.expiry_date).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <tr key={cert.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{cert.certificate_type}</td>
                        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{cert.certificate_number || "-"}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{cert.expiry_date || "-"}</td>
                        <td className="px-4 py-3 text-right">
                          {days !== null && (
                            <span className={`text-sm font-semibold ${days <= 0 ? "text-destructive" : days <= 30 ? "text-warning" : "text-success"}`}>
                              {days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            cert.status === "valid" ? "bg-success/20 text-success" :
                            cert.status === "expired" ? "bg-destructive/20 text-destructive" :
                            "bg-warning/20 text-warning"
                          }`}>
                            {cert.status || "valid"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => openPdf(cert.file_url)} className="text-muted-foreground hover:text-primary transition-colors" title="View document">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "inspections" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Inspections ({(inspections || []).length})</h3>
          </div>
          <div className="glass-card overflow-hidden">
            {(inspections || []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No inspections recorded.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Inspector</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Condition</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Damage Items</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">New Items</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(inspections || []).map((insp) => (
                    <tr key={insp.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-foreground">{insp.inspection_date}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{(insp as any).inspector?.full_name || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-1 rounded capitalize ${conditionColors[insp.overall_condition || "good"]}`}>
                          {insp.overall_condition}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-foreground">{insp.total_damage_items ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-foreground">{insp.new_damage_items ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          insp.status === "completed" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                        }`}>
                          {insp.status || "draft"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "fines" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Fines ({(fines || []).length})</h3>
            {totalOutstandingFines > 0 && (
              <span className="text-sm font-bold text-destructive">
                Outstanding: R {totalOutstandingFines.toLocaleString()}
              </span>
            )}
          </div>
          <div className="glass-card overflow-hidden">
            {(fines || []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No fines recorded.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Fine No.</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Authority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Demerits</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(fines || []).map((fine) => (
                    <tr key={fine.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{fine.fine_number || "-"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{fine.issuing_authority || "-"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{fine.offence_date || "-"}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-foreground">R {(Number(fine.amount) || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-foreground">{fine.demerit_points_applied ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          fine.payment_status === "paid" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                        }`}>
                          {fine.payment_status || "unpaid"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Audit History</h3>
          <div className="glass-card">
            {(auditLogs || []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No audit history found.</p>
            ) : (
              <div className="divide-y divide-border">
                {(auditLogs || []).map((log) => (
                  <div key={log.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground capitalize">{log.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      By: {(log as any).user?.full_name || "System"}
                    </p>
                    {log.old_values && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">View changes</summary>
                        <div className="mt-1 grid grid-cols-2 gap-2 bg-secondary/50 rounded p-2">
                          <div>
                            <p className="font-semibold text-foreground">Before</p>
                            <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(log.old_values, null, 2)}</pre>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">After</p>
                            <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(log.new_values, null, 2)}</pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Odometer Update Modal */}
      {showOdometer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="bg-card border border-border rounded-lg p-6 w-96 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Update Odometer</h3>
              <button onClick={() => setShowOdometer(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Current KM Reading</label>
              <input
                type="number"
                value={odometerValue}
                onChange={(e) => setOdometerValue(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter current KM"
              />
            </div>
            <button
              onClick={handleUpdateOdometer}
              disabled={savingOdometer}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingOdometer && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}
      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="relative w-[90vw] h-[90vh] bg-card border border-border rounded-lg shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Document Viewer</h3>
              <button onClick={() => setViewingPdf(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe src={viewingPdf} className="flex-1 w-full rounded-b-lg" title="PDF Viewer" />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
