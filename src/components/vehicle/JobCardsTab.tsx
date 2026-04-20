import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, X, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const JOB_TYPES = [
  "Scheduled Service", "Breakdown Repair", "Accident Repair", "Tyre Replacement",
  "Electrical Fault", "Body Repair", "Refrigeration Repair", "Tail Lift Repair",
  "Brake Service", "Other",
];

const STATUSES: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const statusStyles: Record<string, string> = {
  open: "bg-warning/20 text-warning",
  in_progress: "bg-primary/20 text-primary",
  completed: "bg-success/20 text-success",
};

interface Props {
  vehicleId: string;
  organisationId: string | null;
}

const emptyForm = {
  job_card_number: "", work_date: new Date().toISOString().split("T")[0],
  workshop_name: "", workshop_contact: "", job_type: "Scheduled Service",
  description: "", parts_replaced: "", labour_cost: "", parts_cost: "",
  invoice_number: "", status: "open", completed_date: "", odometer_reading: "",
};

export function JobCardsTab({ vehicleId, organisationId }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);

  const { data: jobCards, isLoading } = useQuery({
    queryKey: ["job_cards", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("work_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalSpent = (jobCards || []).reduce((sum, jc) => sum + (Number(jc.total_cost) || 0), 0);

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFile(null);
    setShowForm(true);
  };

  const openEditForm = (jc: any) => {
    setEditingId(jc.id);
    setForm({
      job_card_number: jc.job_card_number || "",
      work_date: jc.work_date || new Date().toISOString().split("T")[0],
      workshop_name: jc.workshop_name || "",
      workshop_contact: jc.workshop_contact || "",
      job_type: jc.job_type || "Scheduled Service",
      description: jc.description || "",
      parts_replaced: jc.parts_replaced || "",
      labour_cost: jc.labour_cost != null ? String(jc.labour_cost) : "",
      parts_cost: jc.parts_cost != null ? String(jc.parts_cost) : "",
      invoice_number: jc.invoice_number || "",
      status: jc.status || "open",
      completed_date: jc.completed_date || "",
      odometer_reading: jc.odometer_reading != null ? String(jc.odometer_reading) : "",
    });
    setFile(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.workshop_name || !form.job_type) {
      toast.error("Workshop name and job type are required");
      return;
    }
    setSaving(true);
    let fileUrl: string | null | undefined = undefined;
    if (file && organisationId) {
      const path = `${organisationId}/job_cards/${vehicleId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (!upErr) fileUrl = path;
    }
    const payload: any = {
      organisation_id: organisationId,
      vehicle_id: vehicleId,
      job_card_number: form.job_card_number || null,
      work_date: form.work_date,
      workshop_name: form.workshop_name,
      workshop_contact: form.workshop_contact || null,
      job_type: form.job_type,
      description: form.description || null,
      parts_replaced: form.parts_replaced || null,
      labour_cost: parseFloat(form.labour_cost) || 0,
      parts_cost: parseFloat(form.parts_cost) || 0,
      invoice_number: form.invoice_number || null,
      status: form.status,
      completed_date: form.status === "completed" ? (form.completed_date || new Date().toISOString().split("T")[0]) : null,
      odometer_reading: parseInt(form.odometer_reading) || null,
    };
    if (fileUrl !== undefined) payload.invoice_file_url = fileUrl;

    const op = editingId
      ? supabase.from("job_cards").update(payload).eq("id", editingId)
      : supabase.from("job_cards").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Job card updated" : "Job card added");
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFile(null);
    queryClient.invalidateQueries({ queryKey: ["job_cards", vehicleId] });
  };

  const handleStatusChange = async (jc: any, newStatus: string) => {
    const update: any = { status: newStatus };
    if (newStatus === "completed" && !jc.completed_date) {
      update.completed_date = new Date().toISOString().split("T")[0];
    }
    const { error } = await supabase.from("job_cards").update(update).eq("id", jc.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status set to ${newStatus.replace("_", " ")}`);
    queryClient.invalidateQueries({ queryKey: ["job_cards", vehicleId] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("job_cards").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Job card deleted");
    setDeleteId(null);
    queryClient.invalidateQueries({ queryKey: ["job_cards", vehicleId] });
  };

  const viewInvoice = async (url: string) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Could not load file");
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Job Cards ({(jobCards || []).length})</h3>
          <p className="text-xs text-muted-foreground">Total spend: R {totalSpent.toLocaleString()}</p>
        </div>
        <button onClick={openAddForm} className="flex items-center gap-2 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> Add Job Card
        </button>
      </div>

      <div className="glass-card overflow-x-auto">
        {(jobCards || []).length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">No job cards recorded.</p>
        ) : (
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Job Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Workshop</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Total Cost</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(jobCards || []).map(jc => (
                <tr key={jc.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-foreground">{jc.work_date}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{jc.job_type}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{jc.workshop_name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-foreground">R {(Number(jc.total_cost) || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={jc.status}
                      onChange={(e) => handleStatusChange(jc, e.target.value)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full capitalize border-0 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer ${statusStyles[jc.status] || statusStyles.open}`}
                    >
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      {jc.invoice_file_url && (
                        <button onClick={() => viewInvoice(jc.invoice_file_url!)} className="text-muted-foreground hover:text-primary p-1" title="View invoice"><Eye className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => openEditForm(jc)} className="text-muted-foreground hover:text-primary p-1" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(jc.id)} className="text-muted-foreground hover:text-destructive p-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
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
              <h2 className="text-lg font-bold text-foreground">{editingId ? "Edit Job Card" : "Add Job Card"}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {[
              { key: "job_card_number", label: "Job Card Number", placeholder: "JC-001" },
              { key: "work_date", label: "Date of Work *", type: "date" },
              { key: "workshop_name", label: "Workshop / Service Provider *", placeholder: "ABC Motors" },
              { key: "workshop_contact", label: "Workshop Contact", placeholder: "+27..." },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                <input type={f.type || "text"} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Job Type *</label>
              <select value={form.job_type} onChange={e => setForm({ ...form, job_type: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description of Work</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Parts Replaced</label>
              <textarea value={form.parts_replaced} onChange={e => setForm({ ...form, parts_replaced: e.target.value })} rows={2} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Labour Cost (ZAR)</label>
                <input type="number" value={form.labour_cost} onChange={e => setForm({ ...form, labour_cost: e.target.value })} placeholder="0" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Parts Cost (ZAR)</label>
                <input type="number" value={form.parts_cost} onChange={e => setForm({ ...form, parts_cost: e.target.value })} placeholder="0" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <span className="text-sm text-muted-foreground">Total: </span>
              <span className="text-lg font-bold text-foreground">R {((parseFloat(form.labour_cost) || 0) + (parseFloat(form.parts_cost) || 0)).toLocaleString()}</span>
            </div>
            {[
              { key: "invoice_number", label: "Invoice Number", placeholder: "INV-12345" },
              { key: "odometer_reading", label: "Odometer at Time of Work", placeholder: "km", type: "number" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                <input type={f.type || "text"} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {form.status === "completed" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Completed Date</label>
                <input type="date" value={form.completed_date} onChange={e => setForm({ ...form, completed_date: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{editingId ? "Replace Invoice/Job Card File" : "Upload Invoice/Job Card PDF"}</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-foreground" />
              {editingId && <p className="text-xs text-muted-foreground mt-1">Leave empty to keep the existing file.</p>}
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {editingId ? "Save Changes" : "Save Job Card"}
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job card?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the job card and its cost from this vehicle. This cannot be undone.</AlertDialogDescription>
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
