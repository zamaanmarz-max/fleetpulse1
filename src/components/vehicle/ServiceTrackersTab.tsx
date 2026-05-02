import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Loader2, X, Pencil, Trash2, RefreshCw, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { computeNextDue, computeTrackerStatus, ServiceTracker, TrackingType } from "@/lib/serviceTrackers";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  vehicleId: string;
  organisationId: string | null;
  currentKm: number;
}

const PRESETS = [
  { name: "Tyre Rotation", type: "km" as const, interval: 10000 },
  { name: "Oil Change", type: "km" as const, interval: 5000 },
  { name: "Brake Inspection", type: "km" as const, interval: 20000 },
  { name: "Fifth Wheel Greasing", type: "days" as const, interval: 90 },
  { name: "Fridge Service", type: "hours" as const, interval: 500 },
];

const statusBadge: Record<string, string> = {
  ok: "bg-success/20 text-success",
  due_soon: "bg-warning/20 text-warning",
  overdue: "bg-destructive/20 text-destructive",
};

const statusLabel: Record<string, string> = {
  ok: "OK", due_soon: "Due Soon", overdue: "Overdue",
};

export function ServiceTrackersTab({ vehicleId, organisationId, currentKm }: Props) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServiceTracker | null>(null);
  const [updating, setUpdating] = useState<ServiceTracker | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tracker_name: "", tracking_type: "km" as TrackingType,
    interval_value: "", last_done_value: "", last_done_date: new Date().toISOString().split("T")[0], notes: "",
  });

  const [updateForm, setUpdateForm] = useState({ value: "", date: new Date().toISOString().split("T")[0], notes: "" });

  const { data: trackers, isLoading } = useQuery({
    queryKey: ["service_trackers", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_service_trackers" as any).select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ServiceTracker[];
    },
  });

  const resetForm = () => setForm({
    tracker_name: "", tracking_type: "km", interval_value: "", last_done_value: "",
    last_done_date: new Date().toISOString().split("T")[0], notes: "",
  });

  const usePreset = (p: typeof PRESETS[0]) => {
    setForm(f => ({ ...f, tracker_name: p.name, tracking_type: p.type, interval_value: String(p.interval) }));
  };

  const handleSave = async () => {
    if (!form.tracker_name || !form.interval_value) { toast.error("Tracker name and interval are required"); return; }
    const interval = parseFloat(form.interval_value);
    if (isNaN(interval) || interval <= 0) { toast.error("Interval must be a positive number"); return; }

    setSaving(true);
    const lastValue = form.tracking_type === "days" ? null : (parseFloat(form.last_done_value) || (form.tracking_type === "km" ? currentKm : 0));
    const next = computeNextDue(form.tracking_type, interval, lastValue, form.last_done_date);

    const payload: any = {
      vehicle_id: vehicleId,
      organisation_id: organisationId,
      tracker_name: form.tracker_name,
      tracking_type: form.tracking_type,
      interval_value: interval,
      last_done_value: lastValue,
      last_done_date: form.last_done_date,
      notes: form.notes || null,
      ...next,
    };

    const op = editing
      ? supabase.from("vehicle_service_trackers" as any).update(payload).eq("id", editing.id)
      : supabase.from("vehicle_service_trackers" as any).insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Tracker updated" : "Tracker added");
    setShowForm(false); setEditing(null); resetForm();
    qc.invalidateQueries({ queryKey: ["service_trackers", vehicleId] });
    qc.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
  };

  const startEdit = (t: ServiceTracker) => {
    setEditing(t);
    setForm({
      tracker_name: t.tracker_name,
      tracking_type: (t.tracking_type as TrackingType) || "km",
      interval_value: String(t.interval_value ?? ""),
      last_done_value: t.last_done_value !== null ? String(t.last_done_value) : "",
      last_done_date: t.last_done_date || new Date().toISOString().split("T")[0],
      notes: t.notes || "",
    });
    setShowForm(true);
  };

  const startUpdate = (t: ServiceTracker) => {
    setUpdating(t);
    setUpdateForm({
      value: t.tracking_type === "km" ? String(currentKm) : t.tracking_type === "hours" ? String(t.last_done_value ?? 0) : "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const handleUpdateTracker = async () => {
    if (!updating) return;
    setSaving(true);
    const lastValue = updating.tracking_type === "days" ? null : parseFloat(updateForm.value);
    if (updating.tracking_type !== "days" && (isNaN(lastValue!) || lastValue! < 0)) {
      toast.error("Enter a valid reading"); setSaving(false); return;
    }
    const next = computeNextDue(updating.tracking_type, Number(updating.interval_value), lastValue, updateForm.date);
    const { error } = await supabase.from("vehicle_service_trackers" as any).update({
      last_done_value: lastValue,
      last_done_date: updateForm.date,
      notes: updateForm.notes || updating.notes,
      ...next,
    }).eq("id", updating.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tracker reset");
    setUpdating(null);
    qc.invalidateQueries({ queryKey: ["service_trackers", vehicleId] });
    qc.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("vehicle_service_trackers" as any).delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Tracker deleted");
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: ["service_trackers", vehicleId] });
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const list = (trackers || []).map(t => ({ t, status: computeTrackerStatus(t, currentKm) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Service Trackers ({list.length})</h3>
        </div>
        <button onClick={() => { setEditing(null); resetForm(); setShowForm(true); }} className="flex items-center gap-2 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> Add Service Tracker
        </button>
      </div>

      <div className="glass-card overflow-x-auto">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">No trackers yet. Add one to monitor recurring service items.</p>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Tracker</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Last Done</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Next Due</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Remaining</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ t, status }) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{t.tracker_name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{t.tracking_type} / every {Number(t.interval_value).toLocaleString()}{t.tracking_type === "km" ? " km" : t.tracking_type === "days" ? " days" : " hrs"}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {t.last_done_date || "-"}
                    {t.last_done_value !== null && <span className="text-xs text-muted-foreground ml-1">@ {Number(t.last_done_value).toLocaleString()}{t.tracking_type === "km" ? " km" : " hrs"}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {t.tracking_type === "days" ? (t.next_due_date || "-") : (t.next_due_value !== null ? `${Number(t.next_due_value).toLocaleString()}${t.tracking_type === "km" ? " km" : " hrs"}` : "-")}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{status.remainingLabel}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadge[status.status]}`}>{statusLabel[status.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => startUpdate(t)} title="Reset / Update" className="text-muted-foreground hover:text-success p-1"><RefreshCw className="w-4 h-4" /></button>
                      <button onClick={() => startEdit(t)} title="Edit" className="text-muted-foreground hover:text-primary p-1"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(t.id)} title="Delete" className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / edit form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row">
          <div className="flex-1 bg-background/50" onClick={() => { setShowForm(false); setEditing(null); }} />
          <div className="w-full md:w-[450px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen md:max-h-full">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{editing ? "Edit Tracker" : "Add Service Tracker"}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            {!editing && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Quick presets:</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map(p => (
                    <button key={p.name} onClick={() => usePreset(p)} className="text-xs bg-secondary hover:bg-secondary/80 text-foreground px-2 py-1 rounded">{p.name}</button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tracker Name *</label>
              <input value={form.tracker_name} onChange={e => setForm({ ...form, tracker_name: e.target.value })} placeholder="e.g. Tyre Rotation" className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tracking Type *</label>
              <select value={form.tracking_type} onChange={e => setForm({ ...form, tracking_type: e.target.value as TrackingType })} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="km">By KM interval</option>
                <option value="days">By time interval (days)</option>
                <option value="hours">By hours (e.g. fridge units)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Interval *</label>
              <input type="number" value={form.interval_value} onChange={e => setForm({ ...form, interval_value: e.target.value })} placeholder={form.tracking_type === "days" ? "e.g. 90" : form.tracking_type === "hours" ? "e.g. 500" : "e.g. 10000"} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            {form.tracking_type !== "days" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Last Done {form.tracking_type === "km" ? "(KM)" : "(Hours)"}</label>
                <input type="number" value={form.last_done_value} onChange={e => setForm({ ...form, last_done_value: e.target.value })} placeholder={form.tracking_type === "km" ? `Default: ${currentKm.toLocaleString()}` : "0"} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Last Done Date</label>
              <input type="date" value={form.last_done_date} onChange={e => setForm({ ...form, last_done_date: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {editing ? "Save Changes" : "Add Tracker"}
            </button>
          </div>
        </div>
      )}

      {/* Update tracker (reset) dialog */}
      {updating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60" onClick={() => setUpdating(null)}>
          <div className="bg-card border border-border rounded-lg p-6 w-[420px] max-w-[95vw] space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Reset {updating.tracker_name}</h3>
              <button onClick={() => setUpdating(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            {updating.tracking_type !== "days" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{updating.tracking_type === "km" ? "Current KM Reading" : "Hours Reading"} *</label>
                <input type="number" value={updateForm.value} onChange={e => setUpdateForm({ ...updateForm, value: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Service Date</label>
              <input type="date" value={updateForm.date} onChange={e => setUpdateForm({ ...updateForm, date: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
              <textarea value={updateForm.notes} onChange={e => setUpdateForm({ ...updateForm, notes: e.target.value })} rows={2} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <button onClick={handleUpdateTracker} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Mark Done & Reset
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tracker?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this service tracker. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
