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
import {
  getOrgBranding, drawReportHeader, drawReportFooter, drawStatBoxes, bandRow,
  loadLogoDataUrl, COLORS, fmtDate,
} from "@/lib/reportBranding";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:      { label: "Available",     color: "text-success",     bg: "bg-success/20" },
  out_for_repair: { label: "Out for Repair", color: "text-destructive", bg: "bg-destructive/20" },
  off_road:       { label: "Off Road",       color: "text-warning",     bg: "bg-warning/20" },
  standby:        { label: "Standby",        color: "text-muted-foreground", bg: "bg-muted" },
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

  const { data: statuses, refetch: refetchStatuses, isError: statusesError } = useQuery({
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
  const { data: branchList } = useQuery({
    queryKey: ["branches", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organisation_id,
  });
  const branchMap = new Map<string, string>();
  (branchList || []).forEach((b: any) => branchMap.set(b.id, b.name));

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
      currentSite: branchMap.get((v as any).branch_id) || (v as any).owning_branch || st?.current_site || null,
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

  // Group + order so the list isn't interleaved: all of one status together, in a fixed order
  const STATUS_ORDER: Record<string, number> = { out_for_repair: 0, off_road: 1, standby: 2, available: 3, on_route: 3, trailer: 8 };
  // Down trailers (out_for_repair / off_road) group WITH the repairs so they aren't
  // hidden in the trailer bucket. Only available/standby trailers go to "trailer".
  const groupKey = (v: any) => {
    const s = v.currentStatus === "on_route" ? "available" : v.currentStatus;
    if (v.vehicle_type === "trailer" && s !== "out_for_repair" && s !== "off_road") return "trailer";
    return s;
  };
  const groupedFiltered = [...filtered].sort((a, b) => {
    const sa = STATUS_ORDER[groupKey(a)] ?? 9, sb = STATUS_ORDER[groupKey(b)] ?? 9;
    if (sa !== sb) return sa - sb;
    const fa = parseInt((a as any).fleet_number) || 99999, fb = parseInt((b as any).fleet_number) || 99999;
    if (fa !== fb) return fa - fb;
    return a.registration_number.localeCompare(b.registration_number);
  });
  const groupCounts = groupedFiltered.reduce((acc: Record<string, number>, v) => { const k = groupKey(v); acc[k] = (acc[k] || 0) + 1; return acc; }, {});

  const counts = useMemo(() => {
    const c = { available: 0, out_for_repair: 0, off_road: 0, standby: 0, total: 0 };
    // Only count non-paired-trailer vehicles for totals
    unpaired
      .filter(v => (v as any).vehicle_type !== "trailer")
      .filter(v => branchFilter === "all" || branchFilter === "unassigned" || v.currentSite === branchFilter)
      .forEach(v => {
        c.total++;
        const status = v.currentStatus === "on_route" ? "available" : v.currentStatus;
        if (c[status as keyof typeof c] !== undefined) (c[status as keyof typeof c] as number)++;
      });
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
      branch_id: (v as any).branch_id || "",
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
      date_sent_for_repair: form.date_sent_for_repair || null,
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
    // Sync current site -> vehicle branch (so it matches the Vehicles tab both ways)
    if (form.branch_id !== undefined && form.branch_id !== ((modalVehicle as any).branch_id || "")) {
      await supabase.from("vehicles").update({ branch_id: form.branch_id || null } as any).eq("id", modalVehicle.id);
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${modalVehicle.registration_number} updated`);
    setModalVehicle(null);
    qc.invalidateQueries({ queryKey: ["vehicle_statuses"] });
    qc.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const exportPDF = async (reportType: string = "manager") => {
    const isCustomer = reportType === "customer";
    const scope = branchFilter !== "all" ? branchFilter : "All Sites";
    const org = getOrgBranding(profile);
    const data = groupedFiltered;
    const today = new Date();

    try {
      const doc = new jsPDF({ orientation: "landscape" });
      const logo = await loadLogoDataUrl(org.logo_url);

      const startY = drawReportHeader(doc, {
        org,
        title: isCustomer ? "FLEET STATUS" : "FLEET AVAILABILITY",
        scope,
        reportTag: isCustomer ? "CLIENT REPORT" : "MANAGER REPORT",
        logo,
      });

      // Stat tally — fleet vehicles only (trailers are excluded from fleet totals)
      const fleetVehicles = data.filter(v => (v as any).vehicle_type !== "trailer");
      const total = fleetVehicles.length;
      const avail = fleetVehicles.filter(v => v.currentStatus === "available" || v.currentStatus === "on_route").length;
      const repair = fleetVehicles.filter(v => v.currentStatus === "out_for_repair").length;
      const offRoad = fleetVehicles.filter(v => v.currentStatus === "off_road").length;
      const standby = fleetVehicles.filter(v => v.currentStatus === "standby").length;
      const availPct = total > 0 ? Math.round((avail / total) * 100) : 0;
      const afterStats = drawStatBoxes(doc, 14, startY, [
        { label: "Total Fleet", value: String(total), color: COLORS.primary },
        { label: "Available", value: `${avail} (${availPct}%)`, color: COLORS.green },
        { label: "Out for Repair", value: String(repair), color: COLORS.red },
        { label: "Off Road", value: String(offRoad), color: COLORS.amber },
        { label: "Standby", value: String(standby), color: COLORS.grey },
      ]);

      // Groups in render order. Down trailers fall into repair/off_road via groupKey;
      // only available/standby trailers land in the "trailer" bucket.
      const GROUPS: { key: string; label: string; color: [number, number, number] }[] = [
        { key: "out_for_repair", label: "OUT FOR REPAIR", color: COLORS.red },
        { key: "off_road", label: "OFF ROAD", color: COLORS.amber },
        { key: "standby", label: "STANDBY", color: COLORS.grey },
        { key: "available", label: "AVAILABLE", color: COLORS.green },
        { key: "trailer", label: "TRAILERS — not counted in fleet total", color: COLORS.primary },
      ];
      const isRepairGroup = (k: string) => k === "out_for_repair" || k === "off_road";

      const NCOLS = isCustomer ? 7 : 11;
      const body: any[] = [];

      GROUPS.forEach(g => {
        const groupRows = data.filter(v => groupKey(v) === g.key);
        if (groupRows.length === 0) return;
        body.push(bandRow(g.label, groupRows.length, NCOLS, g.color));
        groupRows.forEach(v => {
          const st = v.statusRecord;
          // Available / Standby / Trailer rows must never show ETA, Date Out or Days.
          const showRepairCols = isRepairGroup(g.key);
          const daysOut = (v.currentStatus === "out_for_repair" && st?.date_sent_for_repair)
            ? Math.ceil((Date.now() - new Date(st.date_sent_for_repair).getTime()) / 86400000)
            : null;
          const trailerReg = v.pairedTrailer?.registration_number || "—";
          const makeType = (`${(v as any).make || ""} ${(v as any).model || ""}`.trim() || "—")
            + ((v as any).vehicle_type ? ` · ${(v as any).vehicle_type}` : "");
          const eta = showRepairCols ? (st?.estimated_return_date ? fmtDate(st.estimated_return_date) : "No ETA") : "";
          const dateOut = showRepairCols ? (st?.date_sent_for_repair ? fmtDate(st.date_sent_for_repair) : "—") : "";
          const daysCell = (showRepairCols && daysOut !== null) ? `${daysOut}d` : "";
          const notes = [st?.waiting_for, st?.comments].filter(Boolean).join(" · ") || "—";

          if (isCustomer) {
            body.push([
              (v as any).fleet_number || "—", v.registration_number, trailerReg, makeType,
              v.currentSite || "—", st?.workshop_name || "—", eta,
            ]);
          } else {
            body.push([
              (v as any).fleet_number || "—", v.registration_number, trailerReg, makeType,
              v.owningBranch || "—", v.currentSite || "—", st?.workshop_name || "—",
              dateOut, eta, daysCell, notes,
            ]);
          }
        });
      });

      autoTable(doc, {
        startY: afterStats + 6,
        head: isCustomer
          ? [["Fleet #", "Registration", "Trailer", "Make / Type", "Site", "Workshop", "ETA"]]
          : [["Fleet #", "Registration", "Trailer", "Make / Type", "Branch", "Site", "Workshop", "Date Out", "ETA", "Days", "Notes"]],
        body,
        styles: { fontSize: 8, cellPadding: 2.6, lineColor: [225, 228, 235], lineWidth: 0.1, valign: "middle", overflow: "linebreak" },
        headStyles: { fillColor: COLORS.navy, textColor: 255, fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: COLORS.faintRow },
        columnStyles: isCustomer
          ? { 0: { cellWidth: 18, halign: "center" }, 1: { cellWidth: 34, fontStyle: "bold" }, 2: { cellWidth: 30 }, 3: { cellWidth: 75 }, 4: { cellWidth: 42 }, 5: { cellWidth: 42 }, 6: { cellWidth: 28, halign: "center" } }
          : { 0: { cellWidth: 14, halign: "center" }, 1: { cellWidth: 24, fontStyle: "bold" }, 2: { cellWidth: 22 }, 3: { cellWidth: 40 }, 4: { cellWidth: 24 }, 5: { cellWidth: 24 }, 6: { cellWidth: 26 }, 7: { cellWidth: 20, halign: "center" }, 8: { cellWidth: 20, halign: "center" }, 9: { cellWidth: 13, halign: "center" } },
        didParseCell: (d) => {
          // Highlight long downtime (manager "Days" column).
          if (!isCustomer && d.section === "body" && d.column.index === 9) {
            const days = parseInt(d.cell.text[0]);
            if (!isNaN(days) && days > 14) { d.cell.styles.textColor = COLORS.red; d.cell.styles.fontStyle = "bold"; }
          }
        },
        margin: { left: 14, right: 14, bottom: 16 },
      });

      // Workshop downtime analysis (manager only)
      if (!isCustomer && workshopAnalysis.length > 0) {
        const W = doc.internal.pageSize.getWidth();
        const finalY = (doc as any).lastAutoTable.finalY + 8;
        const needsNewPage = finalY > doc.internal.pageSize.height - 60;
        if (needsNewPage) doc.addPage();
        const wsY = needsNewPage ? 20 : finalY;
        doc.setFillColor(...COLORS.navy);
        doc.rect(14, wsY, W - 28, 8, "F");
        doc.setTextColor(...COLORS.accent);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("WORKSHOP DOWNTIME ANALYSIS", 18, wsY + 5.5);
        doc.setTextColor(0, 0, 0);
        autoTable(doc, {
          startY: wsY + 10,
          head: [["Workshop", "Vehicles In", "Total Days", "Avg Days", "Vehicles"]],
          body: workshopAnalysis.map(w => [w.workshop, String(w.count), `${w.totalDays}d`, `${w.avgDays}d${w.avgDays > 14 ? " !" : ""}`, w.vehicles.join(", ")]),
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: COLORS.red, textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [255, 248, 248] },
          margin: { left: 14, right: 14, bottom: 16 },
        });
      }

      drawReportFooter(doc, org, isCustomer ? "Client copy" : "Internal use only");

      const safeOrg = (org.name || "Fleet").replace(/[^A-Za-z0-9]+/g, "_");
      doc.save(`${safeOrg}_Fleet_${isCustomer ? "Client" : "Manager"}_${scope.replace(/ /g, "_")}_${today.toISOString().split("T")[0]}.pdf`);
      toast.success(`${isCustomer ? "Client" : "Manager"} report downloaded`);
    } catch (e: any) {
      toast.error(e?.message || "Could not generate the report");
    }
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

      {/* Live status load error */}
      {statusesError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Couldn't load live vehicle statuses. Vehicles may show as available until this reconnects — refresh to try again.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="stat-card text-left p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Fleet</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{counts.total}</p>
        </div>
        {(["available", "out_for_repair", "off_road", "standby"] as const).map(key => (
          <button key={key} onClick={() => setFilter(prev => prev === key ? "all" : key)}
            className={`stat-card text-left p-3 transition-all ${filter === key ? "ring-2 ring-primary" : ""}`}>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{STATUS_CONFIG[key].label}</p>
            <p className={`text-2xl font-bold mt-1 ${STATUS_CONFIG[key].color}`}>{counts[key] || 0}</p>
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
                {groupedFiltered.length === 0 ? (
                  <tr><td colSpan={13} className="px-4 py-8 text-center text-sm text-muted-foreground">No vehicles found</td></tr>
                ) : groupedFiltered.flatMap((v, i) => {
                  const st = v.statusRecord;
                  const daysOut = (v.currentStatus === "out_for_repair" && st?.date_sent_for_repair)
                    ? Math.ceil((Date.now() - new Date(st.date_sent_for_repair).getTime()) / 86400000)
                    : null;
                  const cfg = STATUS_CONFIG[v.currentStatus] || STATUS_CONFIG.available;
                  const isLongOut = daysOut !== null && daysOut > 14;
                  const gk = groupKey(v);
                  const showHeader = i === 0 || groupKey(groupedFiltered[i - 1]) !== gk;
                  const groupLabel = gk === "trailer" ? "Trailers — not counted in fleet total" : cfg.label;
                  const groupColor = gk === "trailer" ? "text-primary" : cfg.color;
                  return [
                    showHeader ? (
                      <tr key={`hdr-${gk}`} className="bg-secondary/40 border-y border-border">
                        <td colSpan={13} className="px-4 py-2 text-xs font-bold uppercase tracking-wider">
                          <span className={groupColor}>{groupLabel}</span>
                          <span className="text-muted-foreground ml-2">· {groupCounts[gk]} vehicle{groupCounts[gk] === 1 ? "" : "s"}</span>
                        </td>
                      </tr>
                    ) : null,
                    <tr key={v.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${isLongOut ? "bg-destructive/5" : ""}`}>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{(v as any).fleet_number || "—"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">
                        {v.registration_number}
                        {(v as any).vehicle_type && <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{(v as any).vehicle_type}</span>}
                      </td>
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
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{(v.currentStatus !== "available" && v.currentStatus !== "standby") ? (st?.date_sent_for_repair || "—") : "—"}</td>
                      <td className="px-4 py-3">
                        {v.currentStatus !== "available" && v.currentStatus !== "standby" && (
                          st?.estimated_return_date
                            ? <span className={`text-sm ${new Date(st.estimated_return_date) < new Date() ? "text-destructive font-semibold" : "text-foreground"}`}>{st.estimated_return_date}</span>
                            : <span className="text-xs text-warning">No ETA</span>
                        )}
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
                  ];
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
                  <label className={labelCls}>Current Site / Branch</label>
                  <select value={form.branch_id || ""} onChange={e => setForm({ ...form, branch_id: e.target.value })} className={inputCls}>
                    <option value="">— Select site —</option>
                    {(branchList || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Synced with the vehicle's branch — transferring on the Vehicles tab updates this, and vice-versa.</p>
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
                  <span className="text-xs font-normal text-muted-foreground">— {(modalVehicle as any)?.vehicle_type === "trailer" ? "This is a trailer" : (modalVehicle as any)?.vehicle_type === "horse" ? "This is a horse" : "Not a horse — no trailer pairing"}</span>
                </p>
                {(modalVehicle as any)?.vehicle_type === "trailer" ? (
                  <p className="text-xs text-muted-foreground">Trailers are paired from the horse vehicle. Find the horse this trailer is attached to and pair from there.</p>
                ) : (modalVehicle as any)?.vehicle_type !== "horse" ? (
                  <p className="text-xs text-muted-foreground">Only horses (truck-tractors) pair with trailers — nothing to pair for this vehicle.</p>
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
