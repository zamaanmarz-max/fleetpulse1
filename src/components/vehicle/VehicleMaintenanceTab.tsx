import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDrivers } from "@/hooks/useOrgData";
import {
  AlertTriangle, Zap, ClipboardList, Plus, X, Loader2,
  Camera, CheckCircle, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const WORKSHOPS = ["AC&R", "JJ", "ICE COLD BODIES", "SERCO BODIES", "DH LIFTS", "SPARTAN WORKSHOP", "Other"];
const REPORTER_ROLES = ["Driver", "Vehicle Checker", "Controller", "Other"];
const BREAKDOWN_TYPES = ["Tyre", "Mechanical", "Accident", "Electrical", "Body Damage", "Refrigeration", "Other"];

interface Props {
  vehicleId: string;
  registration: string;
  operationalStatus?: string | null;
}

const opStatusStyles: Record<string, string> = {
  Operational:         "bg-success/20 text-success",
  "Awaiting Workshop": "bg-warning/20 text-warning",
  "Under Repair":      "bg-primary/20 text-primary",
  "Awaiting Parts":    "bg-orange-500/20 text-orange-400",
  Breakdown:           "bg-destructive/20 text-destructive",
  "Off Road":          "bg-muted text-muted-foreground",
};

const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1";

export function VehicleMaintenanceTab({ vehicleId, registration, operationalStatus }: Props) {
  const queryClient = useQueryClient();
  const { data: drivers } = useDrivers();
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [showBreakdownForm, setShowBreakdownForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoBeforeFile, setPhotoBeforeFile] = useState<File | null>(null);

  // ── Data fetches ──────────────────────────────────────────
  const { data: damages, isLoading: damagesLoading } = useQuery({
    queryKey: ["damages", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damages")
        .select("*, drivers(full_name)")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: jobCards, isLoading: jobCardsLoading } = useQuery({
    queryKey: ["job_cards", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: breakdowns, isLoading: breakdownsLoading } = useQuery({
    queryKey: ["breakdowns", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breakdowns")
        .select("*, drivers(full_name)")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // ── Damage form ───────────────────────────────────────────
  const emptyDamage = {
    driver_id: "", reported_by: "", reporter_role: "Driver",
    description: "", odometer_km: "", location: "",
    fleet_marshall_jc_ref: "", notes: "",
  };
  const [damageForm, setDamageForm] = useState(emptyDamage);

  const handleSaveDamage = async () => {
    if (!damageForm.reported_by || !damageForm.description || !damageForm.odometer_km) {
      toast.error("Reported by, description, and odometer are required");
      return;
    }
    setSaving(true);
    let photo_before_url: string | null = null;
    if (photoBeforeFile) {
      const path = `damages/${vehicleId}/${Date.now()}_${photoBeforeFile.name}`;
      const { error: upErr } = await supabase.storage.from("certificates").upload(path, photoBeforeFile);
      if (!upErr) photo_before_url = path;
    }
    const { error } = await supabase.from("damages").insert({
      vehicle_id: vehicleId,
      driver_id: damageForm.driver_id || null,
      reported_by: damageForm.reported_by,
      reporter_role: damageForm.reporter_role.toLowerCase(),
      description: damageForm.description,
      odometer_km: parseInt(damageForm.odometer_km) || null,
      location: damageForm.location || null,
      fleet_marshall_jc_ref: damageForm.fleet_marshall_jc_ref || null,
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
    queryClient.invalidateQueries({ queryKey: ["damages", vehicleId] });
    queryClient.invalidateQueries({ queryKey: ["job_cards", vehicleId] });
  };

  // ── Job card workshop update ──────────────────────────────
  const handleWorkshopChange = async (jcId: string, workshop: string) => {
    const { error } = await supabase.from("job_cards").update({ workshop_name: workshop }).eq("id", jcId);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["job_cards", vehicleId] });
  };

  const handleStatusChange = async (jcId: string, status: string) => {
    const update: any = { status };
    if (status === "completed") update.completed_date = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("job_cards").update(update).eq("id", jcId);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); queryClient.invalidateQueries({ queryKey: ["job_cards", vehicleId] }); }
  };

  // ── Breakdown form ────────────────────────────────────────
  const emptyBreakdown = {
    driver_id: "", location: "", breakdown_type: "Mechanical",
    description: "", workshop: "", national_team_notified: false,
  };
  const [breakdownForm, setBreakdownForm] = useState(emptyBreakdown);

  const handleSaveBreakdown = async () => {
    if (!breakdownForm.location) { toast.error("Location is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("breakdowns").insert({
      vehicle_id: vehicleId,
      driver_id: breakdownForm.driver_id || null,
      location: breakdownForm.location,
      breakdown_type: breakdownForm.breakdown_type,
      description: breakdownForm.description || null,
      workshop: breakdownForm.workshop || null,
      national_team_notified: breakdownForm.national_team_notified,
      resolved: false,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Breakdown logged — vehicle status updated");
    setShowBreakdownForm(false);
    setBreakdownForm(emptyBreakdown);
    queryClient.invalidateQueries({ queryKey: ["breakdowns", vehicleId] });
  };

  const handleResolveBreakdown = async (id: string) => {
    const { error } = await supabase.from("breakdowns")
      .update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Breakdown resolved");
    queryClient.invalidateQueries({ queryKey: ["breakdowns", vehicleId] });
  };

  const isLoading = damagesLoading || jobCardsLoading || breakdownsLoading;

  return (
    <div className="space-y-6">

      {/* Operational Status Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Operational Status:</span>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${opStatusStyles[operationalStatus || "Operational"] || opStatusStyles.Operational}`}>
            {operationalStatus || "Operational"}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDamageForm(true)} className="flex items-center gap-1.5 text-xs bg-warning/20 text-warning border border-warning/30 px-3 py-1.5 rounded-lg hover:opacity-80">
            <AlertTriangle className="w-3.5 h-3.5" /> Log Damage
          </button>
          <button onClick={() => setShowBreakdownForm(true)} className="flex items-center gap-1.5 text-xs bg-destructive/20 text-destructive border border-destructive/30 px-3 py-1.5 rounded-lg hover:opacity-80">
            <Zap className="w-3.5 h-3.5" /> Log Breakdown
          </button>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {/* ── DAMAGES ─────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Damages ({(damages || []).length})
        </h3>
        {(damages || []).length === 0 ? (
          <p className="text-sm text-muted-foreground glass-card p-4 text-center">No damages recorded for {registration}</p>
        ) : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border">
                  {["Date", "Reporter", "Description", "Km", "Fleet Marshall JC", "Status", "Photos"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(damages || []).map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{new Date(d.created_at!).toLocaleDateString("en-ZA")}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{d.reported_by} <span className="text-xs text-muted-foreground">({d.reporter_role})</span></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{d.description}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{d.odometer_km ? `${d.odometer_km.toLocaleString()} km` : "—"}</td>
                    <td className="px-4 py-3 text-sm font-mono text-primary">{(d as any).fleet_marshall_jc_ref || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        d.status === "Resolved" ? "bg-success/20 text-success" :
                        d.status === "Reported" ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary"
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {d.photo_before_url && <span className="text-primary">📷 Before</span>}
                      {d.photo_after_url && <span className="text-success ml-1">📷 After</span>}
                      {!d.photo_before_url && !d.photo_after_url && <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── JOB CARDS ───────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          Job Cards ({(jobCards || []).length})
        </h3>
        {(jobCards || []).length === 0 ? (
          <p className="text-sm text-muted-foreground glass-card p-4 text-center">No job cards yet — log a damage to auto-create one</p>
        ) : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  {["JC No.", "Type", "Workshop", "Reporter", "Date", "Cost", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(jobCards || []).map(j => (
                  <tr key={j.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-primary">{j.job_card_number || "—"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{j.job_type}</td>
                    <td className="px-4 py-3">
                      <select
                        value={j.workshop_name || ""}
                        onChange={e => handleWorkshopChange(j.id, e.target.value)}
                        className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
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
                        onChange={e => handleStatusChange(j.id, e.target.value)}
                        className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${
                          j.status === "completed" ? "bg-success/20 text-success" :
                          j.status === "in_progress" ? "bg-primary/20 text-primary" :
                          "bg-warning/20 text-warning"
                        }`}
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
          </div>
        )}
      </div>

      {/* ── BREAKDOWNS ──────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-destructive" />
          Breakdowns ({(breakdowns || []).length})
        </h3>
        {(breakdowns || []).length === 0 ? (
          <p className="text-sm text-muted-foreground glass-card p-4 text-center">No breakdowns recorded for {registration}</p>
        ) : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border">
                  {["Type", "Location", "Driver", "Date", "Nat. Team", "Workshop", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(breakdowns || []).map(b => (
                  <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground">{b.breakdown_type}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[140px] truncate">{b.location}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{(b as any).drivers?.full_name || "—"}</td>
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
                        <button onClick={() => handleResolveBreakdown(b.id)} className="flex items-center gap-1 text-xs bg-success/20 text-success px-2 py-1 rounded-full hover:opacity-80">
                          <CheckCircle className="w-3 h-3" /> Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── LOG DAMAGE FORM ── */}
      {showDamageForm && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row">
          <div className="flex-1 bg-background/50" onClick={() => setShowDamageForm(false)} />
          <div className="w-full md:w-[480px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Log Damage — {registration}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">A FleetPulse job card will auto-create</p>
              </div>
              <button onClick={() => setShowDamageForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
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
                <input type="number" value={damageForm.odometer_km} onChange={e => setDamageForm({ ...damageForm, odometer_km: e.target.value })} placeholder="145000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input value={damageForm.location} onChange={e => setDamageForm({ ...damageForm, location: e.target.value })} placeholder="e.g. Midrand yard" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Fleet Marshall Job Card # (if raised there)</label>
              <input value={damageForm.fleet_marshall_jc_ref} onChange={e => setDamageForm({ ...damageForm, fleet_marshall_jc_ref: e.target.value })} placeholder="e.g. 3736" className={inputCls} />
              <p className="text-xs text-muted-foreground mt-1">Cross-reference with your Fleet Marshall job card number</p>
            </div>

            <div>
              <label className={labelCls + " flex items-center gap-2"}><Camera className="w-4 h-4" /> Photo — Before Repair</label>
              <input type="file" accept="image/*" onChange={e => setPhotoBeforeFile(e.target.files?.[0] || null)} className="w-full text-sm text-foreground" />
            </div>

            <button onClick={handleSaveDamage} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Log Damage
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
                <h2 className="text-lg font-bold text-foreground">Log Breakdown — {registration}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Vehicle status will flip to Breakdown</p>
              </div>
              <button onClick={() => setShowBreakdownForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
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
              <textarea value={breakdownForm.description} onChange={e => setBreakdownForm({ ...breakdownForm, description: e.target.value })} rows={2} placeholder="What happened?" className={inputCls} />
            </div>

            <div className="flex items-center gap-3 bg-secondary rounded-lg px-4 py-3">
              <input type="checkbox" id="nat-team-vd" checked={breakdownForm.national_team_notified}
                onChange={e => setBreakdownForm({ ...breakdownForm, national_team_notified: e.target.checked })}
                className="w-4 h-4 accent-primary" />
              <label htmlFor="nat-team-vd" className="text-sm text-foreground cursor-pointer">National Breakdown Team notified</label>
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
