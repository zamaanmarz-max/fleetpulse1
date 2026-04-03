import { Search, Filter, Plus, Download, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useFines, useVehicles, useDrivers } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const statusStyles: Record<string, string> = {
  unpaid: "bg-destructive/20 text-destructive",
  paid: "bg-success/20 text-success",
  disputed: "bg-warning/20 text-warning",
};

export default function Fines() {
  const { data: fines, isLoading } = useFines();
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const totalOutstanding = (fines || []).filter((f) => f.payment_status === "unpaid").reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const totalDemerits = (fines || []).reduce((sum, f) => sum + (f.demerit_points_applied || 0), 0);

  const [form, setForm] = useState({
    vehicle_id: "", driver_id: "", fine_number: "", issuing_authority: "",
    amount: "", offence_date: "", offence_description: "", demerit_points_applied: "0",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!profile?.organisation_id) return;
    setSaving(true);
    const { error } = await supabase.from("fines").insert({
      organisation_id: profile.organisation_id,
      vehicle_id: form.vehicle_id || null,
      driver_id: form.driver_id || null,
      fine_number: form.fine_number || null,
      issuing_authority: form.issuing_authority || null,
      amount: form.amount ? parseFloat(form.amount) : null,
      offence_date: form.offence_date || null,
      offence_description: form.offence_description || null,
      demerit_points_applied: parseInt(form.demerit_points_applied) || 0,
    });
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Fine added");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["fines"] });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fines & AARTO</h1>
          <p className="text-sm text-muted-foreground">Traffic fine and demerit point management</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Fine
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Fines</p><p className="text-2xl font-bold text-foreground mt-1">{(fines || []).length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding</p><p className="text-2xl font-bold text-destructive mt-1">R {totalOutstanding.toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Demerits</p><p className="text-2xl font-bold text-warning mt-1">{totalDemerits}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">BRN Risk</p><p className="text-2xl font-bold text-success mt-1">{(fines || []).filter(f => f.payment_status === "unpaid").length > 5 ? "High" : (fines || []).filter(f => f.payment_status === "unpaid").length > 2 ? "Medium" : "Low"}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (fines || []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No fines recorded.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fine No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vehicle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Authority</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Demerits</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {(fines || []).map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-foreground">{f.fine_number || "-"}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{(f as any).vehicles?.registration_number || "-"}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{(f as any).drivers?.full_name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{f.issuing_authority || "-"}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-foreground">R {(Number(f.amount) || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-center font-mono text-warning">{f.demerit_points_applied || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[f.payment_status || "unpaid"]}`}>{f.payment_status || "unpaid"}</span>
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
              <h2 className="text-lg font-bold text-foreground">Add Fine</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Vehicle</label>
              <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select vehicle</option>
                {(vehicles || []).map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Driver</label>
              <select value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select driver</option>
                {(drivers || []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            {[
              { key: "fine_number", label: "Fine Number", type: "text" },
              { key: "issuing_authority", label: "Issuing Authority", type: "text" },
              { key: "amount", label: "Amount (R)", type: "number" },
              { key: "offence_date", label: "Offence Date", type: "date" },
              { key: "offence_description", label: "Offence Description", type: "text" },
              { key: "demerit_points_applied", label: "Demerit Points", type: "number" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
            <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Fine
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
