import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Plus, X, Loader2, CheckCircle, Clock, AlertTriangle, Building2 } from "lucide-react";
import { toast } from "sonner";

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  quarterly: "Quarterly", annually: "Annually",
};

const ENTRY_STATUSES = ["Completed", "Pending", "Overdue", "Skipped"] as const;

function getDueStatus(entry: any, frequency: string): "completed" | "overdue" | "due" | "upcoming" {
  if (!entry) return "due";
  if (entry.status === "Completed") return "completed";
  if (entry.status === "Overdue") return "overdue";
  return "due";
}

function statusBadge(status: "completed" | "overdue" | "due" | "upcoming") {
  if (status === "completed") return "bg-success/20 text-success";
  if (status === "overdue")   return "bg-destructive/20 text-destructive";
  return "bg-warning/20 text-warning";
}

function statusLabel(status: "completed" | "overdue" | "due" | "upcoming") {
  if (status === "completed") return "Completed";
  if (status === "overdue")   return "Overdue";
  return "Due";
}

export default function Compliance() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [showLogForm, setShowLogForm] = useState<string | null>(null); // register_type_id
  const [saving, setSaving] = useState(false);

  const [logForm, setLogForm] = useState({
    completed_by: "", completion_date: new Date().toISOString().split("T")[0],
    status: "Completed" as typeof ENTRY_STATUSES[number], notes: "",
  });

  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: ["compliance_sites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compliance_sites").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: registerTypes, isLoading: registersLoading } = useQuery({
    queryKey: ["compliance_register_types", selectedSite],
    queryFn: async () => {
      let q = supabase
        .from("compliance_register_types")
        .select("*, compliance_sites(name, location)")
        .eq("is_active", true)
        .order("name");
      if (selectedSite !== "all") q = q.eq("site_id", selectedSite);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["compliance_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_entries")
        .select("*")
        .order("completion_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get the latest entry per register type
  const latestEntryByRegister = (entries || []).reduce<Record<string, any>>((acc, e) => {
    if (!acc[e.register_type_id!]) acc[e.register_type_id!] = e;
    return acc;
  }, {});

  const handleLogEntry = async () => {
    if (!showLogForm) return;
    if (!logForm.completed_by) { toast.error("Please enter your name"); return; }
    const reg = (registerTypes || []).find(r => r.id === showLogForm);
    setSaving(true);
    const { error } = await supabase.from("compliance_entries").insert({
      register_type_id: showLogForm,
      site_id: reg?.site_id,
      completed_by: logForm.completed_by,
      completion_date: logForm.completion_date,
      status: logForm.status,
      notes: logForm.notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Register entry logged");
    setShowLogForm(null);
    setLogForm({ completed_by: "", completion_date: new Date().toISOString().split("T")[0], status: "Completed", notes: "" });
    queryClient.invalidateQueries({ queryKey: ["compliance_entries"] });
  };

  const completedCount = Object.values(latestEntryByRegister).filter(e => e.status === "Completed").length;
  const overdueCount  = Object.values(latestEntryByRegister).filter(e => e.status === "Overdue").length;
  const totalRegs     = (registerTypes || []).length;
  const pendingCount  = totalRegs - completedCount - overdueCount;

  const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block text-sm font-medium text-foreground mb-1";

  const selectedRegister = (registerTypes || []).find(r => r.id === showLogForm);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance Registers</h1>
          <p className="text-sm text-muted-foreground">Site-based health &amp; safety register tracking</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Registers</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalRegs}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
          <p className="text-2xl font-bold text-success mt-1">{completedCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className={`text-2xl font-bold mt-1 ${pendingCount > 0 ? "text-warning" : "text-success"}`}>{pendingCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Overdue</p>
          <p className={`text-2xl font-bold mt-1 ${overdueCount > 0 ? "text-destructive" : "text-success"}`}>{overdueCount}</p>
        </div>
      </div>

      {/* Site filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Site:</span>
        <button
          onClick={() => setSelectedSite("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedSite === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
        >
          All Sites
        </button>
        {(sites || []).map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSite(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedSite === s.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
          >
            <Building2 className="w-3.5 h-3.5" /> {s.name}
          </button>
        ))}
      </div>

      {/* Register cards */}
      {(registersLoading || sitesLoading) ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(registerTypes || []).map(reg => {
            const latest = latestEntryByRegister[reg.id];
            const status = getDueStatus(latest, reg.frequency!);

            return (
              <div key={reg.id} className="glass-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{reg.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(reg as any).compliance_sites?.name} · {FREQUENCY_LABELS[reg.frequency!] || reg.frequency}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(status)}`}>
                    {statusLabel(status)}
                  </span>
                </div>

                {latest ? (
                  <div className="bg-secondary/50 rounded-lg p-2.5 text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Last logged:</span>
                      <span className="text-foreground">{latest.completion_date || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed by:</span>
                      <span className="text-foreground">{latest.completed_by || "—"}</span>
                    </div>
                    {latest.notes && <p className="text-foreground/70 truncate">"{latest.notes}"</p>}
                  </div>
                ) : (
                  <div className="bg-warning/10 rounded-lg p-2.5 text-xs text-warning">
                    No entries yet — this register has never been logged
                  </div>
                )}

                {reg.responsible_person && reg.responsible_person !== "TBC" && (
                  <p className="text-xs text-muted-foreground">Responsible: {reg.responsible_person}</p>
                )}

                <button
                  onClick={() => setShowLogForm(reg.id)}
                  className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Log Entry
                </button>
              </div>
            );
          })}

          {(registerTypes || []).length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">
              No registers found for this site. Registers were seeded during setup — check Supabase if missing.
            </div>
          )}
        </div>
      )}

      {/* Log Entry Form */}
      {showLogForm && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row">
          <div className="flex-1 bg-background/50" onClick={() => setShowLogForm(null)} />
          <div className="w-full md:w-[440px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Log Register Entry</h2>
                {selectedRegister && (
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedRegister.name}</p>
                )}
              </div>
              <button onClick={() => setShowLogForm(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className={labelCls}>Completed By *</label>
              <input value={logForm.completed_by} onChange={e => setLogForm({ ...logForm, completed_by: e.target.value })} placeholder="Your full name" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Date Completed</label>
              <input type="date" value={logForm.completion_date} onChange={e => setLogForm({ ...logForm, completion_date: e.target.value })} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <select value={logForm.status} onChange={e => setLogForm({ ...logForm, status: e.target.value as any })} className={inputCls}>
                {ENTRY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={logForm.notes} onChange={e => setLogForm({ ...logForm, notes: e.target.value })} rows={3} placeholder="Any observations or issues..." className={inputCls} />
            </div>

            <button onClick={handleLogEntry} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Save Entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
