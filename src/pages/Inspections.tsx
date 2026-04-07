import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Loader2, X, Plus, Trash2, Upload } from "lucide-react";
import { useInspections, useVehicles, useDrivers } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const conditionStyles: Record<string, string> = {
  good: "bg-success/20 text-success border-success",
  fair: "bg-warning/20 text-warning border-warning",
  poor: "bg-destructive/20 text-destructive border-destructive",
  unroadworthy: "bg-destructive/30 text-destructive border-destructive",
};

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/20 text-primary",
  reviewed: "bg-success/20 text-success",
};

const damageLocations = [
  "Front bumper", "Rear bumper", "Left front door", "Right front door",
  "Left rear door", "Right rear door", "Left side panel", "Right side panel",
  "Windscreen", "Rear window", "Roof", "Undercarriage", "Interior",
  "Engine bay", "Tyres - Front left", "Tyres - Front right",
  "Tyres - Rear left", "Tyres - Rear right", "Lights", "Mirrors", "Exhaust",
];

const damageTypes = [
  "Scratch", "Dent", "Crack", "Chip", "Broken/Missing part", "Rust",
  "Tyre damage", "Glass damage", "Mechanical fault", "Flood damage",
  "Fire damage", "Vandalism",
];

const severityOptions = [
  { value: "minor", label: "Minor", cls: "border-success text-success" },
  { value: "moderate", label: "Moderate", cls: "border-warning text-warning" },
  { value: "severe", label: "Severe", cls: "border-destructive text-destructive" },
  { value: "critical", label: "Critical", cls: "border-destructive text-destructive font-bold" },
];

type DamageItem = {
  location: string;
  damage_type: string;
  severity: string;
  description: string;
  requires_immediate_action: boolean;
  photos: File[];
};

export default function Inspections() {
  const navigate = useNavigate();
  const { data: inspections, isLoading } = useInspections();
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vehicle_id: "",
    odometer: "",
    overall_condition: "good",
    notes: "",
  });

  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);

  const addDamageItem = () => {
    setDamageItems([...damageItems, {
      location: "", damage_type: "", severity: "minor",
      description: "", requires_immediate_action: false, photos: [],
    }]);
  };

  const updateDamageItem = (idx: number, field: string, value: any) => {
    setDamageItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeDamageItem = (idx: number) => {
    setDamageItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.vehicle_id || !profile?.organisation_id) {
      toast.error("Please select a vehicle");
      return;
    }
    setSaving(true);
    const vehicle = (vehicles || []).find(v => v.id === form.vehicle_id);

    const { data: inspection, error: insErr } = await supabase.from("damage_inspections").insert({
      organisation_id: profile.organisation_id,
      vehicle_id: form.vehicle_id,
      branch_id: vehicle?.branch_id || null,
      inspector_id: user?.id || null,
      overall_condition: form.overall_condition,
      odometer_at_inspection: form.odometer ? parseInt(form.odometer) : null,
      notes: form.notes || null,
      status: "submitted",
      total_damage_items: damageItems.length,
      new_damage_items: damageItems.length,
      has_critical_damage: damageItems.some(d => d.severity === "critical"),
    }).select("id").single();

    if (insErr) { toast.error(insErr.message); setSaving(false); return; }

    // Insert damage items
    for (const item of damageItems) {
      let photoUrls: string[] = [];
      for (const photo of item.photos) {
        const path = `${profile.organisation_id}/inspections/${inspection.id}/${Date.now()}_${photo.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, photo);
        if (!upErr) photoUrls.push(path);
      }

      await supabase.from("damage_items").insert({
        organisation_id: profile.organisation_id,
        inspection_id: inspection.id,
        vehicle_id: form.vehicle_id,
        location: item.location || null,
        damage_type: item.damage_type || null,
        severity: item.severity,
        description: item.description || null,
        requires_immediate_action: item.requires_immediate_action,
        is_new_damage: true,
        photo_urls: photoUrls,
      });
    }

    // Update vehicle odometer if provided
    if (form.odometer) {
      await supabase.from("vehicles").update({
        current_odometer_km: parseInt(form.odometer),
      }).eq("id", form.vehicle_id);
    }

    setSaving(false);
    toast.success("Inspection submitted successfully");
    setShowForm(false);
    setStep(1);
    setForm({ vehicle_id: "", odometer: "", overall_condition: "good", notes: "" });
    setDamageItems([]);
    queryClient.invalidateQueries({ queryKey: ["inspections"] });
  };

  const canProceed = () => {
    if (step === 1) return !!form.vehicle_id;
    if (step === 2) return true;
    if (step === 3) return true;
    return true;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Damage Inspections</h1>
          <p className="text-sm text-muted-foreground">Vehicle condition and damage tracking</p>
        </div>
        <button onClick={() => { setShowForm(true); setStep(1); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90">
          <ClipboardCheck className="w-5 h-5" /> Start New Inspection
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (inspections || []).length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-muted-foreground text-sm">No inspections yet.</p>
            <button onClick={() => { setShowForm(true); setStep(1); }} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90">
              <ClipboardCheck className="w-5 h-5" /> Start New Inspection
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vehicle</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inspector</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Condition</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">New</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {(inspections || []).map((ins) => (
                <tr key={ins.id} onClick={() => navigate(`/inspections/${ins.id}`)} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{(ins as any).vehicles?.registration_number || "N/A"}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{ins.inspection_date}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{(ins as any).inspector?.full_name || "N/A"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${conditionStyles[ins.overall_condition || "good"]?.replace(/border-\w+/, '')}`}>{ins.overall_condition}</span>
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

      {/* Multi-step Inspection Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/50" onClick={() => setShowForm(false)} />
          <div className="w-[520px] bg-card border-l border-border p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">New Inspection — Step {step} of 5</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-secondary"}`} />
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Select Vehicle</h3>
                <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select vehicle</option>
                  {(vehicles || []).map(v => <option key={v.id} value={v.id}>{v.registration_number} {v.fleet_number ? `(${v.fleet_number})` : ""}</option>)}
                </select>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Odometer Reading</h3>
                <input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} placeholder="Current KM reading" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Overall Condition</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: "good", label: "✅ Good", desc: "No issues" },
                    { val: "fair", label: "⚠️ Fair", desc: "Minor issues" },
                    { val: "poor", label: "🔴 Poor", desc: "Needs repair" },
                    { val: "unroadworthy", label: "🚫 Unroadworthy", desc: "Cannot operate" },
                  ].map(c => (
                    <button key={c.val} onClick={() => setForm({ ...form, overall_condition: c.val })}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${form.overall_condition === c.val ? conditionStyles[c.val] : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                      <div className="text-sm font-bold">{c.label}</div>
                      <div className="text-xs mt-1 opacity-80">{c.desc}</div>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Any general notes about the vehicle condition..." />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Damage Items ({damageItems.length})</h3>
                  <button onClick={addDamageItem} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>

                {damageItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No damage items. Click "Add Item" if damage was found, or proceed to submit.</p>
                )}

                {damageItems.map((item, idx) => (
                  <div key={idx} className="bg-secondary/50 rounded-lg p-4 space-y-3 border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Item #{idx + 1}</span>
                      <button onClick={() => removeDamageItem(idx)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Location</label>
                      <select value={item.location} onChange={(e) => updateDamageItem(idx, "location", e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground">
                        <option value="">Select location</option>
                        {damageLocations.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Damage Type</label>
                      <select value={item.damage_type} onChange={(e) => updateDamageItem(idx, "damage_type", e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground">
                        <option value="">Select type</option>
                        {damageTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Severity</label>
                      <div className="flex gap-2">
                        {severityOptions.map(s => (
                          <button key={s.value} onClick={() => updateDamageItem(idx, "severity", s.value)}
                            className={`flex-1 py-1.5 text-xs rounded-md border-2 font-semibold ${item.severity === s.value ? s.cls + " bg-secondary" : "border-border text-muted-foreground"}`}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                      <textarea value={item.description} onChange={(e) => updateDamageItem(idx, "description", e.target.value)} rows={2} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Photos</label>
                      <input type="file" accept="image/*" multiple onChange={(e) => updateDamageItem(idx, "photos", Array.from(e.target.files || []))} className="text-xs text-foreground" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input type="checkbox" checked={item.requires_immediate_action} onChange={(e) => updateDamageItem(idx, "requires_immediate_action", e.target.checked)} className="rounded border-border" />
                      Requires immediate repair
                    </label>
                  </div>
                ))}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Review & Submit</h3>
                <div className="bg-secondary/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Vehicle</span><span className="text-foreground font-medium">{(vehicles || []).find(v => v.id === form.vehicle_id)?.registration_number}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Odometer</span><span className="text-foreground font-medium">{form.odometer ? `${parseInt(form.odometer).toLocaleString()} km` : "Not recorded"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Condition</span><span className="text-foreground font-medium capitalize">{form.overall_condition}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Damage Items</span><span className="text-foreground font-medium">{damageItems.length}</span></div>
                  {damageItems.some(d => d.severity === "critical") && (
                    <div className="text-xs text-destructive font-semibold mt-2">⚠️ Critical damage found — vehicle may need to be grounded</div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="flex-1 bg-secondary text-secondary-foreground py-2.5 rounded-lg text-sm font-semibold hover:bg-secondary/80">
                  Back
                </button>
              )}
              {step < 5 ? (
                <button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  Next
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Submit Inspection
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}