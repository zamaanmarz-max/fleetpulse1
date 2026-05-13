import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVehicles } from "@/hooks/useOrgData";
import {
  Truck, Wrench, MapPin, Ban, Clock, Loader2, X, Download,
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

const WAITING_FOR_OPTIONS = ["—", "Purchase Order (PO)", "Parts", "Workshop Slot", "Insurance Assessment", "Driver", "Fuel", "Other"];

export default function FleetAvailability() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: vehicles, isLoading: vLoading } = useVehicles();
  const [filter, setFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalVehicle, setModalVehicle] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [showWorkshopAnalysis, setShowWorkshopAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState<"fleet" | "analysis">("fleet");

  const { data: statuses } = useQuery({
    queryKey: ["vehicle_statuses", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_status").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
    staleTime: 0, refetchOnMount: "always",
  });

  const statusMap = new Map<string, any>();
  (statuses || []).forEach(s => { if (!statusMap.has(s.vehicle_id)) statusMap.set(s.vehicle_id, s); });

  const enriched = (vehicles || []).map(v => {
    const st = statusMap.get(v.id);
    return {
      ...v,
      currentStatus: st?.status || "available",
      statusRecord: st || null,
      branch: (v as any).branch || st?.branch || null,
    };
  });

  // Branches — only show branches that have vehicles assigned
  const assignedBranches = Array.from(new Set(enriched.map(v => v.branch).filter(Boolean)));
  const unassignedCount = enriched.filter(v => !v.branch).length;
  const branches = ["all", ...assignedBranches, ...(unassignedCount > 0 ? ["unassigned"] : [])];

  const filtered = enriched.filter(v => {
    if (filter !== "all" && v.currentStatus !== filter) return false;
    if (branchFilter === "unassigned" && v.branch) return false;
    if (branchFilter !== "all" && branchFilter !== "unassigned" && v.branch !== branchFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return v.registration_number.toLowerCase().includes(s) ||
        ((v as any).fleet_number || "").toLowerCase().includes(s) ||
        ((v as any).make || "").toLowerCase().includes(s) ||
        (v.branch || "").toLowerCase().includes(s);
    }
    return true;
  });

  const counts = useMemo(() => {
    const c = { available: 0, out_for_repair: 0, on_route: 0, off_road: 0, standby: 0 };
    enriched.filter(v => branchFilter === "all" || v.branch === branchFilter)
      .forEach(v => { if (c[v.currentStatus as keyof typeof c] !== undefined) c[v.currentStatus as keyof typeof c]++; });
    return c;
  }, [enriched, branchFilter]);

  // Workshop analysis
  const workshopAnalysis = useMemo(() => {
    const map: Record<string, { count: number; totalDays: number; vehicles: string[] }> = {};
    enriched.filter(v => v.currentStatus === "out_for_repair").forEach(v => {
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
    setForm({
      status: v.currentStatus,
      workshop_name: st?.workshop_name || "",
      workshop_contact: st?.workshop_contact || "",
      date_sent_for_repair: st?.date_sent_for_repair || new Date().toISOString().split("T")[0],
      repair_description: st?.repair_description || "",
      estimated_return_date: st?.estimated_return_date || "",
      actual_return_date: st?.actual_return_date || "",
      repair_cost: st?.repair_cost?.toString() || "",
      comments: st?.comments || "",
      waiting_for: st?.waiting_for || "—",
      branch: v.branch || "",
    });
    setModalVehicle(v);
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
      branch: form.branch || null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    };
    const existing = modalVehicle.statusRecord;
    const { error } = existing
      ? await supabase.from("vehicle_status").update(payload).eq("id", existing.id)
      : await supabase.from("vehicle_status").insert(payload);

    // Also update branch on vehicles table if set
    if (form.branch && form.branch !== modalVehicle.branch) {
      await supabase.from("vehicles").update({ branch: form.branch } as any).eq("id", modalVehicle.id);
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${modalVehicle.registration_number} updated`);
    setModalVehicle(null);
    qc.invalidateQueries({ queryKey: ["vehicle_statuses"] });
    qc.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const exportPDF = (branchName?: string) => {
    const doc = new jsPDF({ orientation: "landscape" });
    const scope = branchName || branchFilter !== "all" ? (branchFilter !== "all" ? branchFilter : "All Branches") : "All Branches";
    const data = filtered;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 22, "F");
    doc.setTextColor(255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("MARZ FleetPulse — Fleet Availability Report", 14, 10);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Branch: ${scope} | Generated: ${new Date().toLocaleString("en-ZA")} | Vector Logistics`, 14, 17);

    // Summary stats
    const branchData = branchFilter !== "all" ? enriched.filter(v => v.branch === branchFilter) : enriched;
    const total = branchData.length;
    const avail = branchData.filter(v => v.currentStatus === "available").length;
    const repair = branchData.filter(v => v.currentStatus === "out_for_repair").length;

    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Total: ${total}  |  Available: ${avail} (${total > 0 ? Math.round((avail/total)*100) : 0}%)  |  Out for Repair: ${repair}  |  Other: ${total - avail - repair}`, 14, 30);

    // Vehicles table
    const rows = data.map(v => {
      const st = v.statusRecord;
      const daysOut = st?.date_sent_for_repair
        ? Math.ceil((Date.now() - new Date(st.date_sent_for_repair).getTime()) / 86400000)
        : "-";
      return [
        (v as any).fleet_number || "-",
        v.registration_number,
        `${(v as any).make || ""} ${(v as any).model || ""}`.trim() || "-",
        v.branch || "-",
        STATUS_CONFIG[v.currentStatus]?.label || v.currentStatus,
        st?.workshop_name || "-",
        st?.date_sent_for_repair || "-",
        st?.estimated_return_date || "No ETA",
        String(daysOut),
        st?.waiting_for || "-",
        st?.comments || "-",
        st?.repair_cost ? `R ${Number(st.repair_cost).toLocaleString()}` : "-",
      ];
    });

    autoTable(doc, {
      startY: 36,
      head: [["Fleet #", "Reg", "Make/Model", "Branch", "Status", "Workshop", "Date Out", "ETA", "Days", "Waiting For", "Comments", "Cost"]],
      body: rows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        4: { fontStyle: "bold" },
        10: { cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const val = data.cell.text[0];
          if (val === "Available") data.cell.styles.textColor = [21, 128, 61];
          else if (val === "Out for Repair") data.cell.styles.textColor = [153, 27, 27];
          else if (val === "On Route") data.cell.styles.textColor = [29, 78, 216];
        }
      },
    });

    // Workshop analysis
    if (workshopAnalysis.length > 0) {
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Workshop Downtime Analysis", 14, finalY);
      autoTable(doc, {
        startY: finalY + 4,
        head: [["Workshop", "Vehicles Currently In", "Total Days Out", "Avg Days Per Vehicle"]],
        body: workshopAnalysis.map(w => [w.workshop, String(w.count), String(w.totalDays), String(w.avgDays)]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: "bold" },
      });
    }

    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("MARZ Technologies (Pty) Ltd | fleet.marzai.co.za", 14, doc.internal.pageSize.height - 6);

    doc.save(`Fleet_Availability_${scope.replace(/ /g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF exported");
  };

  const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block text-sm font-medium text-foreground mb-1";

  if (vLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Availability</h1>
          <p className="text-muted-foreground text-sm">Vehicle status, workshop tracking and downtime analysis</p>
        </div>
        <button onClick={() => exportPDF()} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
          <Download className="w-4 h-4" /> Export PDF
        </button>
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
                  {["Fleet #", "Registration", "Branch", "Status", "Workshop", "Date Out", "ETA", "Days Out", "Waiting For", "Comments"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">No vehicles found</td></tr>
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
                      <td className="px-4 py-3 text-sm text-muted-foreground">{v.branch || "—"}</td>
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
                  <label className={labelCls}>Branch</label>
                  <input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} placeholder="e.g. Midrand" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Workshop</label>
                  <input value={form.workshop_name} onChange={e => setForm({ ...form, workshop_name: e.target.value })} placeholder="e.g. AC&R" className={inputCls} />
                </div>
              </div>

              {form.status === "out_for_repair" && (
                <>
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
                    <select value={form.waiting_for} onChange={e => setForm({ ...form, waiting_for: e.target.value })} className={inputCls}>
                      {WAITING_FOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Repair Description</label>
                    <textarea value={form.repair_description} onChange={e => setForm({ ...form, repair_description: e.target.value })} rows={2} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Estimated Cost (R)</label>
                    <input type="number" value={form.repair_cost} onChange={e => setForm({ ...form, repair_cost: e.target.value })} placeholder="0" className={inputCls} />
                  </div>
                </>
              )}

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
    </div>
  );
}
