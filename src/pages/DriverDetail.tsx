import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, FileText, Plus, Loader2, X, Upload, AlertTriangle, Pencil, Save, MessageSquare, Trash2, RefreshCw, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { checkDriverCompliance } from "@/lib/driverCompliance";
import { generateDriverComplianceReport } from "@/lib/driverPdfReport";
import { calcToolboxStatus, toolboxExpiry, toolboxYearProgress } from "@/lib/driverComplianceHelpers";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusStyles: Record<string, string> = {
  valid: "bg-success/20 text-success",
  expiring: "bg-warning/20 text-warning",
  expired: "bg-destructive/20 text-destructive",
  missing: "bg-destructive/20 text-destructive",
  not_done: "bg-destructive/20 text-destructive",
};

const documentTypes = [
  "Driver's Licence",
  "PrDP (Professional Driving Permit)",
  "Medical Certificate",
  "Criminal Background Check",
  "Defensive Driving Certificate",
  "Dangerous Goods Certificate",
  "Other",
];

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showTalkForm, setShowTalkForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [talkFile, setTalkFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingTalk, setSavingTalk] = useState(false);
  const [form, setForm] = useState({ document_type: "", document_name: "", document_number: "", issue_date: "", expiry_date: "", not_done: false });
  const [talkForm, setTalkForm] = useState({ topic: "", date_conducted: new Date().toISOString().split("T")[0], conducted_by: "" });
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  // Doc edit/delete
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  // Talk edit/delete
  const [editingTalkId, setEditingTalkId] = useState<string | null>(null);
  const [deleteTalkId, setDeleteTalkId] = useState<string | null>(null);
  const [deletingTalk, setDeletingTalk] = useState(false);

  const { data: driver, isLoading } = useQuery({
    queryKey: ["driver", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: documents } = useQuery({
    queryKey: ["driver_documents", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_documents").select("*").eq("driver_id", id!).order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: toolboxTalks } = useQuery({
    queryKey: ["toolbox_talks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("toolbox_talks").select("*").eq("driver_id", id!).order("date_conducted", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: driverFines } = useQuery({
    queryKey: ["driver_fines", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("fines").select("*, vehicles(registration_number)").eq("driver_id", id!).order("offence_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: organisation } = useQuery({
    queryKey: ["driver_org", driver?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("organisations").select("name, compliance_settings").eq("id", driver!.organisation_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!driver?.organisation_id,
  });

  const { data: branch } = useQuery({
    queryKey: ["driver_branch", driver?.branch_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("name").eq("id", driver!.branch_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!driver?.branch_id,
  });

  const now = Date.now();

  const enrichedDocs = (documents || []).map(d => {
    const days = d.expiry_date ? Math.ceil((new Date(d.expiry_date).getTime() - now) / 86400000) : 999;
    const isNotDone = (d.status || "").toLowerCase() === "not_done";
    const calcStatus = isNotDone ? "not_done" : (days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid");
    return { ...d, daysRemaining: days, calcStatus };
  });

  const isDriver = !driver || (driver.staff_type || "driver") === "driver";

  // Compute full driver compliance (only for actual drivers)
  const compliance = driver && isDriver ? checkDriverCompliance(
    {
      licence_expiry: driver.licence_expiry,
      prdp_expiry: driver.prdp_expiry,
      licence_number: driver.licence_number,
      prdp_number: driver.prdp_number,
    },
    enrichedDocs,
    toolboxTalks || [],
    (organisation as any)?.compliance_settings || {}
  ) : null;

  const alertDocs = enrichedDocs.filter(d => d.daysRemaining <= 30);
  const yearProgress = toolboxYearProgress(toolboxTalks || []);

  // Damages reported by this driver
  const { data: reportedDamages } = useQuery({
    queryKey: ["driver_reported_damages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_items")
        .select("*, vehicles(registration_number, fleet_number)")
        .eq("reported_by_driver_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  const totalRepairCost = (reportedDamages || []).reduce((s, d: any) => s + (Number(d.repair_cost) || 0), 0);

  // Map a document_type to driver-table fields to keep in sync
  const driverFieldsForDocType = (docType: string, expiryDate: string | null, docNumber: string | null) => {
    const t = docType.toLowerCase().replace(/[^a-z]/g, "");
    const update: Record<string, any> = {};
    if (t.includes("prdp") || t.includes("professionaldriving")) {
      if (expiryDate) update.prdp_expiry = expiryDate;
      if (docNumber) update.prdp_number = docNumber;
    } else if (t.includes("licence") || t.includes("license")) {
      if (expiryDate) update.licence_expiry = expiryDate;
      if (docNumber) update.licence_number = docNumber;
    }
    return update;
  };

  const handleSave = async () => {
    if (!form.document_type || !profile?.organisation_id) { toast.error("Document type is required"); return; }
    setSaving(true);
    let fileUrl: string | null = null;
    if (file) {
      const path = `${profile.organisation_id}/drivers/${id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) { toast.error("Upload failed: " + upErr.message); setSaving(false); return; }
      fileUrl = path;
    }
    const days = form.expiry_date ? Math.ceil((new Date(form.expiry_date).getTime() - now) / 86400000) : null;
    const status = form.not_done ? "not_done" : (days !== null ? (days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid") : "valid");

    if (editingDocId) {
      const updatePayload: any = {
        document_type: form.document_type, document_name: form.document_name || form.document_type,
        document_number: form.document_number || null, issue_date: form.issue_date || null, expiry_date: form.expiry_date || null, status,
      };
      if (fileUrl) updatePayload.file_url = fileUrl;
      const { error } = await supabase.from("driver_documents").update(updatePayload).eq("id", editingDocId);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Document updated");
    } else {
      const { error } = await supabase.from("driver_documents").insert({
        organisation_id: profile.organisation_id, driver_id: id,
        document_type: form.document_type, document_name: form.document_name || form.document_type,
        document_number: form.document_number || null, issue_date: form.issue_date || null, expiry_date: form.expiry_date || null,
        file_url: fileUrl, uploaded_by: user?.id || null, status,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Document added");
    }

    // Sync licence/PrDP fields back to drivers table so compliance reflects upload immediately
    const driverUpdate = driverFieldsForDocType(form.document_type, form.expiry_date || null, form.document_number || null);
    if (Object.keys(driverUpdate).length > 0) {
      await supabase.from("drivers").update(driverUpdate as any).eq("id", id!);
    }

    setShowForm(false); setFile(null); setEditingDocId(null);
    setForm({ document_type: "", document_name: "", document_number: "", issue_date: "", expiry_date: "", not_done: false });
    queryClient.invalidateQueries({ queryKey: ["driver_documents", id] });
    queryClient.invalidateQueries({ queryKey: ["driver", id] });
    queryClient.invalidateQueries({ queryKey: ["drivers"] });
    queryClient.invalidateQueries({ queryKey: ["all_driver_documents"] });
  };

  const handleEditDoc = (doc: any) => {
    setEditingDocId(doc.id);
    setForm({
      document_type: doc.document_type || "",
      document_name: doc.document_name || "",
      document_number: doc.document_number || "",
      issue_date: doc.issue_date || "",
      expiry_date: doc.expiry_date || "",
      not_done: (doc.status || "").toLowerCase() === "not_done",
    });
    setFile(null);
    setShowForm(true);
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocId) return;
    setDeletingDoc(true);
    const { error } = await supabase.from("driver_documents").delete().eq("id", deleteDocId);
    setDeletingDoc(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted");
    setDeleteDocId(null);
    queryClient.invalidateQueries({ queryKey: ["driver_documents", id] });
  };

  const handleSaveTalk = async () => {
    if (!talkForm.topic || !profile?.organisation_id) { toast.error("Topic is required"); return; }
    setSavingTalk(true);
    let fileUrl: string | null = null;
    if (talkFile) {
      const path = `${profile.organisation_id}/drivers/${id}/toolbox/${Date.now()}_${talkFile.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, talkFile);
      if (upErr) { toast.error("Upload failed: " + upErr.message); setSavingTalk(false); return; }
      fileUrl = path;
    }
    if (editingTalkId) {
      const expiryDate = toolboxExpiry(talkForm.date_conducted);
      const talkStatus = calcToolboxStatus(talkForm.date_conducted);
      const updatePayload: any = {
        topic: talkForm.topic, date_conducted: talkForm.date_conducted,
        conducted_by: talkForm.conducted_by || null, issue_date: talkForm.date_conducted,
        expiry_date: expiryDate, status: talkStatus,
      };
      if (fileUrl) updatePayload.file_url = fileUrl;
      const { error } = await supabase.from("toolbox_talks").update(updatePayload).eq("id", editingTalkId);
      setSavingTalk(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Toolbox talk updated");
    } else {
      const expiryDate = toolboxExpiry(talkForm.date_conducted);
      const talkStatus = calcToolboxStatus(talkForm.date_conducted);
      const { error } = await supabase.from("toolbox_talks").insert({
        organisation_id: profile.organisation_id, driver_id: id,
        topic: talkForm.topic, date_conducted: talkForm.date_conducted,
        conducted_by: talkForm.conducted_by || null, file_url: fileUrl,
        issue_date: talkForm.date_conducted, expiry_date: expiryDate, status: talkStatus,
      });
      setSavingTalk(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Toolbox talk added");
    }
    setShowTalkForm(false); setTalkFile(null); setEditingTalkId(null);
    setTalkForm({ topic: "", date_conducted: new Date().toISOString().split("T")[0], conducted_by: "" });
    queryClient.invalidateQueries({ queryKey: ["toolbox_talks", id] });
    queryClient.invalidateQueries({ queryKey: ["drivers"] });
  };

  const handleEditTalk = (talk: any) => {
    setEditingTalkId(talk.id);
    setTalkForm({
      topic: talk.topic || "",
      date_conducted: talk.date_conducted || new Date().toISOString().split("T")[0],
      conducted_by: talk.conducted_by || "",
    });
    setTalkFile(null);
    setShowTalkForm(true);
  };

  const handleDeleteTalk = async () => {
    if (!deleteTalkId) return;
    setDeletingTalk(true);
    const { error } = await supabase.from("toolbox_talks").delete().eq("id", deleteTalkId);
    setDeletingTalk(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Toolbox talk deleted");
    setDeleteTalkId(null);
    queryClient.invalidateQueries({ queryKey: ["toolbox_talks", id] });
  };

  const startEditing = () => {
    if (!driver) return;
    setEditForm({
      full_name: driver.full_name || "", id_number: driver.id_number || "",
      phone: driver.phone || "", email: driver.email || "",
      employment_status: driver.employment_status || "active",
      licence_number: driver.licence_number || "", licence_code: driver.licence_code || "",
      licence_expiry: driver.licence_expiry || "",
      prdp_number: driver.prdp_number || "", prdp_category: driver.prdp_category || "",
      prdp_expiry: driver.prdp_expiry || "", shift_type: driver.shift_type || "day",
      notes: driver.notes || "",
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    const { error } = await supabase.from("drivers").update({
      full_name: editForm.full_name, id_number: editForm.id_number || null,
      phone: editForm.phone || null, email: editForm.email || null,
      employment_status: editForm.employment_status || "active",
      licence_number: editForm.licence_number || null, licence_code: editForm.licence_code || null,
      licence_expiry: editForm.licence_expiry || null,
      prdp_number: editForm.prdp_number || null, prdp_category: editForm.prdp_category || null,
      prdp_expiry: editForm.prdp_expiry || null, shift_type: editForm.shift_type || "day",
      notes: editForm.notes || null,
    }).eq("id", id!);
    setEditSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Driver updated successfully");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["driver", id] });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!driver) {
    return (
      <div className="p-6">
        <button onClick={() => navigate("/drivers")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
        <p className="text-muted-foreground">Driver not found.</p>
      </div>
    );
  }

  const licDays = driver.licence_expiry ? Math.ceil((new Date(driver.licence_expiry).getTime() - now) / 86400000) : null;
  const prdpDays = driver.prdp_expiry ? Math.ceil((new Date(driver.prdp_expiry).getTime() - now) / 86400000) : null;
  const totalDemerits = (driverFines || []).reduce((s, f) => s + (f.demerit_points_applied || 0), 0) + (driver.demerit_points || 0);
  const totalOutstanding = (driverFines || []).filter(f => f.payment_status !== "paid").reduce((s, f) => s + (Number(f.amount) || 0), 0);

  // Latest toolbox talk
  const latestTalk = (toolboxTalks || [])[0];
  const talkDays = latestTalk ? Math.ceil((now - new Date(latestTalk.date_conducted).getTime()) / 86400000) : null;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/drivers")} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{driver.full_name}</h1>
            {compliance && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${compliance.status === "compliant" ? "bg-success/20 text-success" : compliance.status === "warning" ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}`}>
                {compliance.status === "compliant" ? "Compliant" : compliance.status === "warning" ? "Warning" : "Non-Compliant"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{driver.licence_code || "No licence"} · {driver.employment_status || "active"} · Demerits: {totalDemerits}/12</p>
        </div>
        {!editing ? (
          <div className="flex gap-2">
            <button
              onClick={() => generateDriverComplianceReport({
                driver: driver as any,
                documents: (documents || []) as any,
                toolboxTalks: (toolboxTalks || []) as any,
                branchName: branch?.name,
                companyName: organisation?.name,
                incidents: (driverFines || []).map(f => ({ incident_date: f.offence_date, incident_type: f.offence_description || "Fine", status: f.payment_status || "open", outcome: f.fine_number || "" })) as any,
                complianceSettings: (organisation as any)?.compliance_settings || {},
              })}
              className="flex items-center gap-1.5 text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md hover:bg-secondary/80"
            >
              <FileDown className="w-3.5 h-3.5" /> Download Report
            </button>
            <button onClick={startEditing} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90"><Pencil className="w-3.5 h-3.5" /> Edit Driver</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border">Cancel</button>
            <button onClick={handleSaveEdit} disabled={editSaving} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50">{editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save</button>
          </div>
        )}
      </div>

      {/* Compliance Issues Banner */}
      {compliance && compliance.issues.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-destructive" /><span className="text-sm font-semibold text-destructive">Compliance Issues ({compliance.issues.length})</span></div>
          <div className="flex flex-wrap gap-2">
            {compliance.issues.map((issue, i) => (
              <span key={i} className={`text-xs font-semibold px-2 py-1 rounded ${statusStyles[issue.status]}`}>
                {issue.field} — {issue.status === "missing" ? "Missing" : issue.status === "expired" ? "Expired" : "Expiring Soon"}
              </span>
            ))}
          </div>
        </div>
      )}

      {alertDocs.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-warning" /><span className="text-sm font-semibold text-warning">{alertDocs.length} document(s) expiring within 30 days</span></div>
          <div className="flex flex-wrap gap-2">{alertDocs.map(d => <span key={d.id} className={`text-xs font-semibold px-2 py-1 rounded ${statusStyles[d.calcStatus]}`}>{d.document_type} — {d.daysRemaining <= 0 ? `${Math.abs(d.daysRemaining)}d overdue` : `${d.daysRemaining}d left`}</span>)}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card space-y-2">
          <h3 className="text-sm font-semibold text-foreground mb-3">Personal Details</h3>
          {editing ? (
            <div className="space-y-2">
              <EditField label="Full Name" value={editForm.full_name} onChange={v => setEditForm({ ...editForm, full_name: v })} />
              <EditField label="ID Number" value={editForm.id_number} onChange={v => setEditForm({ ...editForm, id_number: v })} />
              <EditField label="Phone" value={editForm.phone} onChange={v => setEditForm({ ...editForm, phone: v })} />
              <EditField label="Email" value={editForm.email} onChange={v => setEditForm({ ...editForm, email: v })} type="email" />
              <EditField label="Employment" value={editForm.employment_status} onChange={v => setEditForm({ ...editForm, employment_status: v })} />
              <EditField label="Shift Type" value={editForm.shift_type} onChange={v => setEditForm({ ...editForm, shift_type: v })} />
            </div>
          ) : (
            <>
              <InfoRow label="Full Name" value={driver.full_name} />
              <InfoRow label="ID Number" value={driver.id_number || "-"} warn={!driver.id_number} />
              <InfoRow label="Phone" value={driver.phone || "-"} />
              <InfoRow label="Email" value={driver.email || "-"} />
              <InfoRow label="Employment" value={driver.employment_status || "active"} />
              <InfoRow label="Shift" value={driver.shift_type || "day"} />
            </>
          )}
        </div>

        <div className="stat-card space-y-2">
          <h3 className="text-sm font-semibold text-foreground mb-3">Licence Details</h3>
          {editing ? (
            <div className="space-y-2">
              <EditField label="Licence No" value={editForm.licence_number} onChange={v => setEditForm({ ...editForm, licence_number: v })} />
              <EditField label="Licence Code" value={editForm.licence_code} onChange={v => setEditForm({ ...editForm, licence_code: v })} />
              <EditField label="Licence Expiry" value={editForm.licence_expiry} onChange={v => setEditForm({ ...editForm, licence_expiry: v })} type="date" />
            </div>
          ) : (
            <>
              <InfoRow label="Licence No" value={driver.licence_number || "-"} />
              <InfoRow label="Licence Code" value={driver.licence_code || "-"} />
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Licence Expiry</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{driver.licence_expiry || "-"}</span>
                  {licDays !== null && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${licDays <= 0 ? "bg-destructive/20 text-destructive" : licDays <= 30 ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>{licDays <= 0 ? `${Math.abs(licDays)}d overdue` : `${licDays}d`}</span>}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="stat-card space-y-2">
          <h3 className="text-sm font-semibold text-foreground mb-3">PrDP Details</h3>
          {editing ? (
            <div className="space-y-2">
              <EditField label="PrDP No" value={editForm.prdp_number} onChange={v => setEditForm({ ...editForm, prdp_number: v })} />
              <EditField label="PrDP Category" value={editForm.prdp_category} onChange={v => setEditForm({ ...editForm, prdp_category: v })} />
              <EditField label="PrDP Expiry" value={editForm.prdp_expiry} onChange={v => setEditForm({ ...editForm, prdp_expiry: v })} type="date" />
              <EditField label="Notes" value={editForm.notes} onChange={v => setEditForm({ ...editForm, notes: v })} />
            </div>
          ) : (
            <>
              <InfoRow label="PrDP No" value={driver.prdp_number || "-"} />
              <InfoRow label="PrDP Category" value={driver.prdp_category || "-"} />
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">PrDP Expiry</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{driver.prdp_expiry || "-"}</span>
                  {prdpDays !== null && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${prdpDays <= 0 ? "bg-destructive/20 text-destructive" : prdpDays <= 30 ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>{prdpDays <= 0 ? `${Math.abs(prdpDays)}d overdue` : `${prdpDays}d`}</span>}
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Demerits</span>
                <span className={`text-sm font-bold ${totalDemerits >= 9 ? "text-destructive" : totalDemerits >= 5 ? "text-warning" : "text-foreground"}`}>{totalDemerits}/12</span>
              </div>
              {driver.notes && <InfoRow label="Notes" value={driver.notes} />}
            </>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><FileText className="w-5 h-5" /> Documents ({enrichedDocs.length})</h3>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90"><Plus className="w-4 h-4" /> Add Document</button>
        </div>
        <div className="glass-card overflow-hidden">
          {enrichedDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No documents uploaded yet.</p>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Number</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Expiry</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Days</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">File</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
              </tr></thead>
              <tbody>
                {enrichedDocs.map(doc => (
                  <tr key={doc.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{doc.document_type}</td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{doc.document_number || "-"}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{doc.expiry_date || "-"}</td>
                    <td className="px-4 py-3 text-center">{doc.expiry_date && <span className={`text-sm font-semibold ${doc.daysRemaining <= 0 ? "text-destructive" : doc.daysRemaining <= 30 ? "text-warning" : "text-success"}`}>{doc.daysRemaining <= 0 ? `${Math.abs(doc.daysRemaining)}d overdue` : `${doc.daysRemaining}d`}</span>}</td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[doc.calcStatus]}`}>{doc.calcStatus === "valid" ? "Valid" : doc.calcStatus === "expiring" ? "Expiring" : doc.calcStatus === "not_done" ? "Not Done" : "Expired"}</span></td>
                    <td className="px-4 py-3 text-center">{doc.file_url ? <button onClick={async () => { const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_url!, 3600); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); }} className="text-xs text-primary hover:underline">View</button> : <span className="text-xs text-muted-foreground">-</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditDoc(doc)} className="text-muted-foreground hover:text-primary" title={doc.file_url ? "Edit / Replace file" : "Edit"}>
                          {doc.file_url ? <RefreshCw className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleteDocId(doc.id)} className="text-muted-foreground hover:text-destructive" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Toolbox Talks */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
            <MessageSquare className="w-5 h-5" /> Toolbox Talks ({(toolboxTalks || []).length})
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-2 ${
                yearProgress.onTrack ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
              }`}
              title={`Expected by now: ${yearProgress.expected}`}
            >
              {yearProgress.done}/{yearProgress.required} talks done this year
            </span>
            {talkDays !== null && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${talkDays <= 365 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                {talkDays <= 365 ? `Last: ${talkDays}d ago` : `Overdue: ${talkDays}d ago`}
              </span>
            )}
          </h3>
          <button onClick={() => setShowTalkForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90"><Plus className="w-4 h-4" /> Add Talk</button>
        </div>
        <div className="glass-card overflow-hidden">
          {(toolboxTalks || []).length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No toolbox talks recorded yet.</p>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Topic</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Conducted By</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">File</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
              </tr></thead>
              <tbody>
                {(toolboxTalks || []).map(talk => (
                  <tr key={talk.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{talk.topic}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{talk.date_conducted}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{talk.conducted_by || "-"}</td>
                    <td className="px-4 py-3 text-center">{talk.file_url ? <button onClick={async () => { const { data } = await supabase.storage.from("documents").createSignedUrl(talk.file_url!, 3600); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); }} className="text-xs text-primary hover:underline">View</button> : <span className="text-xs text-muted-foreground">-</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditTalk(talk)} className="text-muted-foreground hover:text-primary" title={talk.file_url ? "Edit / Replace file" : "Edit"}>
                          {talk.file_url ? <RefreshCw className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleteTalkId(talk.id)} className="text-muted-foreground hover:text-destructive" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Fines */}
      {(driverFines || []).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Fines ({driverFines!.length})</h3>
            {totalOutstanding > 0 && <span className="text-sm font-bold text-destructive">Outstanding: R {totalOutstanding.toLocaleString()}</span>}
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Fine No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Vehicle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Offence</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              </tr></thead>
              <tbody>
                {driverFines!.map(f => (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{f.fine_number || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{(f as any).vehicles?.registration_number || "-"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{f.offence_description || "-"}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-foreground">R {(Number(f.amount) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${f.payment_status === "paid" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>{f.payment_status || "unpaid"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Damages Reported by this driver */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
            <AlertTriangle className="w-5 h-5" /> Damages Reported ({(reportedDamages || []).length})
            {totalRepairCost > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning">
                Total repair cost: R {totalRepairCost.toLocaleString()}
              </span>
            )}
          </h3>
        </div>
        <div className="glass-card overflow-hidden">
          {(reportedDamages || []).length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No damages reported by this driver.</p>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Vehicle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Damage</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Severity</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Repair Cost</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              </tr></thead>
              <tbody>
                {(reportedDamages || []).map((d: any) => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-sm text-foreground">{(d.created_at || "").split("T")[0]}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{d.vehicles?.registration_number || "-"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{d.location || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{d.damage_type || "-"}</td>
                    <td className="px-4 py-3 text-sm text-center capitalize text-foreground">{d.severity || "-"}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-foreground">R {(Number(d.repair_cost) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${d.resolved ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                        {d.resolved ? "Resolved" : "Open"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Document Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/50" onClick={() => { setShowForm(false); setEditingDocId(null); setFile(null); }} />
          <div className="w-[450px] bg-card border-l border-border p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{editingDocId ? "Edit Document" : "Add Document"}</h2>
              <button onClick={() => { setShowForm(false); setEditingDocId(null); setFile(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Document Type *</label>
              <select value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select type</option>
                {documentTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.document_type === "Other" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Document Name</label>
                <input type="text" value={form.document_name} onChange={e => setForm({ ...form, document_name: e.target.value })} placeholder="e.g. First Aid Certificate" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Document Number</label>
              <input type="text" value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Issue Date</label>
              <input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{editingDocId ? "Replace File (optional)" : "Upload File (PDF/Image)"}</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-foreground" />
              {editingDocId && <p className="text-xs text-muted-foreground mt-1">Leave empty to keep existing file</p>}
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {editingDocId ? "Update Document" : "Save Document"}
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Toolbox Talk Form */}
      {showTalkForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/50" onClick={() => { setShowTalkForm(false); setEditingTalkId(null); setTalkFile(null); }} />
          <div className="w-[450px] bg-card border-l border-border p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{editingTalkId ? "Edit Toolbox Talk" : "Add Toolbox Talk"}</h2>
              <button onClick={() => { setShowTalkForm(false); setEditingTalkId(null); setTalkFile(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Topic/Title *</label>
              <input type="text" value={talkForm.topic} onChange={e => setTalkForm({ ...talkForm, topic: e.target.value })} placeholder="e.g. Vehicle Pre-Trip Inspection" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Date Conducted</label>
              <input type="date" value={talkForm.date_conducted} onChange={e => setTalkForm({ ...talkForm, date_conducted: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Conducted By</label>
              <input type="text" value={talkForm.conducted_by} onChange={e => setTalkForm({ ...talkForm, conducted_by: e.target.value })} placeholder="Name of person" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{editingTalkId ? "Replace Attendance Sheet (optional)" : "Upload Attendance Sheet (PDF/Image)"}</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setTalkFile(e.target.files?.[0] || null)} className="w-full text-sm text-foreground" />
              {editingTalkId && <p className="text-xs text-muted-foreground mt-1">Leave empty to keep existing file</p>}
            </div>
            <button onClick={handleSaveTalk} disabled={savingTalk} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {savingTalk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {editingTalkId ? "Update Toolbox Talk" : "Save Toolbox Talk"}
            </button>
          </div>
        </div>
      )}

      {/* Delete document confirmation */}
      <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete this driver document? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDoc} disabled={deletingDoc} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingDoc ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete toolbox talk confirmation */}
      <AlertDialog open={!!deleteTalkId} onOpenChange={(open) => !open && setDeleteTalkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Toolbox Talk</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete this toolbox talk? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTalk} disabled={deletingTalk} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingTalk ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider w-32 shrink-0">{label}</span>
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
