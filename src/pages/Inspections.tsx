import { Search, Filter, Plus, Download, ClipboardCheck, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useInspections, useVehicles } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const conditionStyles: Record<string, string> = {
  good: "bg-success/20 text-success",
  fair: "bg-warning/20 text-warning",
  poor: "bg-destructive/20 text-destructive",
  unroadworthy: "bg-destructive/30 text-destructive",
};

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/20 text-primary",
  reviewed: "bg-success/20 text-success",
};

export default function Inspections() {
  const { data: inspections, isLoading } = useInspections();
  const { data: vehicles } = useVehicles();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "", overall_condition: "good", odometer_at_inspection: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.vehicle_id || !profile?.organisation_id) {
      toast.error("Please select a vehicle");
      return;
    }
    setSaving(true);
    const vehicle = (vehicles || []).find((v) => v.id === form.vehicle_id);
    const { error } = await supabase.from("damage_inspections").insert({
      organisation_id: profile.organisation_id,
      vehicle_id: form.vehicle_id,
      branch_id: vehicle?.branch_id || null,
      inspector_id: user?.id || null,
      overall_condition: form.overall_condition,
      odometer_at_inspection: form.odometer_at_inspection ? parseInt(form.odometer_at_inspection) : null,
      notes: form.notes || null,
      status: "submitted",
    });
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Inspection submitted");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Damage Inspections</h1>
          <p className="text-sm text-muted-foreground">Vehicle condition and damage tracking</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90">
          <ClipboardCheck className="w-5 h-5" /> Start New Inspection
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (inspections || []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No inspections yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vehicle</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inspector</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Condition</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Damage</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {(inspections || []).map((ins) => (
                <tr key={ins.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{(ins as any).vehicles?.registration_number || "N/A"}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{ins.inspection_date}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{(ins as any).inspector?.full_name || "N/A"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${conditionStyles[ins.overall_condition || "good"]}`}>{ins.overall_condition}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center font-mono text-foreground">{ins.total_damage_items ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-center font-mono">{(ins.new_damage_items ?? 0) > 0 ? <span className="text-warning">{ins.new_damage_items}</span> : <span className="text-muted-foreground">0</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[ins.status || "draft"]}`}>{ins.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/50" onClick={() => setShowForm(false)} />
          <div className="w-[450px] bg-card border-l border-border p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">New Inspection</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Vehicle *</label>
              <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select vehicle</option>
                {(vehicles || []).map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Overall Condition</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: "good", label: "Good", cls: "border-success text-success" },
                  { val: "fair", label: "Fair", cls: "border-warning text-warning" },
                  { val: "poor", label: "Poor", cls: "border-destructive text-destructive" },
                  { val: "unroadworthy", label: "Unroadworthy", cls: "border-destructive text-destructive" },
                ].map((c) => (
                  <button key={c.val} onClick={() => setForm({ ...form, overall_condition: c.val })} className={`p-3 rounded-lg border-2 text-sm font-semibold ${form.overall_condition === c.val ? c.cls + " bg-secondary" : "border-border text-muted-foreground"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Odometer Reading (km)</label>
              <input type="number" value={form.odometer_at_inspection} onChange={(e) => setForm({ ...form, odometer_at_inspection: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Submit Inspection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
