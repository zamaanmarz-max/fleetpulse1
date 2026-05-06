import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDrivers } from "@/hooks/useOrgData";
import { useVehicles } from "@/hooks/useOrgData";
import {
  X, Loader2, Camera, ChevronRight, ChevronLeft,
  AlertTriangle, Package, User, Truck, CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { TruckPartSelector, ORDERABLE_PARTS } from "./TruckPartSelector";

const STEPS = [
  { id: "reporter",  label: "Reporter",      icon: User },
  { id: "parts",     label: "Damage Parts",  icon: Truck },
  { id: "details",   label: "Details",       icon: AlertTriangle },
  { id: "photos",    label: "Photos",        icon: Camera },
  { id: "order",     label: "Parts Order",   icon: Package },
  { id: "review",    label: "Review",        icon: CheckCircle },
];

const SEVERITY_OPTIONS = [
  { value: "minor",    label: "Minor",    desc: "Cosmetic / small damage, vehicle can operate", color: "border-yellow-500/60 bg-yellow-500/10 text-yellow-400" },
  { value: "major",    label: "Major",    desc: "Significant damage, needs repair soon",          color: "border-orange-500/60 bg-orange-500/10 text-orange-400" },
  { value: "critical", label: "Critical", desc: "Unsafe — vehicle must be taken off road",        color: "border-destructive/60 bg-destructive/10 text-destructive" },
];
const URGENCY_OPTIONS = [
  { value: "routine",  label: "Routine",  desc: "Can be scheduled with next service" },
  { value: "urgent",   label: "Urgent",   desc: "Needs repair within 48 hours" },
  { value: "critical", label: "Immediate",desc: "Needs repair NOW — do not operate" },
];
const REPORTER_ROLES = [
  { value: "vehicle checker", label: "Vehicle Checker" },
  { value: "driver",          label: "Driver" },
  { value: "controller",      label: "Controller" },
  { value: "other",           label: "Other" },
];

interface Props {
  vehicleId?: string;
  vehicleReg?: string;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1";

export function DamageReportForm({ vehicleId, vehicleReg, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const { data: drivers } = useDrivers();
  const { data: vehicles } = useVehicles();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [form, setForm] = useState({
    vehicle_id: vehicleId || "",
    reported_by: "",
    reporter_role: "vehicle checker",
    driver_id: "",
    odometer_km: "",
    location: "",
    fleet_marshall_jc_ref: "",
    description: "",
    severity: "minor",
    urgency: "routine",
    parts_affected: [] as string[],
    requires_order: false,
  });

  const [orderItems, setOrderItems] = useState<Array<{ part_name: string; category: string; quantity: number; urgency: string; notes: string }>>([]);

  const selectedVehicle = (vehicles || []).find(v => v.id === form.vehicle_id);
  const displayReg = vehicleReg || selectedVehicle?.registration_number || "";

  // ── Photo handling ─────────────────────────────────────
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotoFiles(prev => [...prev, ...files]);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setPhotoPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (idx: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Part toggle ─────────────────────────────────────────
  const togglePart = (part: string) => {
    setForm(prev => ({
      ...prev,
      parts_affected: prev.parts_affected.includes(part)
        ? prev.parts_affected.filter(p => p !== part)
        : [...prev.parts_affected, part],
    }));
  };

  // ── Order items ─────────────────────────────────────────
  const addOrderItem = (partName: string, category: string) => {
    if (orderItems.some(i => i.part_name === partName)) return;
    setOrderItems(prev => [...prev, { part_name: partName, category, quantity: 1, urgency: "standard", notes: "" }]);
  };

  const removeOrderItem = (idx: number) => setOrderItems(prev => prev.filter((_, i) => i !== idx));

  // ── Validation ──────────────────────────────────────────
  const canProceed = () => {
    if (step === 0) return form.vehicle_id && form.reported_by;
    if (step === 1) return form.parts_affected.length > 0;
    if (step === 2) return form.description && form.odometer_km;
    if (step === 3) return photoFiles.length > 0;
    return true;
  };

  // ── Submit ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.vehicle_id || !form.reported_by || !form.description || !form.odometer_km) {
      toast.error("Required fields missing");
      return;
    }
    setSaving(true);

    // Upload photos
    const uploadedUrls: string[] = [];
    for (const file of photoFiles) {
      const path = `damages/${form.vehicle_id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("certificates").upload(path, file);
      if (!upErr) uploadedUrls.push(path);
    }

    // Insert damage record
    const { data: damage, error } = await supabase.from("damages").insert({
      vehicle_id: form.vehicle_id,
      driver_id: form.driver_id || null,
      reported_by: form.reported_by,
      reporter_role: form.reporter_role,
      description: form.description,
      odometer_km: parseInt(form.odometer_km) || null,
      location: form.location || null,
      fleet_marshall_jc_ref: form.fleet_marshall_jc_ref || null,
      severity: form.severity,
      urgency: form.urgency,
      parts_affected: form.parts_affected,
      photo_urls: uploadedUrls,
      requires_order: form.requires_order,
      status: form.urgency === "critical" ? "Reported" : "Reported",
    }).select().single();

    if (error) { toast.error(error.message); setSaving(false); return; }

    // Insert parts orders
    if (orderItems.length > 0 && damage) {
      await supabase.from("parts_orders").insert(
        orderItems.map(item => ({
          damage_id: damage.id,
          vehicle_id: form.vehicle_id,
          part_name: item.part_name,
          part_category: item.category,
          quantity: item.quantity,
          urgency: item.urgency,
          notes: item.notes || null,
          status: "pending",
        }))
      );
    }

    setSaving(false);
    toast.success(`✅ Damage report submitted — job card auto-created${orderItems.length > 0 ? ` + ${orderItems.length} part(s) ordered` : ""}`);
    queryClient.invalidateQueries({ queryKey: ["damages"] });
    queryClient.invalidateQueries({ queryKey: ["damages", form.vehicle_id] });
    queryClient.invalidateQueries({ queryKey: ["job_cards"] });
    queryClient.invalidateQueries({ queryKey: ["job_cards", form.vehicle_id] });
    onSaved();
  };

  const currentStep = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-card border-l border-border flex flex-col max-h-screen">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Damage Report {displayReg ? `— ${displayReg}` : ""}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {step + 1} of {STEPS.length}: {currentStep.label}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-5 py-2 flex-shrink-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* STEP 0: Reporter */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-primary">
                <strong>Vehicle Checker:</strong> Fill in all details accurately. Incomplete reports will not be accepted.
              </div>

              {!vehicleId && (
                <div>
                  <label className={labelCls}>Vehicle *</label>
                  <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} className={inputCls}>
                    <option value="">Select vehicle</option>
                    {(vehicles || []).map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Your Name *</label>
                  <input value={form.reported_by} onChange={e => setForm({ ...form, reported_by: e.target.value })} placeholder="Full name" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Your Role *</label>
                  <select value={form.reporter_role} onChange={e => setForm({ ...form, reporter_role: e.target.value })} className={inputCls}>
                    {REPORTER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Driver at Time of Damage</label>
                <select value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })} className={inputCls}>
                  <option value="">Select driver (if known)</option>
                  {(drivers || []).map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Required to track which driver damaged which part</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Odometer (km) *</label>
                  <input type="number" value={form.odometer_km} onChange={e => setForm({ ...form, odometer_km: e.target.value })} placeholder="e.g. 145000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Location</label>
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Midrand yard" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Fleet Marshall JC# (if already raised)</label>
                <input value={form.fleet_marshall_jc_ref} onChange={e => setForm({ ...form, fleet_marshall_jc_ref: e.target.value })} placeholder="e.g. 3736" className={inputCls} />
              </div>
            </div>
          )}

          {/* STEP 1: Select damaged parts */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select all parts of the vehicle that are damaged. You can select multiple parts.</p>
              <TruckPartSelector selectedParts={form.parts_affected} onTogglePart={togglePart} />
            </div>
          )}

          {/* STEP 2: Damage details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Damage Description *</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} placeholder={`Describe the damage in detail.\n\nSelected parts: ${form.parts_affected.join(", ")}`} className={inputCls} />
              </div>

              <div>
                <label className={labelCls + " mb-2"}>Damage Severity *</label>
                <div className="space-y-2">
                  {SEVERITY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setForm({ ...form, severity: opt.value })}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${form.severity === opt.value ? opt.color + " border-opacity-100" : "border-border bg-secondary/30 text-foreground hover:border-primary/30"}`}>
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs opacity-75 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls + " mb-2"}>Urgency *</label>
                <div className="space-y-2">
                  {URGENCY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setForm({ ...form, urgency: opt.value })}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${form.urgency === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-foreground hover:border-primary/30"}`}>
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs opacity-75 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Photos */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-xs text-warning">
                📷 At least one photo is required. Take clear photos of all damaged areas before any repairs.
              </div>

              <button onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Tap to add photos</p>
                <p className="text-xs text-muted-foreground mt-1">Multiple photos allowed — JPG, PNG</p>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />

              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden aspect-square">
                      <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(i)}
                        className="absolute top-1.5 right-1.5 bg-destructive text-white rounded-full p-1 shadow-sm hover:opacity-90">
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-background/70 text-xs text-foreground px-2 py-1">
                        Before repair — photo {i + 1}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-xs">Add more</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Parts order */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-secondary rounded-xl px-4 py-3">
                <input type="checkbox" id="requires-order" checked={form.requires_order}
                  onChange={e => setForm({ ...form, requires_order: e.target.checked })}
                  className="w-4 h-4 accent-primary" />
                <label htmlFor="requires-order" className="text-sm font-medium text-foreground cursor-pointer">
                  Parts need to be ordered for this damage
                </label>
              </div>

              {form.requires_order && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Select parts to order based on the damage:</p>
                  <div className="space-y-3">
                    {Object.entries(ORDERABLE_PARTS).map(([category, parts]) => {
                      const relevantParts = parts.filter(p => form.parts_affected.includes(p) || true);
                      return (
                        <div key={category} className="space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</p>
                          <div className="grid grid-cols-1 gap-1.5">
                            {relevantParts.map(part => {
                              const isAdded = orderItems.some(i => i.part_name === part);
                              const isRelated = form.parts_affected.includes(part);
                              return (
                                <button key={part} onClick={() => isAdded ? removeOrderItem(orderItems.findIndex(i => i.part_name === part)) : addOrderItem(part, category)}
                                  className={`text-left text-xs px-3 py-2 rounded-lg border flex items-center justify-between transition-all ${isAdded ? "bg-primary/20 border-primary/40 text-primary" : isRelated ? "bg-warning/10 border-warning/30 text-foreground" : "bg-secondary/30 border-border text-foreground hover:border-primary/30"}`}>
                                  <span>{part} {isRelated && !isAdded && <span className="text-warning ml-1">— damaged</span>}</span>
                                  <span className="font-semibold">{isAdded ? "✓ Added" : "+ Order"}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {orderItems.length > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-primary">Parts to order ({orderItems.length}):</p>
                      {orderItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-foreground flex-1">{item.part_name}</span>
                          <select value={item.urgency} onChange={e => setOrderItems(prev => prev.map((it, idx) => idx === i ? { ...it, urgency: e.target.value } : it))}
                            className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground">
                            <option value="standard">Standard</option>
                            <option value="urgent">Urgent</option>
                          </select>
                          <input type="number" min={1} value={item.quantity} onChange={e => setOrderItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: parseInt(e.target.value) || 1 } : it))}
                            className="w-12 text-xs bg-secondary border border-border rounded px-2 py-1 text-center text-foreground" />
                          <button onClick={() => removeOrderItem(i)} className="text-destructive text-xs hover:opacity-70">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-success/10 border border-success/30 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-foreground">Review before submitting</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Vehicle:</span><span className="font-semibold">{displayReg}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reported by:</span><span>{form.reported_by} ({form.reporter_role})</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Severity:</span><span className="capitalize font-semibold">{form.severity}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Urgency:</span><span className="capitalize">{form.urgency}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Parts affected:</span><span>{form.parts_affected.length} parts</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Photos:</span><span>{photoFiles.length} uploaded</span></div>
                  {orderItems.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Parts to order:</span><span>{orderItems.length} items</span></div>}
                  {form.fleet_marshall_jc_ref && <div className="flex justify-between"><span className="text-muted-foreground">FM JC#:</span><span>{form.fleet_marshall_jc_ref}</span></div>}
                </div>
              </div>
              <div className="bg-secondary/50 rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Damaged Parts:</p>
                <p className="text-xs text-foreground">{form.parts_affected.join(", ")}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Description:</p>
                <p className="text-xs text-foreground">{form.description}</p>
              </div>
              {form.urgency === "critical" && (
                <div className="bg-destructive/20 border border-destructive/40 rounded-xl p-3 text-sm text-destructive font-semibold">
                  ⚠ CRITICAL — Vehicle will be marked Off Road upon submission
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border flex-shrink-0">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg bg-secondary">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          {step === 4 && !form.requires_order && (
            <button onClick={() => setStep(s => s + 1)} className="flex-1 flex items-center justify-center gap-2 bg-secondary text-foreground py-2.5 rounded-lg text-sm hover:bg-secondary/80">
              Skip <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step < STEPS.length - 1 && (step !== 4 || form.requires_order) && (
            <button onClick={() => { if (canProceed()) setStep(s => s + 1); else toast.error("Please fill in required fields before proceeding"); }}
              disabled={!canProceed()}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === STEPS.length - 1 && (
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? "Submitting..." : "Submit Damage Report"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
