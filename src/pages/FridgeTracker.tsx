import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Thermometer, Plus, X, Loader2, AlertTriangle, CheckCircle, Clock, Search, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1";

function getFridgeStatus(current: number, next: number) {
  const hrs = next - current;
  if (hrs <= 0) return { label: "OVERDUE", color: "text-destructive", bg: "bg-destructive/20", dot: "bg-destructive" };
  if (hrs <= 200) return { label: "DUE SOON", color: "text-warning", bg: "bg-warning/20", dot: "bg-warning" };
  return { label: "NOT DUE", color: "text-success", bg: "bg-success/20", dot: "bg-success" };
}

export default function FridgeTracker() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "overdue" | "due_soon" | "not_due">("all");
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"tracker" | "history">("tracker");

  const [serviceForm, setServiceForm] = useState({
    service_type: "scheduled", fault_description: "", work_done: "",
    parts_used: "", parts_cost: "", labour_hours: "", labour_cost: "",
    tech_name: "", certificate_number: "", cert_expiry_date: "",
    hours_at_service: "", notes: "",
  });

  const [editForm, setEditForm] = useState({
    fridge_brand: "", fridge_model: "", fridge_serial_number: "",
    fridge_service_interval_hrs: "", fridge_current_hrs: "",
    fridge_last_service_hrs: "", fridge_last_service_date: "",
    fridge_cert_expiry: "", fridge_cert_number: "",
  });

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["fridge_vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, registration_number, fleet_number, make, model, fridge_brand, fridge_model, fridge_serial_number, fridge_service_interval_hrs, fridge_current_hrs, fridge_last_service_hrs, fridge_last_service_date, fridge_next_service_hrs, fridge_cert_expiry, fridge_cert_number")
        .eq("is_active", true)
        .not("fridge_brand", "is", null)
        .order("registration_number");
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0, refetchOnMount: "always",
  });

  const { data: serviceHistory } = useQuery({
    queryKey: ["fridge_service_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fridge_service_log" as any)
        .select("*, vehicles(registration_number, fridge_brand, fridge_model)")
        .order("service_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0, refetchOnMount: "always",
  });

  const enriched = useMemo(() => {
    return (vehicles || []).map(v => {
      const current = Number(v.fridge_current_hrs) || 0;
      const next = Number(v.fridge_next_service_hrs) || 0;
      const status = getFridgeStatus(current, next);
      const hrsToNext = Math.round(next - current);
      const certExpired = v.fridge_cert_expiry && new Date(v.fridge_cert_expiry) < new Date();
      return { ...v, status, hrsToNext, certExpired };
    });
  }, [vehicles]);

  const filtered = useMemo(() => {
    return enriched.filter(v => {
      const matchSearch = !search || v.registration_number?.toLowerCase().includes(search.toLowerCase()) || v.fridge_brand?.toLowerCase().includes(search.toLowerCase()) || v.fridge_model?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "overdue" && v.hrsToNext <= 0) ||
        (filterStatus === "due_soon" && v.hrsToNext > 0 && v.hrsToNext <= 200) ||
        (filterStatus === "not_due" && v.hrsToNext > 200);
      return matchSearch && matchStatus;
    });
  }, [enriched, search, filterStatus]);

  const counts = useMemo(() => ({
    total: enriched.length,
    overdue: enriched.filter(v => v.hrsToNext <= 0).length,
    due_soon: enriched.filter(v => v.hrsToNext > 0 && v.hrsToNext <= 200).length,
    not_due: enriched.filter(v => v.hrsToNext > 200).length,
  }), [enriched]);

  const openServiceModal = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setServiceForm({ service_type: "scheduled", fault_description: "", work_done: "", parts_used: "", parts_cost: "", labour_hours: "", labour_cost: "", tech_name: "", certificate_number: "", cert_expiry_date: "", hours_at_service: String(vehicle.fridge_current_hrs || ""), notes: "" });
    setShowServiceModal(true);
  };

  const openEditModal = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setEditForm({
      fridge_brand: vehicle.fridge_brand || "", fridge_model: vehicle.fridge_model || "",
      fridge_serial_number: vehicle.fridge_serial_number || "",
      fridge_service_interval_hrs: String(vehicle.fridge_service_interval_hrs || "1000"),
      fridge_current_hrs: String(vehicle.fridge_current_hrs || ""),
      fridge_last_service_hrs: String(vehicle.fridge_last_service_hrs || ""),
      fridge_last_service_date: vehicle.fridge_last_service_date || "",
      fridge_cert_expiry: vehicle.fridge_cert_expiry || "",
      fridge_cert_number: vehicle.fridge_cert_number || "",
    });
    setShowEditModal(true);
  };

  const [certFile, setCertFile] = useState<File | null>(null);

  const handleLogService = async () => {
    if (!serviceForm.work_done) { toast.error("Describe the work done"); return; }
    setSaving(true);
    const hrs = parseFloat(serviceForm.hours_at_service) || null;
    const isScheduled = serviceForm.service_type === "scheduled" || serviceForm.service_type === "certificate";
    const interval = selectedVehicle.fridge_service_interval_hrs || 1000;

    // Upload certificate file if provided
    let certUrl: string | null = null;
    if (certFile) {
      const ext = certFile.name.split(".").pop();
      const path = `${selectedVehicle.registration_number}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fridge-certs").upload(path, certFile, { upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("fridge-certs").getPublicUrl(path);
        certUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("fridge_service_log" as any).insert({
      organisation_id: profile?.organisation_id,
      vehicle_id: selectedVehicle.id,
      service_date: new Date().toISOString().split("T")[0],
      hours_at_service: hrs,
      service_type: serviceForm.service_type,
      fault_description: serviceForm.fault_description || null,
      work_done: serviceForm.work_done,
      parts_used: serviceForm.parts_used || null,
      parts_cost: parseFloat(serviceForm.parts_cost) || null,
      labour_hours: parseFloat(serviceForm.labour_hours) || null,
      labour_cost: parseFloat(serviceForm.labour_cost) || null,
      total_cost: (parseFloat(serviceForm.parts_cost) || 0) + (parseFloat(serviceForm.labour_cost) || 0) || null,
      tech_name: serviceForm.tech_name || null,
      certificate_number: serviceForm.certificate_number || null,
      cert_expiry_date: serviceForm.cert_expiry_date || null,
      certificate_url: certUrl,
      notes: serviceForm.notes || null,
      logged_via: "app",
      updates_service_clock: isScheduled,
    });
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Only update current hours always (so tracker stays accurate)
    // Only reset service clock for SCHEDULED services - NOT for repairs
    const vehicleUpdate: any = {};
    if (hrs) vehicleUpdate.fridge_current_hrs = hrs;
    if (isScheduled && hrs) {
      vehicleUpdate.fridge_last_service_hrs = hrs;
      vehicleUpdate.fridge_last_service_date = new Date().toISOString().split("T")[0];
      vehicleUpdate.fridge_next_service_hrs = hrs + interval;
    }
    if (serviceForm.cert_expiry_date) vehicleUpdate.fridge_cert_expiry = serviceForm.cert_expiry_date;
    if (serviceForm.certificate_number) vehicleUpdate.fridge_cert_number = serviceForm.certificate_number;
    if (Object.keys(vehicleUpdate).length > 0) {
      await supabase.from("vehicles").update(vehicleUpdate).eq("id", selectedVehicle.id);
    }

    setSaving(false);
    toast.success(isScheduled ? "Service logged — service clock reset ✓" : "Repair logged — service clock unchanged ✓");
    setShowServiceModal(false);
    setCertFile(null);
    setServiceForm({ service_type: "scheduled", fault_description: "", work_done: "", parts_used: "", parts_cost: "", labour_hours: "", labour_cost: "", tech_name: "", certificate_number: "", cert_expiry_date: "", hours_at_service: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["fridge_vehicles"] });
    qc.invalidateQueries({ queryKey: ["fridge_service_history"] });
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    const interval = parseInt(editForm.fridge_service_interval_hrs) || 1000;
    const lastHrs = parseFloat(editForm.fridge_last_service_hrs) || null;
    const { error } = await supabase.from("vehicles").update({
      fridge_brand: editForm.fridge_brand || null,
      fridge_model: editForm.fridge_model || null,
      fridge_serial_number: editForm.fridge_serial_number || null,
      fridge_service_interval_hrs: interval,
      fridge_current_hrs: parseFloat(editForm.fridge_current_hrs) || null,
      fridge_last_service_hrs: lastHrs,
      fridge_last_service_date: editForm.fridge_last_service_date || null,
      fridge_next_service_hrs: lastHrs ? lastHrs + interval : null,
      fridge_cert_expiry: editForm.fridge_cert_expiry || null,
      fridge_cert_number: editForm.fridge_cert_number || null,
    }).eq("id", selectedVehicle.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fridge details updated");
    setShowEditModal(false);
    qc.invalidateQueries({ queryKey: ["fridge_vehicles"] });
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, 297, 28, "F");
    doc.setFillColor(0, 200, 150);
    doc.rect(0, 26, 297, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("MARZ Fleet — Fridge Tracker Report", 14, 12);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 200, 180);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-ZA")} | Total Units: ${counts.total} | Overdue: ${counts.overdue} | Due Soon: ${counts.due_soon}`, 14, 21);
    autoTable(doc, {
      startY: 34,
      head: [["Reg", "Brand", "Model", "Serial", "Last Svc Hrs", "Current Hrs", "Next Svc Hrs", "HRS Left", "Status", "Cert Expiry"]],
      body: filtered.map(v => [
        v.registration_number, v.fridge_brand || "-", v.fridge_model || "-",
        v.fridge_serial_number || "-",
        v.fridge_last_service_hrs || "-", v.fridge_current_hrs || "-",
        v.fridge_next_service_hrs || "-",
        v.hrsToNext <= 0 ? `${v.hrsToNext}` : `+${v.hrsToNext}`,
        v.status.label,
        v.fridge_cert_expiry || "-",
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [10, 15, 30], textColor: [0, 200, 150], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 8) {
          if (d.cell.text[0] === "OVERDUE") { d.cell.styles.textColor = [153, 27, 27]; d.cell.styles.fontStyle = "bold"; }
          else if (d.cell.text[0] === "DUE SOON") { d.cell.styles.textColor = [161, 98, 7]; d.cell.styles.fontStyle = "bold"; }
          else { d.cell.styles.textColor = [21, 128, 61]; }
        }
      },
    });
    const pH = doc.internal.pageSize.height;
    doc.setFillColor(10, 15, 30);
    doc.rect(0, pH - 10, 297, 10, "F");
    doc.setTextColor(160, 200, 180); doc.setFontSize(7);
    doc.text("MARZ Technologies (Pty) Ltd | fleet.marzai.co.za | CONFIDENTIAL", 14, pH - 4);
    doc.save(`Fridge_Tracker_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Report downloaded");
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Thermometer className="w-6 h-6 text-primary" /> Fridge Tracker
          </h1>
          <p className="text-sm text-muted-foreground">Live service status · Hours tracking · Full service history</p>
        </div>
        <button onClick={exportPDF} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
          <Download className="w-4 h-4" /> Export PDF
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Units", value: counts.total, color: "text-foreground", key: "all" },
          { label: "Overdue", value: counts.overdue, color: "text-destructive", key: "overdue" },
          { label: "Due Soon", value: counts.due_soon, color: "text-warning", key: "due_soon" },
          { label: "Not Due", value: counts.not_due, color: "text-success", key: "not_due" },
        ].map(s => (
          <button key={s.key} onClick={() => setFilterStatus(s.key as any)}
            className={`stat-card p-3 text-left transition-all ${filterStatus === s.key ? "ring-2 ring-primary" : ""}`}>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[{ key: "tracker", label: "Live Tracker" }, { key: "history", label: "Service History" }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "tracker" && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reg, brand, model..." className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none" />
          </div>

          {/* Table */}
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  {["Reg", "Brand", "Model", "Serial", "Last Svc Hrs", "Current Hrs", "Next Svc", "HRS Left", "Status", "Cert Expiry", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">No fridge units found</td></tr>
                  : filtered.map(v => (
                    <tr key={v.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${v.hrsToNext <= 0 ? "bg-destructive/5" : v.hrsToNext <= 200 ? "bg-warning/5" : ""}`}>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">{v.registration_number}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{v.fridge_brand || "—"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{v.fridge_model || "—"}</td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{v.fridge_serial_number || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{v.fridge_last_service_hrs ? `${Number(v.fridge_last_service_hrs).toLocaleString()} hrs` : "—"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">{v.fridge_current_hrs ? `${Number(v.fridge_current_hrs).toLocaleString()} hrs` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{v.fridge_next_service_hrs ? `${Number(v.fridge_next_service_hrs).toLocaleString()} hrs` : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${v.hrsToNext <= 0 ? "text-destructive" : v.hrsToNext <= 200 ? "text-warning" : "text-success"}`}>
                          {v.hrsToNext <= 0 ? `${v.hrsToNext} hrs` : `+${v.hrsToNext} hrs`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1.5 w-fit ${v.status.bg} ${v.status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${v.status.dot}`} />
                          {v.status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {v.fridge_cert_expiry
                          ? <span className={`text-xs font-semibold ${v.certExpired ? "text-destructive" : "text-foreground"}`}>
                              {v.certExpired ? "⚠ " : ""}{v.fridge_cert_expiry}
                            </span>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => openServiceModal(v)} className="text-xs bg-primary/20 text-primary px-2 py-1.5 rounded-lg hover:opacity-80 font-semibold">Log Service</button>
                          <button onClick={() => openEditModal(v)} className="text-xs bg-secondary text-foreground px-2 py-1.5 rounded-lg hover:opacity-80">Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{(serviceHistory || []).length} service records</p>
          {(serviceHistory || []).length === 0
            ? <div className="glass-card p-8 text-center"><p className="text-sm text-muted-foreground">No service history yet</p></div>
            : (
              <div className="glass-card overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-border">
                      {["Date", "Reg", "Brand/Model", "Type", "Work Done", "Parts", "Cost", "Tech", "Cert", "Via"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(serviceHistory || []).map((s: any) => (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-foreground">{s.service_date}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">{s.vehicles?.registration_number || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.vehicles?.fridge_brand} {s.vehicles?.fridge_model}</td>
                        <td className="px-4 py-3">
                          <div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.service_type === "breakdown" ? "bg-destructive/20 text-destructive" : s.service_type === "scheduled" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                              {s.service_type}
                            </span>
                            {s.updates_service_clock === false && s.service_type !== "scheduled" && (
                              <p className="text-xs text-muted-foreground mt-0.5">clock unchanged</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate">{s.work_done}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.parts_used || "—"}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{s.total_cost ? `R ${Number(s.total_cost).toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{s.tech_name || "—"}</td>
                        <td className="px-4 py-3">
                          {s.certificate_url
                            ? <a href={s.certificate_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">View</a>
                            : s.certificate_number
                              ? <span className="text-xs text-muted-foreground">{s.certificate_number}</span>
                              : <span className="text-xs text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">{s.logged_via === "whatsapp" ? "📱" : "💻"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* Log Service Modal */}
      {showServiceModal && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setShowServiceModal(false)} />
          <div className="w-full max-w-md bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">Log Fridge Service</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedVehicle.registration_number} — {selectedVehicle.fridge_brand} {selectedVehicle.fridge_model}</p>
              </div>
              <button onClick={() => setShowServiceModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className={labelCls}>Job Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "scheduled", label: "🔧 Scheduled Service", desc: "Resets service clock" },
                    { value: "breakdown", label: "🚨 Breakdown Repair", desc: "Clock unchanged" },
                    { value: "inspection", label: "🔍 Inspection", desc: "Clock unchanged" },
                    { value: "certificate", label: "📋 Certificate Renewal", desc: "Resets service clock" },
                  ].map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setServiceForm({ ...serviceForm, service_type: t.value })}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${serviceForm.service_type === t.value ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
                      <p className="text-sm font-semibold text-foreground">{t.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Fridge Hours at Time of Job</label>
                <input type="number" value={serviceForm.hours_at_service}
                  onChange={e => setServiceForm({ ...serviceForm, hours_at_service: e.target.value })}
                  placeholder="e.g. 12580" className={inputCls} />
                <p className="text-xs text-muted-foreground mt-1">Current on record: {selectedVehicle?.fridge_current_hrs ? `${Number(selectedVehicle.fridge_current_hrs).toLocaleString()} hrs` : "Not set"}</p>
              </div>

              {serviceForm.service_type === "breakdown" && (
                <div>
                  <label className={labelCls}>Fault Description</label>
                  <textarea value={serviceForm.fault_description}
                    onChange={e => setServiceForm({ ...serviceForm, fault_description: e.target.value })}
                    rows={2} placeholder="What was the fault?" className={inputCls} />
                </div>
              )}

              <div>
                <label className={labelCls}>Work Done *</label>
                <textarea value={serviceForm.work_done}
                  onChange={e => setServiceForm({ ...serviceForm, work_done: e.target.value })}
                  rows={3} placeholder="What was done, what was replaced..." className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Parts Used</label>
                  <input value={serviceForm.parts_used}
                    onChange={e => setServiceForm({ ...serviceForm, parts_used: e.target.value })}
                    placeholder="e.g. Filter, belt, seals" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Total Cost (R)</label>
                  <input type="number" value={serviceForm.parts_cost}
                    onChange={e => setServiceForm({ ...serviceForm, parts_cost: e.target.value })}
                    placeholder="0" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Technician Name</label>
                <input value={serviceForm.tech_name}
                  onChange={e => setServiceForm({ ...serviceForm, tech_name: e.target.value })}
                  placeholder="Who did the work?" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Upload Job Card (photo or PDF)</label>
                <div className={`${inputCls} flex items-center gap-2 cursor-pointer`}
                  onClick={() => document.getElementById("jobcard-upload")?.click()}>
                  <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    {certFile ? certFile.name : "Take a photo or upload the job card..."}
                  </span>
                </div>
                <input id="jobcard-upload" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => setCertFile(e.target.files?.[0] || null)} />
                {certFile && <p className="text-xs text-success mt-1">✓ {certFile.name} ready to upload</p>}
              </div>

              {serviceForm.service_type === "certificate" && (
                <div className="border border-primary/30 rounded-xl p-3 space-y-3 bg-primary/5">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">📋 Fridge Calibration Certificate</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Certificate Number</label>
                      <input value={serviceForm.certificate_number}
                        onChange={e => setServiceForm({ ...serviceForm, certificate_number: e.target.value })}
                        placeholder="Cert ref number" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Expiry Date</label>
                      <input type="date" value={serviceForm.cert_expiry_date}
                        onChange={e => setServiceForm({ ...serviceForm, cert_expiry_date: e.target.value })}
                        className={inputCls} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={serviceForm.notes}
                  onChange={e => setServiceForm({ ...serviceForm, notes: e.target.value })}
                  rows={2} placeholder="Any additional notes" className={inputCls} />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={handleLogService} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Thermometer className="w-4 h-4" />} Log Service & Update Hours
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Fridge Details Modal */}
      {showEditModal && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="w-full max-w-md bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">Edit Fridge Details</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedVehicle.registration_number}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className={labelCls}>Vehicle Type</label>
                <select value={editForm.fridge_brand ? (selectedVehicle as any)?.vehicle_type || "" : ""} 
                  onChange={async e => { await supabase.from("vehicles").update({ vehicle_type: e.target.value }).eq("id", selectedVehicle.id); qc.invalidateQueries({ queryKey: ["fridge_vehicles"] }); }}
                  className={inputCls}>
                  <option value="">Select type...</option>
                  <option value="trailer">Trailer (Serco, Afrit, CTS)</option>
                  <option value="rigid">Rigid Truck (Hino, Isuzu, MAN)</option>
                  <option value="horse">Horse / Prime Mover</option>
                  <option value="bakkie">Bakkie / Light Vehicle</option>
                  <option value="van">Van / Panel Van</option>
                  <option value="bus">Bus / Minibus</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Fridge Brand</label><input value={editForm.fridge_brand} onChange={e => setEditForm({ ...editForm, fridge_brand: e.target.value })} placeholder="e.g. CARRIER" className={inputCls} /></div>
                <div><label className={labelCls}>Fridge Model</label><input value={editForm.fridge_model} onChange={e => setEditForm({ ...editForm, fridge_model: e.target.value })} placeholder="e.g. SUPRA1150" className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Serial Number</label><input value={editForm.fridge_serial_number} onChange={e => setEditForm({ ...editForm, fridge_serial_number: e.target.value })} placeholder="Unit serial number" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Service Interval (hrs)</label>
                <select value={editForm.fridge_service_interval_hrs} onChange={e => setEditForm({ ...editForm, fridge_service_interval_hrs: e.target.value })} className={inputCls}>
                  <option value="500">500 hrs</option>
                  <option value="1000">1000 hrs</option>
                  <option value="1500">1500 hrs</option>
                  <option value="2000">2000 hrs</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Current Hours</label><input type="number" value={editForm.fridge_current_hrs} onChange={e => setEditForm({ ...editForm, fridge_current_hrs: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Last Service Hours</label><input type="number" value={editForm.fridge_last_service_hrs} onChange={e => setEditForm({ ...editForm, fridge_last_service_hrs: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Last Service Date</label><input type="date" value={editForm.fridge_last_service_date} onChange={e => setEditForm({ ...editForm, fridge_last_service_date: e.target.value })} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Cert Number</label><input value={editForm.fridge_cert_number} onChange={e => setEditForm({ ...editForm, fridge_cert_number: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Cert Expiry</label><input type="date" value={editForm.fridge_cert_expiry} onChange={e => setEditForm({ ...editForm, fridge_cert_expiry: e.target.value })} className={inputCls} /></div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={handleSaveEdit} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Thermometer className="w-4 h-4" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
