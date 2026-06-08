import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, X, Upload, Check, ArrowLeft, ArrowRight, Thermometer } from "lucide-react";
import { toast } from "sonner";
import { generateJobCardPDF } from "@/lib/jobCardPdf";

const inputCls = "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1.5";

const JOB_TYPES = [
  { value: "inspection", label: "Inspection" },
  { value: "repair", label: "Repair" },
  { value: "scheduled", label: "Service" },
  { value: "breakdown", label: "Breakdown" },
];

type Part = { qty: string; part_no: string; description: string; supplier: string; price: string };

export default function JobCardForm() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [step, setStep] = useState(1); // 1 = white page, 2 = yellow page, 3 = review
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);

  const { data: vehicles } = useQuery({
    queryKey: ["jobcard_vehicles", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, registration_number, customer_name, fridge_brand, fridge_model, fridge_serial_number, fridge_current_hrs, fridge_service_interval_hrs, fridge_last_service_hrs")
        .eq("organisation_id", profile?.organisation_id)
        .eq("is_active", true)
        .order("registration_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organisation_id,
  });

  const [form, setForm] = useState({
    vehicle_id: "", client_name: "", order_no: "", job_card_number: "",
    service_type: "scheduled", engine_hours: "", standby_hours: "", kilometres: "",
    client_instructions: "", work_done: "", tech_name: "",
    date_commenced: new Date().toISOString().split("T")[0], time_commenced: "",
    date_completed: new Date().toISOString().split("T")[0], time_completed: "",
  });

  const [parts, setParts] = useState<Part[]>([{ qty: "", part_no: "", description: "", supplier: "", price: "" }]);
  const [costing, setCosting] = useState({
    fuel: "", engine_oil: "", compressor_oil: "", refrigerant: "", anti_freeze: "", consumables: "",
    travelling_km: "", travelling_amount: "",
    labour_normal_hrs: "", labour_normal_rate: "", labour_ot_hrs: "", labour_ot_rate: "",
  });

  const selectedVehicle = (vehicles || []).find((v: any) => v.id === form.vehicle_id);

  // Auto-fill client name + serial when vehicle picked
  useEffect(() => {
    if (selectedVehicle) {
      setForm(f => ({
        ...f,
        client_name: f.client_name || selectedVehicle.customer_name || "",
        engine_hours: f.engine_hours || String(selectedVehicle.fridge_current_hrs || ""),
      }));
    }
  }, [form.vehicle_id]);

  const updatePart = (i: number, field: keyof Part, val: string) => {
    setParts(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  };
  const addPart = () => setParts(p => [...p, { qty: "", part_no: "", description: "", supplier: "", price: "" }]);
  const removePart = (i: number) => setParts(p => p.filter((_, idx) => idx !== i));

  // Cost calculations
  const totalParts = parts.reduce((s, p) => s + (parseFloat(p.price) || 0) * (parseFloat(p.qty) || 1), 0);
  const totalMisc = ["fuel", "engine_oil", "compressor_oil", "refrigerant", "anti_freeze", "consumables", "travelling_amount"]
    .reduce((s, k) => s + (parseFloat((costing as any)[k]) || 0), 0);
  const totalLabour = (parseFloat(costing.labour_normal_hrs) || 0) * (parseFloat(costing.labour_normal_rate) || 0)
    + (parseFloat(costing.labour_ot_hrs) || 0) * (parseFloat(costing.labour_ot_rate) || 0);
  const subtotal = totalParts + totalMisc + totalLabour;
  const vat = subtotal * 0.15;
  const invoiceAmount = subtotal + vat;

  const handleSubmit = async () => {
    if (!form.vehicle_id) { toast.error("Select a vehicle"); setStep(1); return; }
    if (!form.work_done) { toast.error("Fill in the technician report"); setStep(1); return; }
    setSaving(true);
    try {
      const reg = selectedVehicle?.registration_number || "unit";

      // Upload photos
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const ext = photo.name.split(".").pop();
        const path = `${reg}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("job-card-photos").upload(path, photo, { upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from("job-card-photos").getPublicUrl(path);
          photoUrls.push(data.publicUrl);
        }
      }

      const hrs = parseFloat(form.engine_hours) || null;
      const isScheduled = form.service_type === "scheduled";
      const interval = selectedVehicle?.fridge_service_interval_hrs || 1000;

      const costingData = {
        ...costing, total_parts: totalParts, total_labour: totalLabour,
        total_misc: totalMisc, subtotal, vat, invoice_amount: invoiceAmount,
      };
      const cleanParts = parts.filter(p => p.description || p.part_no);

      // Generate PDF
      let pdfUrl: string | null = null;
      try {
        const pdfBlob = generateJobCardPDF({
          jobCardNumber: form.job_card_number, clientName: form.client_name, orderNo: form.order_no,
          registration: reg, make: selectedVehicle?.fridge_brand || "", model: selectedVehicle?.fridge_model || "",
          unitSerial: selectedVehicle?.fridge_serial_number || "", jobType: form.service_type,
          engineHours: form.engine_hours, standbyHours: form.standby_hours, kilometres: form.kilometres,
          clientInstructions: form.client_instructions, technicianReport: form.work_done, technicianName: form.tech_name,
          dateCommenced: form.date_commenced, timeCommenced: form.time_commenced,
          dateCompleted: form.date_completed, timeCompleted: form.time_completed,
          parts: cleanParts, costing: costingData, photos: photoUrls,
        });
        const pdfPath = `${reg}/${Date.now()}_jobcard.pdf`;
        const { error: pdfErr } = await supabase.storage.from("job-cards").upload(pdfPath, pdfBlob, { upsert: true, contentType: "application/pdf" });
        if (!pdfErr) { const { data } = supabase.storage.from("job-cards").getPublicUrl(pdfPath); pdfUrl = data.publicUrl; }
      } catch (e) { console.error("PDF gen failed:", e); }

      // Save the job card
      const { error } = await supabase.from("fridge_service_log" as any).insert({
        organisation_id: profile?.organisation_id,
        vehicle_id: form.vehicle_id,
        service_date: form.date_completed || new Date().toISOString().split("T")[0],
        hours_at_service: hrs,
        service_type: form.service_type,
        work_done: form.work_done,
        tech_name: form.tech_name || null,
        job_card_number: form.job_card_number || null,
        client_name: form.client_name || null,
        order_no: form.order_no || null,
        engine_hours: hrs,
        standby_hours: parseFloat(form.standby_hours) || null,
        kilometres: parseFloat(form.kilometres) || null,
        client_instructions: form.client_instructions || null,
        date_commenced: form.date_commenced || null,
        time_commenced: form.time_commenced || null,
        date_completed: form.date_completed || null,
        time_completed: form.time_completed || null,
        unit_serial: selectedVehicle?.fridge_serial_number || null,
        parts_list: cleanParts,
        costing: costingData,
        photos: photoUrls,
        pdf_url: pdfUrl,
        job_card_url: pdfUrl,
        total_cost: invoiceAmount || null,
        parts_used: cleanParts.map(p => p.description).filter(Boolean).join(", ") || null,
        status: "submitted",
        logged_via: "tech_app",
        updates_service_clock: isScheduled,
      });
      if (error) throw error;

      // Update vehicle hours
      if (hrs) {
        const update: any = { fridge_current_hrs: hrs, fridge_hours_updated_at: new Date().toISOString() };
        if (isScheduled) {
          update.fridge_last_service_hrs = hrs;
          update.fridge_last_service_date = form.date_completed || new Date().toISOString().split("T")[0];
          update.fridge_next_service_hrs = hrs + interval;
        }
        await supabase.from("vehicles").update(update).eq("id", form.vehicle_id);
      }

      setSaving(false);
      toast.success("Job card submitted ✓ Office can now download the PDF");
      navigate("/fridge-tracker");
    } catch (e: any) {
      setSaving(false);
      toast.error(e.message || "Failed to submit job card");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground flex items-center gap-2"><Thermometer className="w-4 h-4 text-primary" /> Job Card</h1>
          <p className="text-xs text-muted-foreground">Step {step} of 3 · {step === 1 ? "Job Details" : step === 2 ? "Parts & Costing" : "Review & Submit"}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <div className="h-full bg-primary transition-all" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* STEP 1 - WHITE PAGE */}
        {step === 1 && (
          <>
            <div>
              <label className={labelCls}>Vehicle / Unit *</label>
              <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} className={inputCls}>
                <option value="">Select the unit...</option>
                {(vehicles || []).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.registration_number} — {v.fridge_brand} {v.fridge_model}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Job Card No.</label><input value={form.job_card_number} onChange={e => setForm({ ...form, job_card_number: e.target.value })} placeholder="e.g. 96906" className={inputCls} /></div>
              <div><label className={labelCls}>Order No.</label><input value={form.order_no} onChange={e => setForm({ ...form, order_no: e.target.value })} className={inputCls} /></div>
            </div>

            <div>
              <label className={labelCls}>Customer / Client</label>
              <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Auto-fills from unit" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Job Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {JOB_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setForm({ ...form, service_type: t.value })}
                    className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.service_type === t.value ? "border-primary bg-primary/10 text-foreground" : "border-border bg-secondary/30 text-muted-foreground"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Engine Hrs</label><input type="number" inputMode="decimal" value={form.engine_hours} onChange={e => setForm({ ...form, engine_hours: e.target.value })} placeholder="hrs" className={inputCls} /></div>
              <div><label className={labelCls}>Standby Hrs</label><input type="number" inputMode="decimal" value={form.standby_hours} onChange={e => setForm({ ...form, standby_hours: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Kilometres</label><input type="number" inputMode="decimal" value={form.kilometres} onChange={e => setForm({ ...form, kilometres: e.target.value })} className={inputCls} /></div>
            </div>

            <div>
              <label className={labelCls}>Client's Instructions</label>
              <textarea value={form.client_instructions} onChange={e => setForm({ ...form, client_instructions: e.target.value })} rows={2} placeholder="What did the client ask for?" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Technician Report *</label>
              <textarea value={form.work_done} onChange={e => setForm({ ...form, work_done: e.target.value })} rows={5} placeholder="Describe the work done in detail..." className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Photos</label>
              <div className={`${inputCls} flex items-center gap-2 cursor-pointer`} onClick={() => document.getElementById("photo-upload")?.click()}>
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">{photos.length > 0 ? `${photos.length} photo(s) added` : "Add photos of the job"}</span>
              </div>
              <input id="photo-upload" type="file" accept="image/*" multiple capture="environment" className="hidden"
                onChange={e => setPhotos([...photos, ...Array.from(e.target.files || [])])} />
              {photos.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {photos.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={URL.createObjectURL(p)} alt="" className="w-16 h-16 object-cover rounded-lg" />
                      <button onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Technician Name</label>
              <input value={form.tech_name} onChange={e => setForm({ ...form, tech_name: e.target.value })} placeholder="Your name" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Date Started</label><input type="date" value={form.date_commenced} onChange={e => setForm({ ...form, date_commenced: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Time Started</label><input type="time" value={form.time_commenced} onChange={e => setForm({ ...form, time_commenced: e.target.value })} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Date Completed</label><input type="date" value={form.date_completed} onChange={e => setForm({ ...form, date_completed: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Time Completed</label><input type="time" value={form.time_completed} onChange={e => setForm({ ...form, time_completed: e.target.value })} className={inputCls} /></div>
            </div>
          </>
        )}

        {/* STEP 2 - YELLOW PAGE */}
        {step === 2 && (
          <>
            <div>
              <h2 className="text-sm font-bold text-foreground mb-2">Parts Used</h2>
              <div className="space-y-3">
                {parts.map((p, i) => (
                  <div key={i} className="border border-border rounded-xl p-3 space-y-2 relative">
                    {parts.length > 1 && <button onClick={() => removePart(i)} className="absolute top-2 right-2 text-muted-foreground"><X className="w-4 h-4" /></button>}
                    <div className="grid grid-cols-3 gap-2">
                      <input value={p.qty} onChange={e => updatePart(i, "qty", e.target.value)} placeholder="Qty" type="number" inputMode="decimal" className={inputCls} />
                      <input value={p.part_no} onChange={e => updatePart(i, "part_no", e.target.value)} placeholder="Part No." className={`${inputCls} col-span-2`} />
                    </div>
                    <input value={p.description} onChange={e => updatePart(i, "description", e.target.value)} placeholder="Description" className={inputCls} />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={p.supplier} onChange={e => updatePart(i, "supplier", e.target.value)} placeholder="Supplier" className={inputCls} />
                      <input value={p.price} onChange={e => updatePart(i, "price", e.target.value)} placeholder="Price (R)" type="number" inputMode="decimal" className={inputCls} />
                    </div>
                  </div>
                ))}
                <button onClick={addPart} className="flex items-center gap-1.5 text-sm text-primary font-semibold"><Plus className="w-4 h-4" /> Add another part</button>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-foreground mb-2">Miscellaneous</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Fuel (R)</label><input type="number" inputMode="decimal" value={costing.fuel} onChange={e => setCosting({ ...costing, fuel: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Engine Oil (R)</label><input type="number" inputMode="decimal" value={costing.engine_oil} onChange={e => setCosting({ ...costing, engine_oil: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Compressor Oil (R)</label><input type="number" inputMode="decimal" value={costing.compressor_oil} onChange={e => setCosting({ ...costing, compressor_oil: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Refrigerant (R)</label><input type="number" inputMode="decimal" value={costing.refrigerant} onChange={e => setCosting({ ...costing, refrigerant: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Anti-Freeze (R)</label><input type="number" inputMode="decimal" value={costing.anti_freeze} onChange={e => setCosting({ ...costing, anti_freeze: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Consumables (R)</label><input type="number" inputMode="decimal" value={costing.consumables} onChange={e => setCosting({ ...costing, consumables: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Travelling (km)</label><input type="number" inputMode="decimal" value={costing.travelling_km} onChange={e => setCosting({ ...costing, travelling_km: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Travelling (R)</label><input type="number" inputMode="decimal" value={costing.travelling_amount} onChange={e => setCosting({ ...costing, travelling_amount: e.target.value })} className={inputCls} /></div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-foreground mb-2">Labour</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Normal Hrs</label><input type="number" inputMode="decimal" value={costing.labour_normal_hrs} onChange={e => setCosting({ ...costing, labour_normal_hrs: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Rate (R/hr)</label><input type="number" inputMode="decimal" value={costing.labour_normal_rate} onChange={e => setCosting({ ...costing, labour_normal_rate: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Overtime Hrs</label><input type="number" inputMode="decimal" value={costing.labour_ot_hrs} onChange={e => setCosting({ ...costing, labour_ot_hrs: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>OT Rate (R/hr)</label><input type="number" inputMode="decimal" value={costing.labour_ot_rate} onChange={e => setCosting({ ...costing, labour_ot_rate: e.target.value })} className={inputCls} /></div>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Parts</span><span className="text-foreground font-mono">R {totalParts.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Labour</span><span className="text-foreground font-mono">R {totalLabour.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Miscellaneous</span><span className="text-foreground font-mono">R {totalMisc.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm border-t border-border pt-1.5"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground font-mono">R {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT (15%)</span><span className="text-foreground font-mono">R {vat.toFixed(2)}</span></div>
              <div className="flex justify-between text-base font-bold border-t border-border pt-1.5"><span className="text-foreground">Invoice Amount</span><span className="text-primary font-mono">R {invoiceAmount.toFixed(2)}</span></div>
            </div>
          </>
        )}

        {/* STEP 3 - REVIEW */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <Row label="Unit" value={selectedVehicle ? `${selectedVehicle.registration_number} — ${selectedVehicle.fridge_brand} ${selectedVehicle.fridge_model}` : "—"} />
              <Row label="Job Card No." value={form.job_card_number || "—"} />
              <Row label="Customer" value={form.client_name || "—"} />
              <Row label="Job Type" value={JOB_TYPES.find(t => t.value === form.service_type)?.label || form.service_type} />
              <Row label="Engine Hrs" value={form.engine_hours || "—"} />
              <Row label="Technician" value={form.tech_name || "—"} />
              <Row label="Photos" value={`${photos.length} attached`} />
              <Row label="Parts" value={`${parts.filter(p => p.description || p.part_no).length} item(s)`} />
              <Row label="Invoice Total" value={`R ${invoiceAmount.toFixed(2)}`} />
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
              <p className="text-sm text-foreground">When you submit, a PDF job card is generated and sent straight to the office. They can download it without waiting for you to come back.</p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 flex gap-3 max-w-lg mx-auto">
        {step < 3 ? (
          <button onClick={() => { if (step === 1 && !form.vehicle_id) { toast.error("Select a vehicle first"); return; } setStep(step + 1); }}
            className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Submit Job Card
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}
