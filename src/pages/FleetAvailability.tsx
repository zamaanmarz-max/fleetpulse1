import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVehicles } from "@/hooks/useOrgData";
import {
  Truck, Wrench, MapPin, Ban, Clock, Loader2, X, Download, Plus,
  Search, Building2, BarChart2, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:      { label: "Available",     color: "text-success",          bg: "bg-success/20" },
  out_for_repair: { label: "Out for Repair", color: "text-destructive",      bg: "bg-destructive/20" },
  on_route:       { label: "On Route",       color: "text-primary",          bg: "bg-primary/20" },
  off_road:       { label: "Off Road",       color: "text-muted-foreground", bg: "bg-muted" },
  standby:        { label: "Standby",        color: "text-warning",          bg: "bg-warning/20" },
};

const WORKSHOPS = [
  "JJ", "AC&R", "ICE COLD BODIES", "DH LIFTS", "SPARTAN WORKSHOP", "SERCO", "Other",
];

const WAITING_FOR_OPTIONS = [
  "—",
  "In Progress at Workshop",
  "Waiting for ETA from Workshop",
  "Waiting for Purchase Order (PO)",
  "Waiting for Parts",
  "Waiting for Workshop Slot",
  "Waiting for Insurance Assessment",
  "Waiting for Driver",
  "Waiting for Fuel",
  "Other",
];

export default function FleetAvailability() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: vehicles, isLoading: vLoading } = useVehicles();
  const [filter, setFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalVehicle, setModalVehicle] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [workshopIsOther, setWorkshopIsOther] = useState(false);
  const [waitingIsOther, setWaitingIsOther] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showWorkshopAnalysis, setShowWorkshopAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState<"fleet" | "analysis">("fleet");
  const [showTempVehicle, setShowTempVehicle] = useState(false);
  const [tempForm, setTempForm] = useState({ registration_number: "", make: "", model: "", from_branch: "", reason: "Replacement", current_site: "", comments: "" });
  const [savingTemp, setSavingTemp] = useState(false);

  const { data: statuses, refetch: refetchStatuses } = useQuery({
    queryKey: ["vehicle_statuses", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_status").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
    staleTime: 0, refetchOnMount: "always",
  });

  const { data: pairings, refetch: refetchPairings } = useQuery({
    queryKey: ["vehicle_pairings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_pairings" as any)
        .select("*, horse:horse_id(id, registration_number, make, model, fleet_number), trailer:trailer_id(id, registration_number, make, model, fleet_number)")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0, refetchOnMount: "always",
  });

  // Build maps
  const statusMap = new Map<string, any>();
  (statuses || []).forEach(s => { if (!statusMap.has(s.vehicle_id)) statusMap.set(s.vehicle_id, s); });

  // Map of trailer_id → pairing (to know which trailers are currently paired)
  const pairedTrailerIds = new Set((pairings || []).map((p: any) => p.trailer_id));
  // Map of horse_id → trailer info
  const horseTrailerMap = new Map<string, any>();
  (pairings || []).forEach((p: any) => horseTrailerMap.set(p.horse_id, p.trailer));

  const enriched = (vehicles || []).map(v => {
    const st = statusMap.get(v.id);
    const pairedTrailer = horseTrailerMap.get(v.id) || null;
    return {
      ...v,
      currentStatus: st?.status || "available",
      statusRecord: st || null,
      owningBranch: (v as any).owning_branch || null,
      currentSite: st?.current_site || null,
      pairedTrailer,
      isPairedTrailer: pairedTrailerIds.has(v.id),
    };
  });

  // Filter out trailers that are currently paired — they show under their horse
  const unpaired = enriched.filter(v => !v.isPairedTrailer);

  // Sites — from current deployment site on vehicle_status
  const assignedSites = Array.from(new Set(unpaired.map(v => v.currentSite).filter(Boolean)));
  const unassignedCount = unpaired.filter(v => !v.currentSite).length;
  const branches = ["all", ...assignedSites, ...(unassignedCount > 0 ? ["unassigned"] : [])];

  const filtered = unpaired.filter(v => {
    if (filter !== "all" && v.currentStatus !== filter) return false;
    if (branchFilter === "unassigned" && v.currentSite) return false;
    if (branchFilter !== "all" && branchFilter !== "unassigned" && v.currentSite !== branchFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return v.registration_number.toLowerCase().includes(s) ||
        ((v as any).fleet_number || "").toLowerCase().includes(s) ||
        ((v as any).make || "").toLowerCase().includes(s) ||
        (v.currentSite || "").toLowerCase().includes(s) ||
        (v.owningBranch || "").toLowerCase().includes(s);
    }
    return true;
  });

  const counts = useMemo(() => {
    const c = { available: 0, out_for_repair: 0, on_route: 0, off_road: 0, standby: 0 };
    unpaired.filter(v => branchFilter === "all" || branchFilter === "unassigned" || v.currentSite === branchFilter)
      .forEach(v => { if (c[v.currentStatus as keyof typeof c] !== undefined) c[v.currentStatus as keyof typeof c]++; });
    return c;
  }, [unpaired, branchFilter]);

  // Workshop analysis
  const workshopAnalysis = useMemo(() => {
    const map: Record<string, { count: number; totalDays: number; vehicles: string[] }> = {};
    unpaired.filter(v => v.currentStatus === "out_for_repair").forEach(v => {
      const ws = v.statusRecord?.workshop_name || "Unknown";
      const daysOut = v.statusRecord?.date_sent_for_repair
        ? Math.ceil((Date.now() - new Date(v.statusRecord.date_sent_for_repair).getTime()) / 86400000)
        : 0;
      if (!map[ws]) map[ws] = { count: 0, totalDays: 0, vehicles: [] };
      map[ws].count++;
      map[ws].totalDays += daysOut;
      map[ws].vehicles.push(v.registration_number);
    });
    return Object.entries(map)
      .map(([ws, d]) => ({ workshop: ws, ...d, avgDays: d.count > 0 ? Math.round(d.totalDays / d.count) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [enriched]);

  const openModal = (v: any) => {
    const st = v.statusRecord;
    const ws = st?.workshop_name || "";
    const wf = st?.waiting_for || "—";
    setWorkshopIsOther(!!ws && !WORKSHOPS.slice(0, -1).includes(ws));
    setWaitingIsOther(!!wf && wf !== "—" && !WAITING_FOR_OPTIONS.slice(0, -1).includes(wf));
    setForm({
      status: v.currentStatus,
      workshop_name: ws,
      workshop_contact: st?.workshop_contact || "",
      date_sent_for_repair: st?.date_sent_for_repair || new Date().toISOString().split("T")[0],
      repair_description: st?.repair_description || "",
      estimated_return_date: st?.estimated_return_date || "",
      actual_return_date: st?.actual_return_date || "",
      repair_cost: st?.repair_cost?.toString() || "",
      comments: st?.comments || "",
      waiting_for: wf,
      current_site: st?.current_site || "",
    });
    setModalVehicle(v);
  };

  const handleSaveTemp = async () => {
    if (!tempForm.registration_number) { toast.error("Registration number required"); return; }
    setSavingTemp(true);
    const { error } = await supabase.from("temp_vehicles" as any).insert({
      organisation_id: profile?.organisation_id,
      registration_number: tempForm.registration_number.toUpperCase(),
      make: tempForm.make || null,
      model: tempForm.model || null,
      from_branch: tempForm.from_branch || null,
      reason: tempForm.reason,
      current_site: tempForm.current_site || null,
      comments: tempForm.comments || null,
      status: "available",
      active: true,
    });
    setSavingTemp(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${tempForm.registration_number.toUpperCase()} added as temporary vehicle`);
    setShowTempVehicle(false);
    setTempForm({ registration_number: "", make: "", model: "", from_branch: "", reason: "Replacement", current_site: "", comments: "" });
    qc.invalidateQueries({ queryKey: ["vehicle_statuses"] });
  };

  const handleSave = async () => {
    if (!profile?.organisation_id || !modalVehicle) return;
    setSaving(true);
    const payload = {
      organisation_id: profile.organisation_id,
      vehicle_id: modalVehicle.id,
      status: form.status,
      workshop_name: form.workshop_name || null,
      workshop_contact: form.workshop_contact || null,
      date_sent_for_repair: form.status === "out_for_repair" ? (form.date_sent_for_repair || null) : null,
      repair_description: form.repair_description || null,
      estimated_return_date: form.estimated_return_date || null,
      actual_return_date: form.status === "available" ? (form.actual_return_date || null) : null,
      repair_cost: form.repair_cost ? parseFloat(form.repair_cost) : 0,
      comments: form.comments || null,
      waiting_for: form.waiting_for !== "—" ? form.waiting_for : null,
      current_site: form.current_site || null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    };
    const existing = modalVehicle.statusRecord;
    const { error } = existing
      ? await supabase.from("vehicle_status").update(payload).eq("id", existing.id)
      : await supabase.from("vehicle_status").insert(payload);

    // Update owning branch on vehicles table if changed
    if (form.owning_branch !== undefined && form.owning_branch !== modalVehicle.owningBranch) {
      await supabase.from("vehicles").update({ owning_branch: form.owning_branch } as any).eq("id", modalVehicle.id);
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${modalVehicle.registration_number} updated`);
    setModalVehicle(null);
    qc.invalidateQueries({ queryKey: ["vehicle_statuses"] });
    qc.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const exportPDF = (reportType: "manager" | "customer" = "manager") => {
    const doc = new jsPDF({ orientation: "landscape" });
    const scope = branchFilter !== "all" ? branchFilter : "All Sites";
    const data = filtered;
    const isCustomer = reportType === "customer";
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr = today.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });

    // Professional header
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, 297, 35, "F");
    doc.setFillColor(0, 200, 150);
    doc.rect(0, 33, 297, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("POWER TRUCK HIRE", 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 200, 180);
    doc.text("Operated by MARZ Fleet Compliance Platform", 14, 21);
    doc.setFillColor(0, 200, 150);
    doc.roundedRect(14, 24, isCustomer ? 38 : 36, 7, 2, 2, "F");
    doc.setTextColor(10, 15, 30);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(isCustomer ? "CLIENT REPORT" : "MANAGER REPORT", 16, 29);
    doc.setTextColor(200, 220, 210);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${dateStr}  |  Time: ${timeStr}`, 283, 12, { align: "right" });
    doc.text(`Site: ${scope}  |  Contract: Vector Logistics`, 283, 20, { align: "right" });
    doc.text(`Report: ${isCustomer ? "Fleet Status" : "Fleet Availability"}`, 283, 28, { align: "right" });
    doc.setTextColor(0, 0, 0);

    // Stats boxes
    const total = data.length;
    const avail = data.filter(v => v.currentStatus === "available").length;
    const repair = data.filter(v => v.currentStatus === "out_for_repair").length;
    const onRoute = data.filter(v => v.currentStatus === "on_route").length;
    const offRoad = data.filter(v => v.currentStatus === "off_road").length;
    const standby = data.filter(v => v.currentStatus === "standby").length;
    const availPct = total > 0 ? Math.round((avail / total) * 100) : 0;
    const stats = [
      { label: "Total Fleet", value: String(total), color: [30, 58, 138] as [number,number,number] },
      { label: "Available", value: `${avail} (${availPct}%)`, color: [21, 128, 61] as [number,number,number] },
      { label: "Out for Repair", value: String(repair), color: [153, 27, 27] as [number,number,number] },
      { label: "On Route", value: String(onRoute), color: [29, 78, 216] as [number,number,number] },
      { label: "Off Road", value: String(offRoad), color: [100, 100, 100] as [number,number,number] },
      { label: "Standby", value: String(standby), color: [161, 98, 7] as [number,number,number] },
    ];
    stats.forEach((s, i) => {
      const x = 14 + i * 48;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, 39, 45, 16, 2, 2, "F");
      doc.setDrawColor(220, 220, 230);
      doc.roundedRect(x, 39, 45, 16, 2, 2, "S");
      doc.setFillColor(...s.color);
      doc.rect(x, 39, 3, 16, "F");
      doc.setTextColor(...s.color);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(s.value, x + 7, 49);
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(s.label, x + 7, 53.5);
    });

    // Table rows
    const rows = data.map(v => {
      const st = v.statusRecord;
      const daysOut = st?.date_sent_for_repair
        ? Math.ceil((Date.now() - new Date(st.date_sent_for_repair).getTime()) / 86400000)
        : null;
      const trailerReg = v.pairedTrailer?.registration_number || "-";
      if (isCustomer) return [
        (v as any).fleet_number || "-", v.registration_number, trailerReg,
        `${(v as any).make || ""} ${(v as any).model || ""}`.trim() || "-",
        v.currentSite || "-", STATUS_CONFIG[v.currentStatus]?.label || v.currentStatus,
        st?.workshop_name || "-", st?.estimated_return_date || "TBC",
      ];
      return [
        (v as any).fleet_number || "-", v.registration_number, trailerReg,
        `${(v as any).make || ""} ${(v as any).model || ""}`.trim() || "-",
        v.owningBranch || "-", v.currentSite || "-",
        STATUS_CONFIG[v.currentStatus]?.label || v.currentStatus,
        st?.workshop_name || "-", st?.date_sent_for_repair || "-",
        st?.estimated_return_date || "No ETA",
        daysOut !== null ? `${daysOut}d` : "-",
        st?.waiting_for || "-", st?.comments || "-",
      ];
    });

    autoTable(doc, {
      startY: 59,
      head: isCustomer
        ? [["Fleet #", "Horse Reg", "Trailer Reg", "Make/Model", "Current Site", "Status", "Workshop", "ETA"]]
        : [["Fleet #", "Horse Reg", "Trailer Reg", "Make/Model", "Branch", "Site", "Status", "Workshop", "Date Out", "ETA", "Days", "Waiting For", "Comments"]],
      body: rows,
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [10, 15, 30], textColor: [0, 200, 150], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (cellData) => {
        const statusIdx = isCustomer ? 5 : 6;
        if (cellData.section === "body" && cellData.column.index === statusIdx) {
          const val = cellData.cell.text[0];
          if (val === "Available") { cellData.cell.styles.textColor = [21, 128, 61]; cellData.cell.styles.fontStyle = "bold"; }
          else if (val === "Out for Repair") { cellData.cell.styles.textColor = [153, 27, 27]; cellData.cell.styles.fontStyle = "bold"; }
          else if (val === "On Route") { cellData.cell.styles.textColor = [29, 78, 216]; cellData.cell.styles.fontStyle = "bold"; }
        }
        if (!isCustomer && cellData.section === "body" && cellData.column.index === 10) {
          const days = parseInt(cellData.cell.text[0]);
          if (days > 14) { cellData.cell.styles.textColor = [153, 27, 27]; cellData.cell.styles.fontStyle = "bold"; }
        }
      },
    });

    // Workshop analysis (manager only)
    if (!isCustomer && workshopAnalysis.length > 0) {
      const finalY = (doc as any).lastAutoTable.finalY + 8;
      const needsNewPage = finalY > doc.internal.pageSize.height - 60;
      if (needsNewPage) doc.addPage();
      const wsY = needsNewPage ? 20 : finalY;
      doc.setFillColor(10, 15, 30);
      doc.rect(14, wsY, 269, 8, "F");
      doc.setTextColor(0, 200, 150);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("WORKSHOP DOWNTIME ANALYSIS", 16, wsY + 5.5);
      autoTable(doc, {
        startY: wsY + 10,
        head: [["Workshop", "Vehicles In", "Total Days", "Avg Days", "Vehicles"]],
        body: workshopAnalysis.map(w => [w.workshop, String(w.count), `${w.totalDays}d`, `${w.avgDays}d${w.avgDays > 14 ? " ⚠" : ""}`, w.vehicles.join(", ")]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [153, 27, 27], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [255, 248, 248] },
      });
    }

    // Footer on every page
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pH = doc.internal.pageSize.height;
      doc.setFillColor(10, 15, 30);
      doc.rect(0, pH - 12, 297, 12, "F");
      doc.setTextColor(160, 200, 180);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Power Truck Hire (Pty) Ltd  |  Powered by MARZ Technologies  |  fleet.marzai.co.za", 14, pH - 5);
      doc.text(`Page ${i} of ${pageCount}  |  ${isCustomer ? "CONFIDENTIAL — CLIENT COPY" : "CONFIDENTIAL — INTERNAL USE ONLY"}`, 283, pH - 5, { align: "right" });
    }

    doc.save(`PTH_Fleet_${isCustomer ? "Client" : "Manager"}_${scope.replace(/ /g, "_")}_${today.toISOString().split("T")[0]}.pdf`);
    toast.success(`${isCustomer ? "Client" : "Manager"} report downloaded`);
  };

  const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block text-sm font-medium text-foreground mb-1";

  if (vLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  // Safety check
  const safeVehicles = vehicles || [];
  const safeStatuses = statuses || [];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Availability</h1>
          <p className="text-muted-foreground text-sm">Vehicle status, workshop tracking and downtime analysis</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTempVehicle(true)} className="flex items-center gap-2 bg-secondary text-foreground border border-border px-3 py-2 rounded-lg text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Temp Vehicle
          </button>
          <button onClick={() => exportPDF("customer")} className="flex items-center gap-2 bg-secondary text-foreground border border-border px-3 py-2 rounded-lg text-sm hover:opacity-90">
            <Download className="w-4 h-4" /> Customer Report
          </button>
          <button onClick={() => exportPDF("manager")} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm hover:opacity-90">
            <Download className="w-4 h-4" /> Manager Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button key={key} onClick={() => setFilter(prev => prev === key ? "all" : key)}
            className={`stat-card text-left p-3 transition-all ${filter === key ? "ring-2 ring-primary" : ""}`}>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{cfg.label}</p>
            <p className={`text-2xl font-bold mt-1 ${cfg.color}`}>{counts[key as keyof typeof counts] || 0}</p>
          </button>
        ))}
      </div>

      {/* Branch setup prompt */}
      {unassignedCount > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span><strong>{unassignedCount} vehicles</strong> have no branch assigned. Click Update on each vehicle to set their branch.</span>
          </div>
          <button onClick={() => setBranchFilter("unassigned")} className="text-xs bg-warning/20 text-warning px-3 py-1.5 rounded-lg hover:opacity-80 flex-shrink-0">
            Show unassigned
          </button>
        </div>
      )}

      {/* Branch filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter by site:</span>
        {branches.map(b => (
          <button key={b} onClick={() => setBranchFilter(b)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${branchFilter === b ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
            {b === "all" ? "All Branches" : b}
          </button>
        ))}
        {branchFilter !== "all" && (
          <button onClick={() => exportPDF(branchFilter)} className="flex items-center gap-1.5 text-xs bg-success/20 text-success px-3 py-1.5 rounded-lg hover:opacity-80 ml-auto">
            <Download className="w-3.5 h-3.5" /> {branchFilter} Report
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setActiveTab("fleet")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "fleet" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Truck className="w-4 h-4" /> Fleet Status
        </button>
        <button onClick={() => setActiveTab("analysis")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "analysis" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <BarChart2 className="w-4 h-4" /> Workshop Analysis
        </button>
      </div>

      {/* Fleet Status Tab */}
      {activeTab === "fleet" && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reg, fleet number, branch..."
              className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  {["Fleet #", "Registration", "Trailer", "Owning Branch", "Current Site", "Status", "Workshop", "Date Out", "ETA", "Days Out", "Waiting For", "Comments"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={13} className="px-4 py-8 text-center text-sm text-muted-foreground">No vehicles found</td></tr>
                ) : filtered.map(v => {
                  const st = v.statusRecord;
                  const daysOut = st?.date_sent_for_repair
                    ? Math.ceil((Date.now() - new Date(st.date_sent_for_repair).getTime()) / 86400000)
                    : null;
                  const cfg = STATUS_CONFIG[v.currentStatus] || STATUS_CONFIG.available;
                  const isLongOut = daysOut !== null && daysOut > 14;
                  return (
                    <tr key={v.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${isLongOut ? "bg-destructive/5" : ""}`}>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{(v as any).fleet_number || "—"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">{v.registration_number}</td>
                      <td className="px-4 py-3">
                        {v.pairedTrailer
                          ? <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">{v.pairedTrailer.registration_number}</span>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{v.owningBranch || "—"}</td>
                      <td className="px-4 py-3 text-sm text-foreground font-medium">{v.currentSite || <span className="text-warning text-xs">Not set</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{st?.workshop_name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{st?.date_sent_for_repair || "—"}</td>
                      <td className="px-4 py-3">
                        {st?.estimated_return_date
                          ? <span className={`text-sm ${new Date(st.estimated_return_date) < new Date() ? "text-destructive font-semibold" : "text-foreground"}`}>{st.estimated_return_date}</span>
                          : <span className="text-xs text-warning">No ETA</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {daysOut !== null && (
                          <span className={`text-sm font-mono font-semibold ${isLongOut ? "text-destructive" : "text-foreground"}`}>
                            {daysOut}d {isLongOut && "⚠"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-warning">{st?.waiting_for || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{st?.comments || "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openModal(v)} className="text-xs text-primary hover:underline whitespace-nowrap">Update</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Workshop Analysis Tab */}
      {activeTab === "analysis" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Off-Road</p>
              <p className="text-2xl font-bold text-destructive mt-1">{counts.out_for_repair + counts.off_road}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Days Off-Road</p>
              <p className="text-2xl font-bold text-warning mt-1">
                {(() => {
                  const repairVehicles = enriched.filter(v => v.currentStatus === "out_for_repair" && v.statusRecord?.date_sent_for_repair);
                  if (!repairVehicles.length) return "0";
                  const avg = repairVehicles.reduce((s, v) => s + Math.ceil((Date.now() - new Date(v.statusRecord.date_sent_for_repair).getTime()) / 86400000), 0) / repairVehicles.length;
                  return Math.round(avg);
                })()}d
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Workshops Active</p>
              <p className="text-2xl font-bold text-primary mt-1">{workshopAnalysis.length}</p>
            </div>
          </div>

          {workshopAnalysis.length === 0
            ? <div className="glass-card p-8 text-center text-sm text-muted-foreground">No vehicles currently at workshops</div>
            : (
            <div className="glass-card overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    {["Workshop", "Vehicles In", "Total Days (combined)", "Avg Days Per Vehicle", "Vehicles"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workshopAnalysis.map(w => (
                    <tr key={w.workshop} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">{w.workshop}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${w.count >= 3 ? "text-destructive" : w.count >= 2 ? "text-warning" : "text-foreground"}`}>{w.count}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{w.totalDays}d</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-mono ${w.avgDays > 14 ? "text-destructive font-semibold" : w.avgDays > 7 ? "text-warning" : "text-success"}`}>
                          {w.avgDays}d {w.avgDays > 14 ? "⚠" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{w.vehicles.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Vehicles needing attention */}
          {(() => {
            const longOut = enriched.filter(v => {
              if (v.currentStatus !== "out_for_repair") return false;
              const days = v.statusRecord?.date_sent_for_repair
                ? Math.ceil((Date.now() - new Date(v.statusRecord.date_sent_for_repair).getTime()) / 86400000)
                : 0;
              return days > 14;
            });
            if (!longOut.length) return null;
            return (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4" /> Vehicles off-road 14+ days ({longOut.length})
                </h3>
                <div className="space-y-2">
                  {longOut.map(v => {
                    const days = Math.ceil((Date.now() - new Date(v.statusRecord.date_sent_for_repair).getTime()) / 86400000);
                    return (
                      <div key={v.id} className="flex items-center justify-between py-2 px-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <div>
                          <span className="text-sm font-semibold text-foreground">{v.registration_number}</span>
                          <span className="text-xs text-muted-foreground ml-2">{v.statusRecord?.workshop_name || "No workshop"}</span>
                          {v.statusRecord?.waiting_for && <span className="text-xs text-warning ml-2">Waiting: {v.statusRecord.waiting_for}</span>}
                        </div>
                        <span className="text-sm font-bold text-destructive">{days}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Update Modal */}
      {modalVehicle && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setModalVehicle(null)} />
          <div className="w-full max-w-md bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <h2 className="text-base font-bold text-foreground">{modalVehicle.registration_number} — Update Status</h2>
              <button onClick={() => setModalVehicle(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              <div>
                <label className={labelCls}>Status *</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button key={key} onClick={() => setForm({ ...form, status: key })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${form.status === key ? `${cfg.bg} ${cfg.color} border-current` : "border-border bg-secondary/30 text-foreground hover:border-primary/30"}`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Current Site</label>
                  <input value={form.current_site} onChange={e => setForm({ ...form, current_site: e.target.value })} placeholder="e.g. Midrand, Cape Town" className={inputCls} />
                  <p className="text-xs text-muted-foreground mt-1">Where is this vehicle now?</p>
                </div>
                <div>
                  <label className={labelCls}>Workshop</label>
                  <select
                    value={workshopIsOther ? "Other" : (form.workshop_name || "")}
                    onChange={e => {
                      if (e.target.value === "Other") { setWorkshopIsOther(true); setForm({ ...form, workshop_name: "" }); }
                      else { setWorkshopIsOther(false); setForm({ ...form, workshop_name: e.target.value }); }
                    }}
                    className={inputCls}>
                    <option value="">Select workshop</option>
                    {WORKSHOPS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  {workshopIsOther && (
                    <input value={form.workshop_name} onChange={e => setForm({ ...form, workshop_name: e.target.value })}
                      placeholder="Enter workshop name" className={`${inputCls} mt-2`} autoFocus />
                  )}
                </div>
              </div>

              {/* Always show repair fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date Sent Out</label>
                  <input type="date" value={form.date_sent_for_repair} onChange={e => setForm({ ...form, date_sent_for_repair: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>ETA Return</label>
                  <input type="date" value={form.estimated_return_date} onChange={e => setForm({ ...form, estimated_return_date: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Waiting For</label>
                <select
                  value={waitingIsOther ? "Other" : (form.waiting_for || "—")}
                  onChange={e => {
                    if (e.target.value === "Other") { setWaitingIsOther(true); setForm({ ...form, waiting_for: "" }); }
                    else { setWaitingIsOther(false); setForm({ ...form, waiting_for: e.target.value }); }
                  }}
                  className={inputCls}>
                  {WAITING_FOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {waitingIsOther && (
                  <input value={form.waiting_for} onChange={e => setForm({ ...form, waiting_for: e.target.value })}
                    placeholder="Describe what you're waiting for" className={`${inputCls} mt-2`} />
                )}
              </div>
              <div>
                <label className={labelCls}>Repair Description</label>
                <textarea value={form.repair_description} onChange={e => setForm({ ...form, repair_description: e.target.value })} rows={2} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Estimated Cost (R)</label>
                <input type="number" value={form.repair_cost} onChange={e => setForm({ ...form, repair_cost: e.target.value })} placeholder="0" className={inputCls} />
              </div>

                <div className="border border-border rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  Trailer Pairing
                  <span className="text-xs font-normal text-muted-foreground">— {(modalVehicle as any)?.vehicle_type === "trailer" ? "This is a trailer" : "This is a horse"}</span>
                </p>
                {(modalVehicle as any)?.vehicle_type === "trailer" ? (
                  <p className="text-xs text-muted-foreground">Trailers are paired from the horse vehicle. Find the horse this trailer is attached to and pair from there.</p>
                ) : modalVehicle?.pairedTrailer ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Paired with: {modalVehicle.pairedTrailer.registration_number}</p>
                      <p className="text-xs text-muted-foreground">{modalVehicle.pairedTrailer.make} {modalVehicle.pairedTrailer.model}</p>
                    </div>
                    <button onClick={async () => {
                      const pairing = (pairings || []).find((p: any) => p.horse_id === modalVehicle.id);
                      if (pairing) {
                        await supabase.from("vehicle_pairings" as any).update({ is_active: false, unpaired_at: new Date().toISOString() }).eq("id", pairing.id);
                        toast.success("Trailer unpaired");
                        refetchPairings();
                        qc.invalidateQueries({ queryKey: ["vehicles"] });
                      }
                    }} className="text-xs bg-destructive/20 text-destructive px-3 py-1.5 rounded-lg hover:opacity-80">
                      Unpair
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Pair with trailer</label>
                    <select onChange={async (e) => {
                      if (!e.target.value) return;
                      await supabase.from("vehicle_pairings" as any).insert({
                        organisation_id: profile?.organisation_id,
                        horse_id: modalVehicle.id,
                        trailer_id: e.target.value,
                        paired_by: profile?.id,
                        is_active: true,
                      });
                      toast.success("Trailer paired successfully");
                      refetchPairings();
                      qc.invalidateQueries({ queryKey: ["vehicles"] });
                      e.target.value = "";
                    }} className={inputCls} defaultValue="">
                      <option value="">Select trailer to pair...</option>
                      {enriched.filter(v =>
                        !v.isPairedTrailer &&
                        v.id !== modalVehicle?.id &&
                        (v as any).vehicle_type === "trailer"
                      ).map(t => (
                        <option key={t.id} value={t.id}>
                          {t.registration_number} — {(t as any).make} {(t as any).model}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {enriched.filter(v => !v.isPairedTrailer && v.id !== modalVehicle?.id && (v as any).vehicle_type === "trailer").length} trailers available
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Comments / Notes</label>
                <textarea value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} rows={3} placeholder="e.g. Waiting for PO approval from Eslynn, ETA Friday" className={inputCls} />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Save Status
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Temp Vehicle Modal */}
      {showTempVehicle && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setShowTempVehicle(false)} />
          <div className="w-full max-w-md bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">Add Temporary Vehicle</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Replacement or visiting vehicle not in permanent fleet</p>
              </div>
              <button onClick={() => setShowTempVehicle(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-xs text-warning">
                This vehicle is temporary and will be flagged as such in reports. It won't affect your permanent fleet records.
              </div>
              <div><label className={labelCls}>Registration Number *</label><input value={tempForm.registration_number} onChange={e => setTempForm({ ...tempForm, registration_number: e.target.value.toUpperCase() })} placeholder="e.g. KR53YMGP" className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Make</label><input value={tempForm.make} onChange={e => setTempForm({ ...tempForm, make: e.target.value })} placeholder="e.g. Hino" className={inputCls} /></div>
                <div><label className={labelCls}>Model</label><input value={tempForm.model} onChange={e => setTempForm({ ...tempForm, model: e.target.value })} placeholder="e.g. 500" className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>From Branch</label><input value={tempForm.from_branch} onChange={e => setTempForm({ ...tempForm, from_branch: e.target.value })} placeholder="e.g. Cape Town, East London" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Reason</label>
                <select value={tempForm.reason} onChange={e => setTempForm({ ...tempForm, reason: e.target.value })} className={inputCls}>
                  <option value="Replacement">Replacement vehicle</option>
                  <option value="Loan">Loan vehicle</option>
                  <option value="Transfer">Temporary transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div><label className={labelCls}>Current Site</label><input value={tempForm.current_site} onChange={e => setTempForm({ ...tempForm, current_site: e.target.value })} placeholder="e.g. Midrand" className={inputCls} /></div>
              <div><label className={labelCls}>Comments</label><textarea value={tempForm.comments} onChange={e => setTempForm({ ...tempForm, comments: e.target.value })} rows={2} placeholder="Any notes about this vehicle" className={inputCls} /></div>
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={handleSaveTemp} disabled={savingTemp} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {savingTemp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Temporary Vehicle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
