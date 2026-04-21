import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVehicles } from "@/hooks/useOrgData";
import {
  Truck, Wrench, MapPin, Ban, Clock, Loader2, X, Download, Search
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BranchFilter } from "@/components/filters/BranchFilter";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Truck }> = {
  available: { label: "Available", color: "bg-success/20 text-success", icon: Truck },
  out_for_repair: { label: "Out for Repair", color: "bg-destructive/20 text-destructive", icon: Wrench },
  on_route: { label: "On Route", color: "bg-primary/20 text-primary", icon: MapPin },
  off_road: { label: "Off Road", color: "bg-muted text-muted-foreground", icon: Ban },
  standby: { label: "Standby", color: "bg-warning/20 text-warning", icon: Clock },
};

function useVehicleStatuses() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["vehicle_statuses", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_status").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });
}

export default function FleetAvailability() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: vehicles, isLoading: vLoading } = useVehicles();
  const { data: statuses } = useVehicleStatuses();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [modalVehicle, setModalVehicle] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const statusMap = new Map<string, any>();
  (statuses || []).forEach(s => { if (!statusMap.has(s.vehicle_id)) statusMap.set(s.vehicle_id, s); });

  const enriched = (vehicles || []).map(v => {
    const st = statusMap.get(v.id);
    return { ...v, currentStatus: st?.status || "available", statusRecord: st || null };
  });

  const counts = { available: 0, out_for_repair: 0, on_route: 0, off_road: 0, standby: 0 };
  enriched.forEach(v => { if (counts[v.currentStatus as keyof typeof counts] !== undefined) counts[v.currentStatus as keyof typeof counts]++; });

  const filtered = enriched.filter(v => {
    if (filter !== "all" && v.currentStatus !== filter) return false;
    if (branchFilter && v.branch_id !== branchFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return v.registration_number.toLowerCase().includes(s) || (v.fleet_number || "").toLowerCase().includes(s) || (v.make || "").toLowerCase().includes(s);
    }
    return true;
  });

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
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    };
    const existing = modalVehicle.statusRecord;
    let error;
    if (existing) {
      ({ error } = await supabase.from("vehicle_status").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("vehicle_status").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success(`${modalVehicle.registration_number} status updated to ${STATUS_CONFIG[form.status]?.label}`);
      setModalVehicle(null);
      qc.invalidateQueries({ queryKey: ["vehicle_statuses"] });
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Fleet Availability Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | MARZ Fleet by MARZ Technologies`, 14, 30);

    doc.setFontSize(12);
    doc.text("Summary", 14, 42);
    doc.setFontSize(10);
    doc.text(`Total Fleet: ${enriched.length}`, 14, 50);
    doc.text(`Available: ${counts.available} (${enriched.length ? Math.round((counts.available / enriched.length) * 100) : 0}%)`, 14, 56);
    doc.text(`Out for Repair: ${counts.out_for_repair} (${enriched.length ? Math.round((counts.out_for_repair / enriched.length) * 100) : 0}%)`, 14, 62);

    const repairRows = enriched.filter(v => v.currentStatus === "out_for_repair").map(v => {
      const st = v.statusRecord;
      const daysOut = st?.date_sent_for_repair ? Math.ceil((Date.now() - new Date(st.date_sent_for_repair).getTime()) / 86400000) : "-";
      return [v.fleet_number || "-", v.registration_number, st?.workshop_name || "-", st?.date_sent_for_repair || "-", st?.estimated_return_date || "-", String(daysOut), st?.repair_description || "-", st?.repair_cost ? `R ${Number(st.repair_cost).toLocaleString()}` : "-"];
    });

    if (repairRows.length > 0) {
      doc.setFontSize(12);
      doc.text("Vehicles Out for Repair", 14, 74);
      autoTable(doc, {
        startY: 78,
        head: [["Fleet", "Reg", "Workshop", "Date Out", "ETA", "Days", "Description", "Cost"]],
        body: repairRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    const availRows = enriched.filter(v => v.currentStatus === "available").map(v => [v.fleet_number || "-", v.registration_number, `${v.make || ""} ${v.model || ""}`, "-", "Available"]);
    if (availRows.length > 0) {
      const y = (doc as any).lastAutoTable?.finalY || 90;
      doc.setFontSize(12);
      doc.text("Available Vehicles", 14, y + 10);
      autoTable(doc, {
        startY: y + 14,
        head: [["Fleet", "Reg", "Make/Model", "Branch", "Status"]],
        body: availRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [34, 197, 94] },
      });
    }

    doc.setFontSize(8);
    doc.text("MARZ Fleet by MARZ Technologies (Pty) Ltd. © 2026", 14, doc.internal.pageSize.height - 10);
    doc.save("Fleet_Availability_Report.pdf");
    toast.success("PDF exported");
  };

  if (vLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Availability</h1>
          <p className="text-muted-foreground text-sm">Track vehicle status and workshop repairs</p>
        </div>
        <button onClick={exportPDF} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
          <Download className="w-4 h-4" /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[string]][]).filter(([k]) => k !== "standby").map(([key, cfg]) => (
          <div key={key} className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/50" onClick={() => setFilter(filter === key ? "all" : key)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">{cfg.label}</span>
              <cfg.icon className={`w-5 h-5 ${cfg.color.split(" ")[1]}`} />
            </div>
            <p className={`text-3xl font-bold ${cfg.color.split(" ")[1]}`}>{counts[key as keyof typeof counts]}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicles..." className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <BranchFilter value={branchFilter} onChange={setBranchFilter} />
        <div className="flex gap-1 flex-wrap">
          {["all", ...Object.keys(STATUS_CONFIG)].map(key => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {key === "all" ? "All" : STATUS_CONFIG[key]?.label || key}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Fleet</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Reg</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Make/Model</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Workshop</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date Out</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">ETA Return</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Description</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(v => {
              const cfg = STATUS_CONFIG[v.currentStatus] || STATUS_CONFIG.available;
              const st = v.statusRecord;
              return (
                <tr key={v.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="px-4 py-3 text-foreground">{v.fleet_number || "-"}</td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground">{v.registration_number}</td>
                  <td className="px-4 py-3 text-foreground">{v.make} {v.model}</td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{st?.workshop_name || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{st?.date_sent_for_repair || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{st?.estimated_return_date || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{st?.repair_description || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openModal(v)} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 font-semibold">Change Status</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No vehicles found.</p>}
      </div>

      {/* Status Change Modal */}
      {modalVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Change Status — {modalVehicle.registration_number}</h3>
              <button onClick={() => setModalVehicle(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {form.status === "out_for_repair" && (
              <>
                <ModalField label="Workshop Name *" value={form.workshop_name} onChange={v => setForm({ ...form, workshop_name: v })} />
                <ModalField label="Workshop Contact" value={form.workshop_contact} onChange={v => setForm({ ...form, workshop_contact: v })} />
                <ModalField label="Date Sent" type="date" value={form.date_sent_for_repair} onChange={v => setForm({ ...form, date_sent_for_repair: v })} />
                <ModalField label="Repair Description" value={form.repair_description} onChange={v => setForm({ ...form, repair_description: v })} textarea />
                <ModalField label="Estimated Return Date" type="date" value={form.estimated_return_date} onChange={v => setForm({ ...form, estimated_return_date: v })} />
                <ModalField label="Cost Estimate (ZAR)" type="number" value={form.repair_cost} onChange={v => setForm({ ...form, repair_cost: v })} />
              </>
            )}

            {form.status === "available" && (
              <>
                <ModalField label="Actual Return Date" type="date" value={form.actual_return_date} onChange={v => setForm({ ...form, actual_return_date: v })} />
                <ModalField label="Final Repair Cost (ZAR)" type="number" value={form.repair_cost} onChange={v => setForm({ ...form, repair_cost: v })} />
              </>
            )}

            <ModalField label="Comments" value={form.comments} onChange={v => setForm({ ...form, comments: v })} textarea />

            <button onClick={handleSave} disabled={saving || (form.status === "out_for_repair" && !form.workshop_name)} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Status
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalField({ label, value, onChange, type = "text", textarea }: { label: string; value: string; onChange: (v: string) => void; type?: string; textarea?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
      )}
    </div>
  );
}
