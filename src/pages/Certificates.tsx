import { Search, Filter, Plus, Download, FileCheck, Calendar, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useCertificates, useVehicles } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const statusStyles: Record<string, string> = {
  valid: "bg-success/20 text-success",
  expiring: "bg-warning/20 text-warning",
  expired: "bg-destructive/20 text-destructive",
};

export default function Certificates() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { data: certificates, isLoading } = useCertificates();
  const { data: vehicles } = useVehicles();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  const now = Date.now();
  const enriched = (certificates || []).map((c) => {
    const days = c.expiry_date ? Math.ceil((new Date(c.expiry_date).getTime() - now) / 86400000) : 999;
    const status = days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid";
    return { ...c, daysRemaining: days, calcStatus: status };
  });

  const filtered = enriched.filter(
    (c) =>
      (c as any).vehicles?.registration_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.certificate_type.toLowerCase().includes(search.toLowerCase())
  );

  const [form, setForm] = useState({
    vehicle_id: "", certificate_type: "", certificate_number: "",
    issue_date: "", expiry_date: "", issuing_authority: "", notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.vehicle_id || !form.certificate_type || !profile?.organisation_id) {
      toast.error("Vehicle and certificate type are required");
      return;
    }
    setSaving(true);
    let fileUrl: string | null = null;
    if (file) {
      const path = `${profile.organisation_id}/${form.vehicle_id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) { toast.error("File upload failed: " + upErr.message); setSaving(false); return; }
      fileUrl = path;
    }
    const days = form.expiry_date ? Math.ceil((new Date(form.expiry_date).getTime() - Date.now()) / 86400000) : null;
    const status = days !== null ? (days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid") : "valid";

    const { error } = await supabase.from("certificates").insert({
      organisation_id: profile.organisation_id,
      vehicle_id: form.vehicle_id,
      certificate_type: form.certificate_type,
      certificate_number: form.certificate_number || null,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      issuing_authority: form.issuing_authority || null,
      notes: form.notes || null,
      file_url: fileUrl,
      uploaded_by: user?.id || null,
      status,
      days_until_expiry: days,
    });
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Certificate uploaded");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Certificates</h1>
          <p className="text-sm text-muted-foreground">Manage vehicle compliance certificates</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Upload Certificate
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search certificates..." className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No certificates found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vehicle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days Left</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{(c as any).vehicles?.registration_number || "N/A"}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{c.certificate_type}</td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{c.certificate_number || "-"}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{c.expiry_date || "-"}</td>
                  <td className={`px-4 py-3 text-sm text-center font-mono ${c.daysRemaining <= 0 ? "text-destructive font-bold" : c.daysRemaining <= 30 ? "text-warning" : "text-foreground"}`}>
                    {c.daysRemaining <= 0 ? `${Math.abs(c.daysRemaining)}d overdue` : `${c.daysRemaining}d`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[c.calcStatus]}`}>{c.calcStatus}</span>
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
              <h2 className="text-lg font-bold text-foreground">Upload Certificate</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Vehicle *</label>
              <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select vehicle</option>
                {(vehicles || []).map((v) => <option key={v.id} value={v.id}>{v.registration_number} - {v.fleet_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Certificate Type *</label>
              <select value={form.certificate_type} onChange={(e) => setForm({ ...form, certificate_type: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select type</option>
                {["COF Certificate", "Licence Disc", "Operator Permit", "Refrigeration Certificate", "Fuel Certificate", "Fire Extinguisher Certificate", "Dangerous Goods Permit", "Cross-Border Permit", "Abnormal Load Permit", "Crane and Lifting Certificate", "Fumigation Certificate", "Temperature Log Compliance"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {[
              { key: "certificate_number", label: "Certificate Number", type: "text" },
              { key: "issue_date", label: "Issue Date", type: "date" },
              { key: "expiry_date", label: "Expiry Date", type: "date" },
              { key: "issuing_authority", label: "Issuing Authority", type: "text" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Document File</label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-foreground" />
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Upload Certificate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
