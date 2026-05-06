import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDrivers } from "@/hooks/useOrgData";
import { AlertTriangle, Zap, ClipboardList, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { DamageReportForm } from "./DamageReportForm";

const WORKSHOPS = ["AC&R","JJ","ICE COLD BODIES","SERCO BODIES","DH LIFTS","SPARTAN WORKSHOP","Other"];
const BREAKDOWN_TYPES = ["Tyre","Mechanical","Accident","Electrical","Body Damage","Refrigeration","Other"];

interface Props {
  vehicleId: string;
  registration: string;
  operationalStatus?: string | null;
}

const opStatusStyles: Record<string,string> = {
  "Operational":        "bg-success/20 text-success",
  "Awaiting Workshop":  "bg-warning/20 text-warning",
  "Under Repair":       "bg-primary/20 text-primary",
  "Awaiting Parts":     "bg-orange-500/20 text-orange-400",
  "Breakdown":          "bg-destructive/20 text-destructive",
  "Off Road":           "bg-muted text-muted-foreground",
};

const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1";

export function VehicleMaintenanceTab({ vehicleId, registration, operationalStatus }: Props) {
  const queryClient = useQueryClient();
  const { data: drivers } = useDrivers();
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [showBreakdownForm, setShowBreakdownForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [breakdownForm, setBreakdownForm] = useState({ driver_id:"", location:"", breakdown_type:"Mechanical", description:"", workshop:"", national_team_notified:false });

  const { data: damages, isLoading: dL } = useQuery({
    queryKey: ["damages", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("damages").select("*, drivers(full_name)").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0, refetchOnMount: "always",
  });

  const { data: jobCards, isLoading: jL } = useQuery({
    queryKey: ["job_cards", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_cards").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0, refetchOnMount: "always",
  });

  const { data: breakdowns, isLoading: bL } = useQuery({
    queryKey: ["breakdowns", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("breakdowns").select("*, drivers(full_name)").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0, refetchOnMount: "always",
  });

  const handleWorkshopChange = async (id: string, workshop: string) => {
    const { error } = await supabase.from("job_cards").update({ workshop_name: workshop }).eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["job_cards", vehicleId] });
  };

  const handleStatusChange = async (id: string, status: string) => {
    const update: any = { status };
    if (status === "completed") update.completed_date = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("job_cards").update(update).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); queryClient.invalidateQueries({ queryKey: ["job_cards", vehicleId] }); }
  };

  const handleSaveBreakdown = async () => {
    if (!breakdownForm.location) { toast.error("Location required"); return; }
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
    toast.success("Breakdown logged");
    setShowBreakdownForm(false);
    setBreakdownForm({ driver_id:"", location:"", breakdown_type:"Mechanical", description:"", workshop:"", national_team_notified:false });
    queryClient.invalidateQueries({ queryKey: ["breakdowns", vehicleId] });
  };

  const handleResolveBreakdown = async (id: string) => {
    const { error } = await supabase.from("breakdowns").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Breakdown resolved");
    queryClient.invalidateQueries({ queryKey: ["breakdowns", vehicleId] });
  };

  return (
    <div className="space-y-6">

      {/* Status banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Operational Status:</span>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${opStatusStyles[operationalStatus || "Operational"] || opStatusStyles["Operational"]}`}>
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

      {(dL || jL || bL) && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {/* Damages */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" /> Damages ({(damages||[]).length})
        </h3>
        {(damages||[]).length === 0
          ? <p className="text-sm text-muted-foreground glass-card p-4 text-center">No damages recorded for {registration}</p>
          : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead><tr className="border-b border-border">
                {["Date","Reporter","Parts Damaged","Severity","Km","FM JC#","Status","Photos"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(damages||[]).map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{new Date(d.created_at!).toLocaleDateString("en-ZA")}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-foreground">{d.reported_by}</div>
                      <div className="text-xs text-muted-foreground capitalize">{d.reporter_role}</div>
                      {(d as any).drivers?.full_name && <div className="text-xs text-primary">Driver: {(d as any).drivers.full_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground max-w-[160px]">
                      {Array.isArray((d as any).parts_affected) && (d as any).parts_affected.length > 0
                        ? (d as any).parts_affected.slice(0,3).join(", ") + ((d as any).parts_affected.length > 3 ? ` +${(d as any).parts_affected.length-3} more` : "")
                        : (d.description || "").substring(0,40)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                        (d as any).severity==="critical" ? "bg-destructive/20 text-destructive" :
                        (d as any).severity==="major"    ? "bg-orange-500/20 text-orange-400" :
                        "bg-yellow-500/20 text-yellow-400"}`}>
                        {(d as any).severity||"minor"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{d.odometer_km ? `${d.odometer_km.toLocaleString()} km` : "—"}</td>
                    <td className="px-4 py-3 text-sm font-mono text-primary">{(d as any).fleet_marshall_jc_ref || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${d.status==="Resolved" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {Array.isArray((d as any).photo_urls) && (d as any).photo_urls.length > 0
                        ? <span className="text-primary">📷 {(d as any).photo_urls.length}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Job Cards */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" /> Job Cards ({(jobCards||[]).length})
        </h3>
        {(jobCards||[]).length === 0
          ? <p className="text-sm text-muted-foreground glass-card p-4 text-center">No job cards — log a damage to auto-create one</p>
          : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-b border-border">
                {["JC No.","Type","Workshop","Date","Cost","Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(jobCards||[]).map(j => (
                  <tr key={j.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-primary">{j.job_card_number||"—"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{j.job_type}</td>
                    <td className="px-4 py-3">
                      <select value={j.workshop_name||""} onChange={e => handleWorkshopChange(j.id, e.target.value)}
                        className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none">
                        <option value="">Select workshop</option>
                        {WORKSHOPS.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{j.work_date || new Date(j.created_at!).toLocaleDateString("en-ZA")}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">R {(Number(j.total_cost)||0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <select value={j.status} onChange={e => handleStatusChange(j.id, e.target.value)}
                        className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${
                          j.status==="completed" ? "bg-success/20 text-success" :
                          j.status==="in_progress" ? "bg-primary/20 text-primary" : "bg-warning/20 text-warning"}`}>
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
      </section>

      {/* Breakdowns */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-destructive" /> Breakdowns ({(breakdowns||[]).length})
        </h3>
        {(breakdowns||[]).length === 0
          ? <p className="text-sm text-muted-foreground glass-card p-4 text-center">No breakdowns recorded</p>
          : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead><tr className="border-b border-border">
                {["Type","Location","Driver","Date","Nat. Team","Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(breakdowns||[]).map(b => (
                  <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground">{b.breakdown_type}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[140px] truncate">{b.location}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{(b as any).drivers?.full_name||"—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{new Date(b.reported_at!).toLocaleDateString("en-ZA")}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${b.national_team_notified ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                        {b.national_team_notified ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {b.resolved
                        ? <span className="flex items-center gap-1 text-xs text-success"><CheckCircle className="w-3 h-3" /> Resolved</span>
                        : <button onClick={() => handleResolveBreakdown(b.id)} className="flex items-center gap-1 text-xs bg-success/20 text-success px-2 py-1 rounded-full hover:opacity-80"><CheckCircle className="w-3 h-3" /> Resolve</button>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Damage report form */}
      {showDamageForm && (
        <DamageReportForm
          vehicleId={vehicleId}
          vehicleReg={registration}
          onClose={() => setShowDamageForm(false)}
          onSaved={() => {
            setShowDamageForm(false);
            queryClient.invalidateQueries({ queryKey: ["damages", vehicleId] });
            queryClient.invalidateQueries({ queryKey: ["job_cards", vehicleId] });
          }}
        />
      )}

      {/* Breakdown form */}
      {showBreakdownForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/50" onClick={() => setShowBreakdownForm(false)} />
          <div className="w-full max-w-md bg-card border-l border-border p-6 overflow-y-auto space-y-4 max-h-screen">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Log Breakdown — {registration}</h2>
              <button onClick={() => setShowBreakdownForm(false)} className="text-muted-foreground hover:text-foreground"><Zap className="w-5 h-5" /></button>
            </div>
            <div>
              <label className={labelCls}>Driver</label>
              <select value={breakdownForm.driver_id} onChange={e => setBreakdownForm({...breakdownForm, driver_id: e.target.value})} className={inputCls}>
                <option value="">Select driver (optional)</option>
                {(drivers||[]).map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type *</label>
                <select value={breakdownForm.breakdown_type} onChange={e => setBreakdownForm({...breakdownForm, breakdown_type: e.target.value})} className={inputCls}>
                  {BREAKDOWN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Workshop</label>
                <select value={breakdownForm.workshop} onChange={e => setBreakdownForm({...breakdownForm, workshop: e.target.value})} className={inputCls}>
                  <option value="">TBC</option>
                  {WORKSHOPS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Location *</label>
              <input value={breakdownForm.location} onChange={e => setBreakdownForm({...breakdownForm, location: e.target.value})} placeholder="Where did it happen?" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={breakdownForm.description} onChange={e => setBreakdownForm({...breakdownForm, description: e.target.value})} rows={2} className={inputCls} />
            </div>
            <div className="flex items-center gap-3 bg-secondary rounded-lg px-4 py-3">
              <input type="checkbox" id="nat-bd" checked={breakdownForm.national_team_notified}
                onChange={e => setBreakdownForm({...breakdownForm, national_team_notified: e.target.checked})} className="w-4 h-4 accent-primary" />
              <label htmlFor="nat-bd" className="text-sm text-foreground cursor-pointer">National Breakdown Team notified</label>
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
