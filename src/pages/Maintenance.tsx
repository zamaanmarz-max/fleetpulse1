import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVehicles, useDrivers } from "@/hooks/useOrgData";
import {
  Wrench, Plus, X, Loader2, Search, AlertTriangle,
  ClipboardList, Zap, CheckCircle, Clock, Camera
} from "lucide-react";
import { toast } from "sonner";

const WORKSHOPS = ["AC&R", "JJ", "ICE COLD BODIES", "SERCO BODIES", "DH LIFTS", "SPARTAN WORKSHOP", "Other"];
const REPORTER_ROLES = ["Driver", "Vehicle Checker", "Controller", "Other"];
const BREAKDOWN_TYPES = ["Tyre", "Mechanical", "Accident", "Electrical", "Body Damage", "Refrigeration", "Other"];

const opStatusStyles: Record<string, string> = {
  Operational:        "bg-success/20 text-success",
  "Awaiting Workshop":"bg-warning/20 text-warning",
  "Under Repair":     "bg-primary/20 text-primary",
  "Awaiting Parts":   "bg-orange-500/20 text-orange-400",
  Breakdown:          "bg-destructive/20 text-destructive",
  "Off Road":         "bg-muted text-muted-foreground",
};

const jobStatusStyles: Record<string, string> = {
  open:        "bg-warning/20 text-warning",
  in_progress: "bg-primary/20 text-primary",
  completed:   "bg-success/20 text-success",
};

const jobStatusLabels: Record<string, string> = {
  open:        "Open",
  in_progress: "In Progress",
  completed:   "Completed",
};

export default function Maintenance() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();

  const [activeTab, setActiveTab] = useState<"damages" | "jobcards" | "breakdowns">("damages");
  const [search, setSearch] = useState("");
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [showBreakdownForm, setShowBreakdownForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Damages ──────────────────────────────────────────────
  const { data: damages, isLoading: damagesLoading } = useQuery({
    queryKey: ["damages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damages")
        .select("*, vehicles(registration_number), drivers(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const emptyDamage = {
    vehicle_id: "", driver_id: "", reported_by: "", reporter_role: "Driver",
    description: "", odometer_km: "", location: "", notes: "",
  };
  const [damageForm, setDamageForm] = useState(emptyDamage);
  const [photoBeforeFile, setPhotoBeforeFile] = useState<File | null>(null);

  const handleSaveDamage = async () => {
    if (!damageForm.vehicle_id || !damageForm.reported_by || !damageForm.description) {
      toast.error("Vehicle, reported by, and description are required");
      return;
    }
    if (!damageForm.odometer_km) {
      toast.error("Odometer reading is required");
      return;
    }
    setSaving(true);
    let photo_before_url: string | null = null;
    if (photoBeforeFile) {
      const path = `damages/${Date.now()}_${photoBeforeFile.name}`;
      const { error: upErr } = await supabase.storage.from("certificates").upload(path, photoBeforeFile);
      if (!upErr) photo_before_url = path;
    }
    const { error } = await supabase.from("damages").insert({
      vehicle_id: damageForm.vehicle_id,
      driver_id: damageForm.driver_id || null,
      reported_by: damageForm.reported_by,
      reporter_role: damageForm.reporter_role.toLowerCase(),
      description: damageForm.description,
      odometer_km: parseInt(damageForm.odometer_km) || null,
      location: damageForm.location || null,
      notes: damageForm.notes || null,
      photo_before_url,
      status: "Reported",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Damage logged — job card auto-created");
    setShowDamageForm(false);
    setDamageForm(emptyDamage);
    setPhotoBeforeFile(null);
    queryClient.invalidateQueries({ queryKey: ["damages"] });
    queryClient.invalidateQueries({ queryKey: ["job_cards_all"] });
  };

  // ── Job Cards ─────────────────────────────────────────────
  const { data: jobCards, isLoading: jobCardsLoading } = useQuery({
    queryKey: ["job_cards_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("*, vehicles(registration_number), drivers(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const handleJobCardStatusChange = async (id: string, newStatus: string, currentWorkshop: string | null) => {
    const update: any = { status: newStatus };
    if (newStatus === "in_progress" && !currentWorkshop) {
      toast.error("Please set a workshop before moving to In Progress");
      return;
    }
    if (newStatus === "completed") {
      update.completed_date = new Date().toISOString().split("T")[0];
      update.approved_by = profile?.full_name || "Controller";
    }
    const { error } = await supabase.from("job_cards").update(update).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Job card updated");
    queryClient.invalidateQueries({ queryKey: ["job_cards_all"] });
  };

  const handleJobCardWorkshop = async (id: string, workshop: string) => {
    const { error } = await supabase.from("job_cards").update({ workshop_name: workshop }).eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["job_cards_all"] });
  };

  // ── Breakdowns ────────────────────────────────────────────
  const { data: breakdowns, isLoading: breakdownsLoading } = useQuery({
    queryKey: ["breakdowns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breakdowns")
        .select("*, vehicles(registration_number), drivers(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const emptyBreakdown = {
    vehicle_id: "", driver_id: "", location: "", breakdown_type: "Mechanical",
    description: "", workshop: "", notes: "", national_team_notified: false,
  };
  const [breakdownForm, setBreakdownForm] = useState(emptyBreakdown);

  const handleSaveBreakdown = async () => {
    if (!breakdownForm.vehicle_id || !breakdownForm.location) {
      toast.error("Vehicle and location are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("breakdowns").insert({
      vehicle_id: breakdownForm.vehicle_id,
      driver_id: breakdownForm.driver_id || null,
      location: breakdownForm.location,
      breakdown_type: breakdownForm.breakdown_type,
      description: breakdownForm.description || null,
      workshop: breakdownForm.workshop || null,
      notes: breakdownForm.notes || null,
      national_team_notified: breakdownForm.national_team_notified,
      resolved: false,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Breakdown logged — vehicle status updated to Breakdown");
    setShowBreakdownForm(false);
    setBreakdownForm(emptyBreakdown);
    queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
  };

  const handleResolveBreakdown = async (id: string) => {
    const { error } = await supabase
      .from("breakdowns")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Breakdown resolved — vehicle back to Operational");
    queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
  };

  // ── Summary stats ─────────────────────────────────────────
  const openDamages    = (damages || []).filter(d => d.status !== "Resolved").length;
  const pendingCards   = (jobCards || []).filter(j => j.status === "open").length;
  const activeBreakdowns = (breakdowns || []).filter(b => !b.resolved).length;

  // ── Filter helpers ────────────────────────────────────────
  const filterDamages = (damages || []).filter(d =>
    ((d as any).vehicles?.registration_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.description || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.reported_by || "").toLowerCase().includes(search.toLowerCase())
  );

  const filterJobCards = (jobCards || []).filter(j =>
    ((j as any).vehicles?.registration_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (j.job_card_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (j.workshop_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const filterBreakdowns = (breakdowns || []).filter(b =>
    ((b as any).vehicles?.registration_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (b.location || "").toLowerCase().includes(search.toLowerCase()) ||
    (b.breakdown_type || "").toLowerCase().includes(search.toLowerCase())
  );

  const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block text-sm font-medium text-foreground mb-1";

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Maintenance</h1>
          <p className="text-sm text-muted-foreground">Damage reports, job cards and breakdown tracking</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "damages" && (
            <button onClick={() => setShowDamageForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
              <Plus className="w-4 h-4" /> Log Damage
            </button>
          )}
          {activeTab === "breakdowns" && (
            <button onClick={() => setShowBreakdownForm(true)} className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
              <Zap className="w-4 h-4" /> Log Breakdown
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card cursor-pointer" onClick={() => setActiveTab("damages")}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Open Damages</p>
          <p className={`text-2xl font-bold mt-1 ${openDamages > 0 ? "text-warning" : "text-success"}`}>{openDamages}</p>
        </div>
        <div className="stat-card cursor-pointer" onClick={() => setActiveTab("jobcards")}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Job Cards</p>
          <p className={`text-2xl font-bold mt-1 ${pendingCards > 0 ? "text-warning" : "text-success"}`}>{pendingCards}</p>
        </div>
        <div className="stat-card cursor-pointer" onClick={() => setActiveTab("breakdowns")}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Breakdowns</p>
          <p className={`text-2xl font-bold mt-1 ${activeBreakdowns > 0 ? "text-destructive" : "text-success"}`}>{activeBreakdowns}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "damages",    label: "Damages",    icon: AlertTriangle },
          { id: "jobcards",   label: "Job Cards",  icon: ClipboardList },
          { id: "breakdowns", label: "Breakdowns", icon: Zap },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by vehicle, description..."
          className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* ── DAMAGES TAB ── */}
      {activeTab === "damages" && (
        <div className="glass-card overflow-x-auto">
          {damagesLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filterDamages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No damages logged yet. Click "Log Damage" to add one.</div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border">
                  {["Date", "Vehicle", "Driver", "Reported By", "Description", "Odometer", "Status", "Photos"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filterDamages.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{new Date(d.created_at!).toLocaleDateString("en-ZA")}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{(d as any).vehicles?.registration_number || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{(d as any).drivers?.full_name || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{d.reported_by} <span className="text-xs text-muted-foreground">({d.reporter_role})</span></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[220px] truncate">{d.description}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{d.odometer_km ? `${d.odometer_km.toLocaleString()} km` : "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        d.status === "Resolved" ? "bg-success/20 text-success" :
                        d.status === "Reported" ? "bg-warning/20 text-warning" :
                        "bg-primary/20 text-primary"
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {d.photo_before_url && <span className="text-xs text-primary flex items-center gap-1"><Camera className="w-3 h-3" />Before</span>}
                        {d.photo_after_url && <span className="text-xs text-success flex items-center gap-1"><Camera className="w-3 h-3" />After</span>}
                        {!d.photo_before_url && !d.photo_after_url && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── JOB CARDS TAB ── */}
      {activeTab === "jobcards" && (
        <div className="glass-card overflow-x-auto">
          {jobCardsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filterJobCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No job cards yet. Log a damage to auto-create one.</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  {["JC No.", "Vehicle", "Type", "Workshop", "Reported By", "Date", "Cost", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filterJobCards.map(j => (
                  <tr key={j.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{j.job_card_number || "—"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{(j as any).vehicles?.registration_number || "-"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{j.job_type}</td>
                    <td className="px-4 py-3">
                      <select
                        value={j.workshop_name || ""}
                        onChange={e => handleJobCardWorkshop(j.id, e.target.value)}
                        className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select workshop</option>
                        {WORKSHOPS.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{(j as any).reporter_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{j.work_date || new Date(j.created_at!).toLocaleDateString("en-ZA")}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">R {(Number(j.total_cost) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <select
                        value={j.status}
                        onChange={e => handleJobCardStatusChange(j.id, e.target.value, j.workshop_name)}
                        className={`text-xs font-semibold px-2 py-1 rounded-full border-0 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer ${jobStatusStyles[j.status] || jobStatusStyles.open}`}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── BREAKDOWNS TAB ── */}
      {activeTab === "breakdowns" && (
        <div className="glass-card overflow-x-auto">
          {breakdownsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filterBreakdowns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No breakdowns logged.</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  {["Vehicle", "Driver", "Type", "Location", "Reported", "Nat. Team", "Workshop", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filterBreakdowns.map(b => (
                  <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{(b as any).vehicles?.registration_number || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{(b as any).drivers?.full_name || "-"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{b.breakdown_type}</td>
                    <td className="px-4 py-3 text-sm text-foreground max-w-[160px] truncate">{b.location}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{new Date(b.reported_at!).toLocaleDateString("en-ZA")}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${b.national_team_notified ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                        {b.national_team_notified ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{b.workshop || "—"}</td>
                    <td className="px-4 py-3">
                      {b.resolved ? (
                        <span className="flex items-center gap-1 text-xs text-success"><CheckCircle className="w-3 h-3" /> Resolved</span>
                      ) : (
                        <button
                          onClick={() => handleResolveBreakdown(b.id)}
                          className="flex items-center gap-1 text-xs bg-success/20 text-success px-2 py-1 rounded-full hover:opacity-80"
                        >
                          <CheckCircle className="w-3 h-3" /> Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── LOG DAMAGE FORM ── */}
      {showDamageForm && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row">
          <div className="flex-1 bg-background/50" onClick={() => setShowDamageForm(false)} />
          <div className="w-full md:w-[480px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Log Damage</h2>
                <p className="text-xs text-muted-foreground mt-0.5">A job card will be created automatically</p>
              </div>
              <button onClick={() => setShowDamageForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className={labelCls}>Vehicle *</label>
              <select value={damageForm.vehicle_id} onChange={e => setDamageForm({ ...damageForm, vehicle_id: e.target.value })} className={inputCls}>
                <option value="">Select vehicle</option>
                {(vehicles || []).map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Driver at Time of Damage</label>
              <select value={damageForm.driver_id} onChange={e => setDamageForm({ ...damageForm, driver_id: e.target.value })} className={inputCls}>
                <option value="">Select driver (optional)</option>
                {(drivers || []).map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Reported By *</label>
                <input value={damageForm.reported_by} onChange={e => setDamageForm({ ...damageForm, reported_by: e.target.value })} placeholder="Full name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Role *</label>
                <select value={damageForm.reporter_role} onChange={e => setDamageForm({ ...damageForm, reporter_role: e.target.value })} className={inputCls}>
                  {REPORTER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Damage Description *</label>
              <textarea value={damageForm.description} onChange={e => setDamageForm({ ...damageForm, description: e.target.value })} rows={3} placeholder="Describe the damage in detail" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Odometer (km) *</label>
                <input type="number" value={damageForm.odometer_km} onChange={e => setDamageForm({ ...damageForm, odometer_km: e.target.value })} placeholder="e.g. 145000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input value={damageForm.location} onChange={e => setDamageForm({ ...damageForm, location: e.target.value })} placeholder="e.g. Midrand yard" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={damageForm.notes} onChange={e => setDamageForm({ ...damageForm, notes: e.target.value })} rows={2} placeholder="Additional notes" className={inputCls} />
            </div>

            <div>
              <label className={labelCls + " flex items-center gap-2"}><Camera className="w-4 h-4" /> Photo — Before Repair</label>
              <input type="file" accept="image/*,.pdf" onChange={e => setPhotoBeforeFile(e.target.files?.[0] || null)} className="w-full text-sm text-foreground" />
            </div>

            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning">
              ⚠ All fields marked * are required. Incomplete submissions will not be accepted.
            </div>

            <button onClick={handleSaveDamage} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} Log Damage & Create Job Card
            </button>
          </div>
        </div>
      )}

      {/* ── LOG BREAKDOWN FORM ── */}
      {showBreakdownForm && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row">
          <div className="flex-1 bg-background/50" onClick={() => setShowBreakdownForm(false)} />
          <div className="w-full md:w-[480px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Log Breakdown</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Vehicle status will update to Breakdown</p>
              </div>
              <button onClick={() => setShowBreakdownForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className={labelCls}>Vehicle *</label>
              <select value={breakdownForm.vehicle_id} onChange={e => setBreakdownForm({ ...breakdownForm, vehicle_id: e.target.value })} className={inputCls}>
                <option value="">Select vehicle</option>
                {(vehicles || []).map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Driver</label>
              <select value={breakdownForm.driver_id} onChange={e => setBreakdownForm({ ...breakdownForm, driver_id: e.target.value })} className={inputCls}>
                <option value="">Select driver (optional)</option>
                {(drivers || []).map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Breakdown Type *</label>
                <select value={breakdownForm.breakdown_type} onChange={e => setBreakdownForm({ ...breakdownForm, breakdown_type: e.target.value })} className={inputCls}>
                  {BREAKDOWN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Workshop (if known)</label>
                <select value={breakdownForm.workshop} onChange={e => setBreakdownForm({ ...breakdownForm, workshop: e.target.value })} className={inputCls}>
                  <option value="">TBC</option>
                  {WORKSHOPS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Location *</label>
              <input value={breakdownForm.location} onChange={e => setBreakdownForm({ ...breakdownForm, location: e.target.value })} placeholder="Where did the breakdown occur?" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea value={breakdownForm.description} onChange={e => setBreakdownForm({ ...breakdownForm, description: e.target.value })} rows={3} placeholder="What happened?" className={inputCls} />
            </div>

            <div className="flex items-center gap-3 bg-secondary rounded-lg px-4 py-3">
              <input
                type="checkbox"
                id="nat-team"
                checked={breakdownForm.national_team_notified}
                onChange={e => setBreakdownForm({ ...breakdownForm, national_team_notified: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="nat-team" className="text-sm text-foreground cursor-pointer">National Breakdown Team has been notified</label>
            </div>

            <button onClick={handleSaveBreakdown} disabled={saving} className="w-full bg-destructive text-destructive-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Log Breakdown
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
