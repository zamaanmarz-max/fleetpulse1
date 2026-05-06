import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, X, Loader2, CheckCircle, AlertTriangle, Building2, Upload, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { ComplianceAuditTab } from "@/components/compliance/ComplianceAuditTab";

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  quarterly: "Quarterly", annually: "Annually",
};
const FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "annually"];
const ENTRY_STATUSES = ["Completed", "Pending", "Overdue", "Skipped"] as const;

function getDueStatus(entry: any, nextDue: string | null): "completed" | "overdue" | "due" {
  if (entry?.status === "Completed") return "completed";
  if (nextDue && new Date(nextDue) < new Date()) return "overdue";
  return "due";
}
function statusBadge(s: "completed" | "overdue" | "due") {
  if (s === "completed") return "bg-success/20 text-success";
  if (s === "overdue")   return "bg-destructive/20 text-destructive";
  return "bg-warning/20 text-warning";
}
function statusLabel(s: "completed" | "overdue" | "due") {
  if (s === "completed") return "✓ Completed";
  if (s === "overdue")   return "⚠ Overdue";
  return "Due";
}

export default function Compliance() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"registers" | "audit">("registers");
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [showLogForm, setShowLogForm] = useState<string | null>(null);
  const [showNewRegister, setShowNewRegister] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logFile, setLogFile] = useState<File | null>(null);

  const [logForm, setLogForm] = useState({
    completed_by: "", completion_date: new Date().toISOString().split("T")[0],
    status: "Completed" as typeof ENTRY_STATUSES[number], notes: "",
  });

  const [newRegForm, setNewRegForm] = useState({
    site_id: "", name: "", frequency: "monthly",
    responsible_person: "", expiry_date: "", description: "",
  });

  const { data: sites } = useQuery({
    queryKey: ["compliance_sites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compliance_sites").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: registerTypes, isLoading } = useQuery({
    queryKey: ["compliance_register_types", selectedSite],
    queryFn: async () => {
      let q = supabase
        .from("compliance_register_types")
        .select("*, compliance_sites(name)")
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
        .from("compliance_entries").select("*").order("completion_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const latestEntry = (entries || []).reduce<Record<string, any>>((acc, e) => {
    if (!acc[e.register_type_id!]) acc[e.register_type_id!] = e;
    return acc;
  }, {});

  const handleLogEntry = async () => {
    if (!showLogForm || !logForm.completed_by) { toast.error("Please enter your name"); return; }
    const reg = (registerTypes || []).find(r => r.id === showLogForm);
    setSaving(true);
    let file_url: string | null = null;
    if (logFile) {
      const path = `compliance/${showLogForm}/${Date.now()}_${logFile.name}`;
      const { error: upErr } = await supabase.storage.from("certificates").upload(path, logFile);
      if (!upErr) file_url = path;
    }
    const { error } = await supabase.from("compliance_entries").insert({
      register_type_id: showLogForm,
      site_id: reg?.site_id,
      completed_by: logForm.completed_by,
      completion_date: logForm.completion_date,
      status: logForm.status,
      notes: logForm.notes || null,
      file_url,
    });
    // Update last_completed on register type
    if (!error) {
      await supabase.from("compliance_register_types")
        .update({ last_completed: logForm.completion_date })
        .eq("id", showLogForm);
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Register entry logged" + (file_url ? " with PDF" : ""));
    setShowLogForm(null);
    setLogFile(null);
    setLogForm({ completed_by: "", completion_date: new Date().toISOString().split("T")[0], status: "Completed", notes: "" });
    queryClient.invalidateQueries({ queryKey: ["compliance_entries"] });
    queryClient.invalidateQueries({ queryKey: ["compliance_register_types"] });
  };

  const handleCreateRegister = async () => {
    if (!newRegForm.site_id || !newRegForm.name) { toast.error("Site and register name are required"); return; }
    setSaving(true);
    const { error } = await supabase.from("compliance_register_types").insert({
      site_id: newRegForm.site_id,
      name: newRegForm.name,
      frequency: newRegForm.frequency,
      responsible_person: newRegForm.responsible_person || null,
      description: newRegForm.description || null,
      expiry_date: newRegForm.expiry_date || null,
      is_active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Register created");
    setShowNewRegister(false);
    setNewRegForm({ site_id: "", name: "", frequency: "monthly", responsible_person: "", expiry_date: "", description: "" });
    queryClient.invalidateQueries({ queryKey: ["compliance_register_types"] });
  };

  const completedCount = Object.values(latestEntry).filter(e => e.status === "Completed").length;
  const overdueCount   = (registerTypes || []).filter(r => {
    const e = latestEntry[r.id];
    return getDueStatus(e, (r as any).next_due_date) === "overdue";
  }).length;
  const totalRegs = (registerTypes || []).length;

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
        <button onClick={() => setShowNewRegister(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Register
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Registers</p><p className="text-2xl font-bold text-foreground mt-1">{totalRegs}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p><p className="text-2xl font-bold text-success mt-1">{completedCount}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p><p className={`text-2xl font-bold mt-1 ${totalRegs - completedCount - overdueCount > 0 ? "text-warning" : "text-success"}`}>{totalRegs - completedCount - overdueCount}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Overdue</p><p className={`text-2xl font-bold mt-1 ${overdueCount > 0 ? "text-destructive" : "text-success"}`}>{overdueCount}</p></div>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setActiveTab("registers")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "registers" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Shield className="w-4 h-4" /> Registers
        </button>
        <button onClick={() => setActiveTab("audit")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "audit" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <ClipboardList className="w-4 h-4" /> OHSA Audit Score
        </button>
      </div>

      {activeTab === "audit" && <ComplianceAuditTab sites={sites || []} />}

      {activeTab === "registers" && (<>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Site:</span>
          <button onClick={() => setSelectedSite("all")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedSite === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>All Sites</button>
          {(sites || []).map(s => (
            <button key={s.id} onClick={() => setSelectedSite(s.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedSite === s.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
              <Building2 className="w-3.5 h-3.5" /> {s.name}
            </button>
          ))}
        </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(registerTypes || []).map(reg => {
            const latest = latestEntry[reg.id];
            const status = getDueStatus(latest, (reg as any).next_due_date);
            const expiryDate = (reg as any).expiry_date;
            const daysToExpiry = expiryDate ? Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000) : null;

            return (
              <div key={reg.id} className="glass-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <h3 className="text-sm font-semibold text-foreground">{reg.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(reg as any).compliance_sites?.name} · {FREQUENCY_LABELS[reg.frequency!] || reg.frequency}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusBadge(status)}`}>
                    {statusLabel(status)}
                  </span>
                </div>

                {/* Expiry warning */}
                {daysToExpiry !== null && daysToExpiry <= 30 && (
                  <div className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 ${daysToExpiry <= 0 ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {daysToExpiry <= 0 ? `Expired ${Math.abs(daysToExpiry)} days ago` : `Expires in ${daysToExpiry} days (${expiryDate})`}
                  </div>
                )}

                {latest ? (
                  <div className="bg-secondary/50 rounded-lg p-2.5 text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between"><span>Last logged:</span><span className="text-foreground">{latest.completion_date}</span></div>
                    <div className="flex justify-between"><span>By:</span><span className="text-foreground">{latest.completed_by}</span></div>
                    {latest.file_url && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
                          const url = `${supabaseUrl}/storage/v1/object/public/certificates/${latest.file_url}`;
                          window.open(url, "_blank");
                        }}
                        className="text-primary text-xs flex items-center gap-1 hover:underline"
                      >
                        📄 View attached PDF
                      </button>
                    )}
                    {latest.notes && <p className="text-foreground/70 truncate">"{latest.notes}"</p>}
                  </div>
                ) : (
                  <div className="bg-warning/10 rounded-lg p-2.5 text-xs text-warning">Never logged — no entries yet</div>
                )}

                {reg.responsible_person && reg.responsible_person !== "TBC" && (
                  <p className="text-xs text-muted-foreground">Responsible: {reg.responsible_person}</p>
                )}

                <button onClick={() => setShowLogForm(reg.id)} className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> Log Entry
                </button>
              </div>
            );
          })}
          {(registerTypes || []).length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">No registers found. Click "Add Register" to create one.</div>
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
                {selectedRegister && <p className="text-xs text-muted-foreground mt-0.5">{selectedRegister.name}</p>}
              </div>
              <button onClick={() => setShowLogForm(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div><label className={labelCls}>Completed By *</label><input value={logForm.completed_by} onChange={e => setLogForm({ ...logForm, completed_by: e.target.value })} placeholder="Your full name" className={inputCls} /></div>
            <div><label className={labelCls}>Date Completed</label><input type="date" value={logForm.completion_date} onChange={e => setLogForm({ ...logForm, completion_date: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Status</label>
              <select value={logForm.status} onChange={e => setLogForm({ ...logForm, status: e.target.value as any })} className={inputCls}>
                {ENTRY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls + " flex items-center gap-2"}><Upload className="w-4 h-4" /> Upload Register PDF / Photo</label>
              <input type="file" accept=".pdf,image/*" onChange={e => setLogFile(e.target.files?.[0] || null)} className="w-full text-sm text-foreground" />
              <p className="text-xs text-muted-foreground mt-1">Attach the signed register document</p>
            </div>
            <div><label className={labelCls}>Notes</label><textarea value={logForm.notes} onChange={e => setLogForm({ ...logForm, notes: e.target.value })} rows={3} placeholder="Any observations or issues..." className={inputCls} /></div>
            <button onClick={handleLogEntry} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Save Entry
            </button>
          </div>
        </div>
      )}

      {/* New Register Form */}
      {showNewRegister && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row">
          <div className="flex-1 bg-background/50" onClick={() => setShowNewRegister(false)} />
          <div className="w-full md:w-[440px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Add New Register</h2>
              <button onClick={() => setShowNewRegister(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div><label className={labelCls}>Site *</label>
              <select value={newRegForm.site_id} onChange={e => setNewRegForm({ ...newRegForm, site_id: e.target.value })} className={inputCls}>
                <option value="">Select site</option>
                {(sites || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Register Name *</label><input value={newRegForm.name} onChange={e => setNewRegForm({ ...newRegForm, name: e.target.value })} placeholder="e.g. PPE Issue Register" className={inputCls} /></div>
            <div><label className={labelCls}>Frequency</label>
              <select value={newRegForm.frequency} onChange={e => setNewRegForm({ ...newRegForm, frequency: e.target.value })} className={inputCls}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Responsible Person</label><input value={newRegForm.responsible_person} onChange={e => setNewRegForm({ ...newRegForm, responsible_person: e.target.value })} placeholder="Name or role" className={inputCls} /></div>
            <div><label className={labelCls}>Expiry Date (if applicable)</label><input type="date" value={newRegForm.expiry_date} onChange={e => setNewRegForm({ ...newRegForm, expiry_date: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Description / Notes</label><textarea value={newRegForm.description} onChange={e => setNewRegForm({ ...newRegForm, description: e.target.value })} rows={2} className={inputCls} /></div>
            <button onClick={handleCreateRegister} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Register
            </button>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
