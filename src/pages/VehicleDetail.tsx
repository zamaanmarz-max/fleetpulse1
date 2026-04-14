import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, Truck, ShieldCheck, FileText, ClipboardCheck,
  DollarSign, History, Loader2, AlertTriangle, X, Eye, Pencil, Save, Trash2,
  ArrowRightLeft, Wrench,
} from "lucide-react";
import { ComplianceRequirements } from "@/components/vehicle/ComplianceRequirements";
import { EquipmentChecklist } from "@/components/vehicle/EquipmentChecklist";
import { JobCardsTab } from "@/components/vehicle/JobCardsTab";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

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
  { id: "jobcards", label: "Job Cards", icon: Wrench },
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [certForm, setCertForm] = useState<Record<string, any>>({});
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certSaving, setCertSaving] = useState(false);
  const [deleteCertId, setDeleteCertId] = useState<string | null>(null);
  const [deletingCert, setDeletingCert] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferBranch, setTransferBranch] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [transferring, setTransferring] = useState(false);
  const [editEquipment, setEditEquipment] = useState<string[]>([]);

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
      const { data, error } = await supabase.from("certificates").select("*").eq("vehicle_id", id!).order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: inspections } = useQuery({
    queryKey: ["vehicle_inspections", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("damage_inspections").select("*, inspector:users!damage_inspections_inspector_id_fkey(full_name)").eq("vehicle_id", id!).order("inspection_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: fines } = useQuery({
    queryKey: ["vehicle_fines", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("fines").select("*, drivers(full_name)").eq("vehicle_id", id!).order("offence_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["vehicle_audit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*, user:users!audit_log_user_id_fkey(full_name)").eq("table_name", "vehicles").eq("record_id", id!).order("timestamp", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleUpdateOdometer = async () => {
    const km = parseInt(odometerValue);
    if (isNaN(km) || km < 0) { toast.error("Enter a valid KM reading"); return; }
    setSavingOdometer(true);
    const { error } = await supabase.from("vehicles").update({ current_odometer_km: km }).eq("id", id!);
    setSavingOdometer(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Odometer updated");
      setShowOdometer(false); setOdometerValue("");
      queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    }
  };

  const startEditing = () => {
    if (!vehicle) return;
    setEditForm({
      registration_number: vehicle.registration_number || "",
      fleet_number: vehicle.fleet_number || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      year: vehicle.year?.toString() || "",
      vin_number: vehicle.vin_number || "",
      colour: vehicle.colour || "",
      vehicle_type: vehicle.vehicle_type || "",
      current_odometer_km: vehicle.current_odometer_km?.toString() || "0",
      last_service_km: vehicle.last_service_km?.toString() || "0",
      next_service_due_km: vehicle.next_service_due_km?.toString() || "0",
    });
    setEditEquipment((vehicle.equipment as string[]) || []);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    const { error } = await supabase.from("vehicles").update({
      registration_number: editForm.registration_number,
      fleet_number: editForm.fleet_number || null,
      make: editForm.make || null,
      model: editForm.model || null,
      year: editForm.year ? parseInt(editForm.year) : null,
      vin_number: editForm.vin_number || null,
      colour: editForm.colour || null,
      vehicle_type: editForm.vehicle_type || null,
      current_odometer_km: parseInt(editForm.current_odometer_km) || 0,
      last_service_km: parseInt(editForm.last_service_km) || 0,
      next_service_due_km: parseInt(editForm.next_service_due_km) || 0,
      equipment: editEquipment,
    }).eq("id", id!);
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Vehicle updated successfully");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    }
  };

  const startEditCert = (cert: any) => {
    setEditingCertId(cert.id);
    setCertForm({
      certificate_number: cert.certificate_number || "",
      issue_date: cert.issue_date || "",
      expiry_date: cert.expiry_date || "",
      issuing_authority: cert.issuing_authority || "",
    });
    setCertFile(null);
  };

  const handleSaveCert = async () => {
    if (!editingCertId) return;
    setCertSaving(true);
    let fileUrl: string | undefined;
    if (certFile && vehicle) {
      const path = `${vehicle.organisation_id}/certificates/${editingCertId}/${Date.now()}_${certFile.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, certFile);
      if (!upErr) fileUrl = path;
    }
    const updateData: any = {
      certificate_number: certForm.certificate_number || null,
      issue_date: certForm.issue_date || null,
      expiry_date: certForm.expiry_date || null,
      issuing_authority: certForm.issuing_authority || null,
    };
    if (fileUrl) updateData.file_url = fileUrl;
    if (certForm.expiry_date) {
      const days = Math.ceil((new Date(certForm.expiry_date).getTime() - Date.now()) / 86400000);
      updateData.status = days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid";
      updateData.days_until_expiry = days;
    }
    const { error } = await supabase.from("certificates").update(updateData).eq("id", editingCertId);
    setCertSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Certificate updated");
      setEditingCertId(null);
      queryClient.invalidateQueries({ queryKey: ["vehicle_certificates", id] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    }
  };

  const handleDeleteCert = async () => {
    if (!deleteCertId) return;
    setDeletingCert(true);
    const { error } = await supabase.from("certificates").delete().eq("id", deleteCertId);
    setDeletingCert(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Certificate deleted");
      setDeleteCertId(null);
      queryClient.invalidateQueries({ queryKey: ["vehicle_certificates", id] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    }
  };

  const handleTransfer = async () => {
    if (!transferBranch || !vehicle) return;
    setTransferring(true);
    const oldBranchName = (vehicle as any).branches?.name || "None";
    const newBranch = (branches || []).find(b => b.id === transferBranch);
    const { error } = await supabase.from("vehicles").update({ branch_id: transferBranch }).eq("id", id!);
    if (!error) {
      await supabase.from("audit_log").insert({
        organisation_id: vehicle.organisation_id,
        table_name: "vehicles",
        record_id: id,
        action: "transfer",
        user_id: profile?.id,
        old_values: { branch: oldBranchName },
        new_values: { branch: newBranch?.name, date: transferDate, reason: transferReason },
      });
      toast.success(`Vehicle transferred to ${newBranch?.name}`);
      setShowTransfer(false);
      queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
      queryClient.invalidateQueries({ queryKey: ["vehicle_audit", id] });
    } else { toast.error(error.message); }
    setTransferring(false);
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!vehicle) {
    return (
      <div className="p-6">
        <button onClick={() => navigate("/vehicles")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
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

  const requiredCerts = (vehicle as any).compliance_templates?.required_certificates as string[] | null;
  const existingCertTypes = (certificates || []).map(c => c.certificate_type.toLowerCase());
  const missingCerts = (requiredCerts || []).filter((r: string) => !existingCertTypes.includes(r.toLowerCase()));

  const totalOutstandingFines = (fines || []).filter(f => f.payment_status !== "paid").reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const missingVin = !vehicle.vin_number;
  const noTemplate = !vehicle.compliance_template_id;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/vehicles")} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{vehicle.registration_number}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${statusStyles[vehicle.compliance_status || "compliant"]}`}>{vehicle.compliance_status || "compliant"}</span>
            {missingVin && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-warning/20 text-warning uppercase">Missing VIN</span>}
            {noTemplate && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-warning/20 text-warning uppercase">No Template</span>}
          </div>
          <p className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ""} · {vehicle.fleet_number || "No fleet number"}</p>
        </div>
        <button onClick={() => setShowTransfer(true)} className="flex items-center gap-2 text-sm bg-secondary text-foreground px-4 py-2 rounded-lg hover:bg-secondary/80 border border-border">
          <ArrowRightLeft className="w-4 h-4" /> Transfer
        </button>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="stat-card space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">Vehicle Information</h3>
              {!editing ? (
                <button onClick={startEditing} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90"><Pencil className="w-3.5 h-3.5" /> Edit</button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border">Cancel</button>
                  <button onClick={handleSaveEdit} disabled={saving} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save</button>
                </div>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                {[
                  { label: "Registration", key: "registration_number" },
                  { label: "Fleet Number", key: "fleet_number" },
                  { label: "Make", key: "make" },
                  { label: "Model", key: "model" },
                  { label: "Year", key: "year", type: "number" },
                  { label: "VIN Number", key: "vin_number" },
                  { label: "Colour", key: "colour" },
                  { label: "Vehicle Type", key: "vehicle_type" },
                  { label: "Current KM", key: "current_odometer_km", type: "number" },
                  { label: "Last Service KM", key: "last_service_km", type: "number" },
                  { label: "Next Service KM", key: "next_service_due_km", type: "number" },
                ].map(f => (
                  <EditField key={f.key} label={f.label} value={editForm[f.key]} onChange={v => setEditForm({ ...editForm, [f.key]: v })} type={f.type} />
                ))}
                <EquipmentChecklist selected={editEquipment} onChange={setEditEquipment} />
              </div>
            ) : (
              <>
                <InfoRow label="Registration" value={vehicle.registration_number} />
                <InfoRow label="Fleet Number" value={vehicle.fleet_number || "-"} />
                <InfoRow label="Make" value={vehicle.make || "-"} />
                <InfoRow label="Model" value={vehicle.model || "-"} />
                <InfoRow label="Year" value={vehicle.year?.toString() || "-"} />
                <InfoRow label="VIN" value={vehicle.vin_number || "-"} warn={missingVin} />
                <InfoRow label="Colour" value={vehicle.colour || "-"} />
                <InfoRow label="Type" value={vehicle.vehicle_type || "-"} />
                <InfoRow label="Branch" value={(vehicle as any).branches?.name || "-"} />
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Service Tracker</h3>
                <button onClick={() => { setShowOdometer(true); setOdometerValue(currentKm.toString()); }} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90">Update Odometer</button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground"><span>Last: {lastServiceKm.toLocaleString()} km</span><span>Next: {nextServiceKm.toLocaleString()} km</span></div>
                <div className="relative h-3 bg-secondary rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${kmProgressColor(kmRemaining)}`} style={{ width: `${serviceProgress}%` }} /></div>
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Current: {currentKm.toLocaleString()} km</span><span className={`text-lg font-bold ${kmColor(kmRemaining)}`}>{kmRemaining.toLocaleString()} km remaining</span></div>
              </div>
            </div>

            <div className="stat-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Risk Assessment</h3>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${riskBg(vehicle.risk_score ?? 0)}`}>{vehicle.risk_score ?? 0}</div>
                <div>
                  <p className={`text-lg font-semibold ${riskColor(vehicle.risk_score ?? 0)}`}>{(vehicle.risk_score ?? 0) <= 25 ? "Low Risk" : (vehicle.risk_score ?? 0) <= 50 ? "Medium Risk" : "High Risk"}</p>
                  <p className="text-xs text-muted-foreground">Based on compliance, service, fines & damage</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Compliance Status</h3>
              <div className="flex items-center gap-3">
                <ShieldCheck className={`w-8 h-8 ${riskColor(vehicle.risk_score ?? 0)}`} />
                <div>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full uppercase ${statusStyles[vehicle.compliance_status || "compliant"]}`}>{vehicle.compliance_status || "compliant"}</span>
                  {(vehicle as any).compliance_templates?.template_name && <p className="text-xs text-muted-foreground mt-1">Template: {(vehicle as any).compliance_templates.template_name}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "certificates" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Certificates ({(certificates || []).length})</h3>
          
          {/* Required certificates from template */}
          {requiredCerts && requiredCerts.length > 0 && (
            <div className="stat-card">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Required by Template: {(vehicle as any).compliance_templates?.template_name}</h4>
              <div className="flex flex-wrap gap-2">
                {requiredCerts.map((reqCert: string) => {
                  const existing = (certificates || []).find(c => c.certificate_type.toLowerCase() === reqCert.toLowerCase());
                  let badgeClass = "bg-destructive/20 text-destructive";
                  let badgeText = "Missing";
                  if (existing) {
                    const days = existing.expiry_date ? Math.ceil((new Date(existing.expiry_date).getTime() - Date.now()) / 86400000) : null;
                    if (days !== null && days <= 0) {
                      badgeClass = "bg-destructive/20 text-destructive";
                      badgeText = "Expired";
                    } else if (days !== null && days <= 30) {
                      badgeClass = "bg-warning/20 text-warning";
                      badgeText = `Expiring (${days}d)`;
                    } else {
                      badgeClass = "bg-success/20 text-success";
                      badgeText = "Valid";
                    }
                  }
                  return (
                    <div key={reqCert} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                      <span className="text-sm text-foreground">{reqCert}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>{badgeText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {missingCerts.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-destructive" /><span className="text-sm font-semibold text-destructive">Missing Required Certificates</span></div>
              <div className="flex flex-wrap gap-2">{missingCerts.map((c: string) => <span key={c} className="bg-destructive/20 text-destructive text-xs font-semibold px-2 py-1 rounded">{c}</span>)}</div>
            </div>
          )}
          <div className="glass-card overflow-hidden">
            {(certificates || []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No certificates found.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Number</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Expiry</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Days</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(certificates || []).map(cert => {
                    const days = cert.expiry_date ? Math.ceil((new Date(cert.expiry_date).getTime() - Date.now()) / 86400000) : null;
                    const isEditing = editingCertId === cert.id;
                    return (
                      <tr key={cert.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{cert.certificate_type}</td>
                        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{isEditing ? <input type="text" value={certForm.certificate_number} onChange={e => setCertForm({ ...certForm, certificate_number: e.target.value })} className="bg-secondary border border-border rounded px-2 py-1 text-sm w-full" /> : (cert.certificate_number || "-")}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{isEditing ? <input type="date" value={certForm.expiry_date} onChange={e => setCertForm({ ...certForm, expiry_date: e.target.value })} className="bg-secondary border border-border rounded px-2 py-1 text-sm" /> : (cert.expiry_date || "-")}</td>
                        <td className="px-4 py-3 text-right">{days !== null && <span className={`text-sm font-semibold ${days <= 0 ? "text-destructive" : days <= 30 ? "text-warning" : "text-success"}`}>{days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`}</span>}</td>
                        <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${cert.status === "valid" ? "bg-success/20 text-success" : cert.status === "expired" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>{cert.status || "valid"}</span></td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-center">
                              <input type="file" accept=".pdf" onChange={e => setCertFile(e.target.files?.[0] || null)} className="text-xs w-24" />
                              <button onClick={handleSaveCert} disabled={certSaving} className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90">{certSaving ? "..." : "Save"}</button>
                              <button onClick={() => setEditingCertId(null)} className="text-xs text-muted-foreground px-2 py-1">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-center">
                              <button onClick={() => openPdf(cert.file_url)} className="text-muted-foreground hover:text-primary" title="View"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => startEditCert(cert)} className="text-muted-foreground hover:text-primary" title="Edit"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => setDeleteCertId(cert.id)} className="text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          )}
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
          <h3 className="text-sm font-semibold text-foreground">Inspections ({(inspections || []).length})</h3>
          <div className="glass-card overflow-hidden">
            {(inspections || []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No inspections recorded.</p>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Inspector</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Condition</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Items</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr></thead>
                <tbody>
                  {(inspections || []).map(insp => (
                    <tr key={insp.id} onClick={() => navigate(`/inspections/${insp.id}`)} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-sm text-foreground">{insp.inspection_date}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{(insp as any).inspector?.full_name || "-"}</td>
                      <td className="px-4 py-3 text-center"><span className={`text-xs font-medium px-2 py-1 rounded capitalize ${conditionColors[insp.overall_condition || "good"]}`}>{insp.overall_condition}</span></td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-foreground">{insp.total_damage_items ?? 0}</td>
                      <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${insp.status === "completed" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>{insp.status || "draft"}</span></td>
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
            {totalOutstandingFines > 0 && <span className="text-sm font-bold text-destructive">Outstanding: R {totalOutstandingFines.toLocaleString()}</span>}
          </div>
          <div className="glass-card overflow-hidden">
            {(fines || []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No fines recorded.</p>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Fine No.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Authority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr></thead>
                <tbody>
                  {(fines || []).map(fine => (
                    <tr key={fine.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{fine.fine_number || "-"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{fine.issuing_authority || "-"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{fine.offence_date || "-"}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-foreground">R {(Number(fine.amount) || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${fine.payment_status === "paid" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>{fine.payment_status || "unpaid"}</span></td>
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
                {(auditLogs || []).map(log => (
                  <div key={log.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between"><span className="text-sm font-medium text-foreground capitalize">{log.action}</span><span className="text-xs text-muted-foreground">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}</span></div>
                    <p className="text-xs text-muted-foreground">By: {(log as any).user?.full_name || "System"}</p>
                    {log.old_values && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">View changes</summary>
                        <div className="mt-1 grid grid-cols-2 gap-2 bg-secondary/50 rounded p-2">
                          <div><p className="font-semibold text-foreground">Before</p><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(log.old_values, null, 2)}</pre></div>
                          <div><p className="font-semibold text-foreground">After</p><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(log.new_values, null, 2)}</pre></div>
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

      {showOdometer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="bg-card border border-border rounded-lg p-6 w-96 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-foreground">Update Odometer</h3><button onClick={() => setShowOdometer(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button></div>
            <div><label className="block text-sm font-medium text-foreground mb-1">Current KM</label><input type="number" value={odometerValue} onChange={e => setOdometerValue(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <button onClick={handleUpdateOdometer} disabled={savingOdometer} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">{savingOdometer && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
          </div>
        </div>
      )}

      {viewingPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="relative w-[90vw] h-[90vh] bg-card border border-border rounded-lg shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Document Viewer</h3><button onClick={() => setViewingPdf(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button></div>
            <iframe src={viewingPdf} className="flex-1 w-full rounded-b-lg" title="PDF Viewer" />
          </div>
        </div>
       )}

      {/* Delete Certificate Confirmation */}
      <AlertDialog open={!!deleteCertId} onOpenChange={(open) => !open && setDeleteCertId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Certificate</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this certificate? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCert} disabled={deletingCert} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingCert ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Vehicle Modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="bg-card border border-border rounded-lg p-6 w-96 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-foreground">Transfer Vehicle</h3><button onClick={() => setShowTransfer(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button></div>
            <div><label className="block text-sm font-medium text-foreground mb-1">Current Branch</label><p className="text-sm text-muted-foreground bg-secondary px-3 py-2 rounded-lg">{(vehicle as any).branches?.name || "None"}</p></div>
            <div><label className="block text-sm font-medium text-foreground mb-1">New Branch</label><select value={transferBranch} onChange={e => setTransferBranch(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground"><option value="">Select branch...</option>{(branches || []).filter(b => b.id !== vehicle.branch_id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-foreground mb-1">Transfer Date</label><input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground" /></div>
            <div><label className="block text-sm font-medium text-foreground mb-1">Reason</label><textarea value={transferReason} onChange={e => setTransferReason(e.target.value)} rows={3} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground resize-none" placeholder="Reason for transfer..." /></div>
            <button onClick={handleTransfer} disabled={transferring || !transferBranch} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">{transferring && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Transfer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider w-40 shrink-0">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
    </div>
  );
}

function InfoRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-medium ${warn ? "text-warning" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
