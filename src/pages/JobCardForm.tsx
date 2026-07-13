import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, X, Upload, Check, ArrowLeft, ArrowRight, Thermometer, Sparkles, Eraser } from "lucide-react";
import { toast } from "sonner";
import { generateJobCardPDF } from "@/lib/jobCardPdf";

const inputCls = "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1.5";
const POLISH_URL = "https://cgqmyqveqnvrmytmpbfh.supabase.co/functions/v1/polish-report";

const JOB_TYPES = [
  { value: "inspection", label: "Inspection" },
  { value: "repair", label: "Repair" },
  { value: "scheduled", label: "Service" },
  { value: "breakdown", label: "Breakdown" },
];

// Common fridge repair parts for quick selection
const FRIDGE_PARTS = [
  "Belt", "Compressor", "Solenoid valve", "Refrigerant gas (R404a)", "Refrigerant gas (R134a)",
  "Electric motor", "Fuel filter", "Air filter", "Oil filter", "Engine oil", "Compressor oil",
  "Thermostat sensor", "Control board", "Fan motor", "Fan blade", "Drier", "Expansion valve",
  "Contactor", "Relay", "Fuse", "Wiring harness", "Door seal", "Hose", "Pulley", "Bearing", "Other",
];
const ELECTRICAL_PARTS = [
  "Globe / Bulb", "Headlight", "Tail light", "Indicator", "Fuse", "Relay", "Wiring harness",
  "Battery", "Alternator", "Starter motor", "Solenoid", "Switch", "Sensor", "Connector",
  "Cable", "Terminal", "Earth strap", "Fuse box", "Control module", "Motor", "Other",
];
const GENERIC_PARTS = ["Fuse", "Relay", "Switch", "Cable", "Connector", "Filter", "Belt", "Bearing", "Seal", "Hose", "Other"];

function partsForIndustry(industry: string) {
  if (industry === "refrigeration") return FRIDGE_PARTS;
  if (industry === "electrical") return ELECTRICAL_PARTS;
  return GENERIC_PARTS;
}


type Part = { name: string; qty: string };

export default function JobCardForm() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Industry-aware labels so the job card speaks the client's language
  const industry = (profile as any)?.organisations?.industry || "transport";
  const isFridge = industry === "refrigeration";
  const L = {
    unitLabel: isFridge ? "Unit" : "Vehicle / Asset",
    unitLabelStar: isFridge ? "Fridge Unit *" : "Vehicle / Asset *",
    brandPlaceholder: isFridge ? "Fridge Brand" : "Make (e.g. Hino 500)",
    modelPlaceholder: isFridge ? "Fridge Model" : "Model",
    // metric fields
    showEngineHrs: isFridge,
    showStandbyHrs: isFridge,
    kmLabel: isFridge ? "Kilometres" : "Odometer (km)",
  };
  const COMMON_PARTS = partsForIndustry(industry);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [useOther, setUseOther] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [jcNumber, setJcNumber] = useState<string>("");

  // signature pad
  const sigCanvas = useRef<HTMLCanvasElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const drawing = useRef(false);

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

  const queryClient = useQueryClient();

  // All customers for this org (a real table now, not just distinct vehicle values),
  // so the tech can pick any customer and add new ones on the fly.
  const { data: customers } = useQuery({
    queryKey: ["jobcard_customers", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers" as any)
        .select("id, name")
        .eq("organisation_id", profile?.organisation_id)
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!profile?.organisation_id,
  });

  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [form, setForm] = useState({
    vehicle_id: "", other_reg: "", other_make: "", other_model: "",
    unit_make: "", unit_model: "",
    client_name: "", client_address: "", client_email: "", client_vat_no: "",
    contact_person: "", contact_cell: "", order_no: "",
    service_type: "scheduled", engine_hours: "", standby_hours: "", kilometres: "",
    client_instructions: "", work_done: "", tech_name: "",
    date_commenced: new Date().toISOString().split("T")[0], time_commenced: "",
    date_completed: new Date().toISOString().split("T")[0], time_completed: "",
    customer_sign_name: "",
  });
  const [noSignature, setNoSignature] = useState(false);

  const [parts, setParts] = useState<Part[]>([{ name: "", qty: "" }]);

  const selectedVehicle = (vehicles || []).find((v: any) => v.id === form.vehicle_id);
  const customerList = (customers || []).map(c => c.name);

  const addCustomer = async () => {
    const name = newCustomerName.trim();
    if (!name) { toast.error("Enter a customer name"); return; }
    if (customerList.some(c => c.toLowerCase() === name.toLowerCase())) {
      toast.error("That customer already exists");
      return;
    }
    setSavingCustomer(true);
    const { error } = await supabase.from("customers" as any).insert({
      organisation_id: profile?.organisation_id, name,
    });
    setSavingCustomer(false);
    if (error) { toast.error(error.message || "Could not add customer"); return; }
    await queryClient.invalidateQueries({ queryKey: ["jobcard_customers"] });
    setSelectedCustomer(name);
    setForm(f => ({ ...f, client_name: name, vehicle_id: "" }));
    setUseOther(false);
    setAddingCustomer(false);
    setNewCustomerName("");
    toast.success("Customer added ✓");
  };

  // Auto-fill tech name from the logged-in account
  useEffect(() => {
    if (profile && !form.tech_name) {
      const name = (profile as any).full_name || (profile as any).email?.split("@")[0] || "";
      if (name) setForm(f => ({ ...f, tech_name: name }));
    }
  }, [profile]);

  // Get an auto job card number on mount
  useEffect(() => {
    (async () => {
      if (!profile?.organisation_id) return;
      const { data, error } = await supabase.rpc("next_job_card_number", { org: profile.organisation_id });
      if (!error && data) setJcNumber(String(data));
    })();
  }, [profile?.organisation_id]);

  // Auto-fill customer + hours when a vehicle is picked (always overwrite from the unit)
  useEffect(() => {
    if (selectedVehicle) {
      setForm(f => ({
        ...f,
        client_name: selectedVehicle.customer_name || "",
        unit_make: selectedVehicle.fridge_brand || "",
        unit_model: selectedVehicle.fridge_model || "",
        engine_hours: f.engine_hours || String(selectedVehicle.fridge_current_hrs || ""),
      }));
    }
  }, [form.vehicle_id]);

  // ---- signature pad handlers ----
  const getPos = (e: any) => {
    const c = sigCanvas.current!;
    const rect = c.getBoundingClientRect();
    const touch = e.touches?.[0];
    const x = (touch ? touch.clientX : e.clientX) - rect.left;
    const y = (touch ? touch.clientY : e.clientY) - rect.top;
    return { x: x * (c.width / rect.width), y: y * (c.height / rect.height) };
  };
  const startDraw = (e: any) => { e.preventDefault(); drawing.current = true; const ctx = sigCanvas.current!.getContext("2d")!; const { x, y } = getPos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  const moveDraw = (e: any) => { if (!drawing.current) return; e.preventDefault(); const ctx = sigCanvas.current!.getContext("2d")!; const { x, y } = getPos(e); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#0a0e1a"; ctx.lineTo(x, y); ctx.stroke(); setHasSignature(true); };
  const endDraw = () => { drawing.current = false; };
  const clearSig = () => { const c = sigCanvas.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHasSignature(false); };

  const updatePart = (i: number, field: keyof Part, val: string) => setParts(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  const addPart = () => setParts(p => [...p, { name: "", qty: "" }]);
  const removePart = (i: number) => setParts(p => p.filter((_, idx) => idx !== i));

  const polishNotes = async () => {
    if (!form.work_done.trim()) { toast.error("Write some notes first"); return; }
    setPolishing(true);
    try {
      const res = await fetch(POLISH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: form.work_done }) });
      const data = await res.json();
      if (data.polished) { setForm(f => ({ ...f, work_done: data.polished })); toast.success("Report polished ✓"); }
      else toast.error("Could not polish — keeping your text");
    } catch { toast.error("Polish unavailable right now"); }
    setPolishing(false);
  };

  const handleSubmit = async () => {
    if (!useOther && !form.vehicle_id) { toast.error("Select a vehicle"); setStep(1); return; }
    if (useOther && !form.other_reg) { toast.error("Enter the new unit's reg"); setStep(1); return; }
    if (!form.work_done) { toast.error("Fill in the technician report"); setStep(1); return; }
    setSaving(true);
    try {
      const reg = useOther ? form.other_reg : (selectedVehicle?.registration_number || "unit");

      // If "Other", create the vehicle first so the job card links to a real unit
      let vehicleId = form.vehicle_id;
      if (useOther) {
        const { data: newV, error: vErr } = await supabase.from("vehicles").insert({
          organisation_id: profile?.organisation_id,
          registration_number: form.other_reg,
          fridge_brand: form.unit_make || null,
          fridge_model: form.unit_model || null,
          customer_name: form.client_name || null,
          is_active: true,
          vehicle_type: "trailer",
        }).select("id").single();
        if (vErr) throw vErr;
        vehicleId = newV.id;
      }

      // signature image
      let signatureData: string | null = null;
      if (hasSignature && sigCanvas.current && !noSignature) signatureData = sigCanvas.current.toDataURL("image/png");

      // Upload photos
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const ext = photo.name.split(".").pop();
        const path = `${reg}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("job-card-photos").upload(path, photo, { upsert: true });
        if (!upErr) { const { data } = supabase.storage.from("job-card-photos").getPublicUrl(path); photoUrls.push(data.publicUrl); }
      }

      const hrs = parseFloat(form.engine_hours) || null;
      const isScheduled = form.service_type === "scheduled";
      const interval = selectedVehicle?.fridge_service_interval_hrs || 1000;
      const cleanParts = parts
        .filter(p => (p.name || "").trim())
        .map(p => ({ name: p.name.trim(), qty: (p.qty || "").trim() }));

      // Logged-in company branding for the PDF header (read per-org, never hardcoded)
      const org = (profile as any)?.organisations || {};

      // Generate the job card PDF (single copy — parts have no pricing, so no separate office costing copy)
      let pdfUrl: string | null = null;
      try {
        const pdfData = {
          jobCardNumber: jcNumber,
          orgName: org.name || "", orgPhone: org.phone || "", orgEmail: org.email || "",
          orgVat: org.vat_number || "", orgAddress: org.address || "", orgLogoUrl: org.logo_url || null,
          industry: org.industry || industry,
          clientName: form.client_name, orderNo: form.order_no,
          clientAddress: form.client_address, clientEmail: form.client_email, clientVatNo: form.client_vat_no,
          contactPerson: form.contact_person, contactCell: form.contact_cell,
          registration: reg, make: form.unit_make || "", model: form.unit_model || "",
          unitSerial: selectedVehicle?.fridge_serial_number || "", jobType: form.service_type,
          engineHours: form.engine_hours, standbyHours: form.standby_hours, kilometres: form.kilometres,
          clientInstructions: form.client_instructions, technicianReport: form.work_done, technicianName: form.tech_name,
          dateCommenced: form.date_commenced, timeCommenced: form.time_commenced, dateCompleted: form.date_completed, timeCompleted: form.time_completed,
          parts: cleanParts, photos: photoUrls,
          signature: signatureData, signName: form.customer_sign_name, noSignature,
        };
        const blob = await generateJobCardPDF(pdfData);
        const pdfPath = `${reg}/${Date.now()}_jobcard.pdf`;
        const { error: pErr } = await supabase.storage.from("job-cards").upload(pdfPath, blob, { upsert: true, contentType: "application/pdf" });
        if (!pErr) { const { data } = supabase.storage.from("job-cards").getPublicUrl(pdfPath); pdfUrl = data.publicUrl; }
      } catch (e) { console.error("PDF gen failed:", e); }

      const { error } = await supabase.from("fridge_service_log" as any).insert({
        organisation_id: profile?.organisation_id, vehicle_id: vehicleId,
        service_date: form.date_completed || new Date().toISOString().split("T")[0],
        hours_at_service: hrs, service_type: form.service_type, work_done: form.work_done,
        tech_name: form.tech_name || null, job_card_number: jcNumber || null,
        client_name: form.client_name || null, client_address: form.client_address || null,
        client_email: form.client_email || null, client_vat_no: form.client_vat_no || null,
        contact_person: form.contact_person || null, contact_cell: form.contact_cell || null,
        order_no: form.order_no || null, engine_hours: hrs, standby_hours: parseFloat(form.standby_hours) || null,
        kilometres: parseFloat(form.kilometres) || null, client_instructions: form.client_instructions || null,
        date_commenced: form.date_commenced || null, time_commenced: form.time_commenced || null,
        date_completed: form.date_completed || null, time_completed: form.time_completed || null,
        unit_serial: selectedVehicle?.fridge_serial_number || null, parts_list: cleanParts, costing: null,
        photos: photoUrls, pdf_url: pdfUrl, customer_pdf_url: pdfUrl, job_card_url: pdfUrl, total_cost: null,
        parts_used: cleanParts.map(p => (p.qty ? `${p.qty} × ${p.name}` : p.name)).join(", ") || null,
        customer_signature: signatureData, customer_sign_name: form.customer_sign_name || null,
        no_customer_signature: noSignature, status: "submitted", logged_via: "tech_app", updates_service_clock: isScheduled,
      });
      if (error) throw error;

      if (hrs && !useOther) {
        const update: any = { fridge_current_hrs: hrs, fridge_hours_updated_at: new Date().toISOString() };
        if (isScheduled) { update.fridge_last_service_hrs = hrs; update.fridge_last_service_date = form.date_completed || new Date().toISOString().split("T")[0]; update.fridge_next_service_hrs = hrs + interval; }
        await supabase.from("vehicles").update(update).eq("id", vehicleId);
      }

      setSaving(false);
      toast.success("Job card submitted ✓");
      // Open the job card so the tech can share it with the customer
      if (pdfUrl) window.open(pdfUrl, "_blank");
      navigate((profile as any)?.role === "technician" ? "/tech" : "/fridge-tracker");
    } catch (e: any) {
      setSaving(false);
      toast.error(e.message || "Failed to submit job card");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground flex items-center gap-2"><Thermometer className="w-4 h-4 text-primary" /> Job Card {jcNumber && <span className="text-xs text-muted-foreground">#{jcNumber}</span>}</h1>
          <p className="text-xs text-muted-foreground">Step {step} of 2 · {step === 1 ? "Job Details" : "Sign & Submit"}</p>
        </div>
      </div>
      <div className="h-1 bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${(step / 2) * 100}%` }} /></div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {step === 1 && (
          <>
            <div>
              <label className={labelCls}>Customer</label>
              <select value={selectedCustomer} onChange={e => {
                if (e.target.value === "__add__") { setAddingCustomer(true); return; }
                setSelectedCustomer(e.target.value);
                setUseOther(false);
                setForm({ ...form, vehicle_id: "", client_name: e.target.value });
              }} className={inputCls}>
                <option value="">Select the customer...</option>
                {customerList.map((c: string) => <option key={c} value={c}>{c}</option>)}
                <option value="__add__">+ Add new customer</option>
              </select>
              {addingCustomer && (
                <div className="border border-primary/30 rounded-xl p-3 space-y-2 bg-primary/5 mt-2">
                  <input value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="New customer name" className={inputCls} autoFocus />
                  <div className="flex gap-2">
                    <button type="button" onClick={addCustomer} disabled={savingCustomer} className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50">
                      {savingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save customer
                    </button>
                    <button type="button" onClick={() => { setAddingCustomer(false); setNewCustomerName(""); }} className="px-3 py-2 rounded-xl text-sm text-muted-foreground border border-border">Cancel</button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>{L.unitLabelStar}</label>
              <select value={useOther ? "__other__" : form.vehicle_id} disabled={!selectedCustomer && !useOther} onChange={e => { if (e.target.value === "__other__") { setUseOther(true); setForm({ ...form, vehicle_id: "" }); } else { setUseOther(false); setForm({ ...form, vehicle_id: e.target.value }); } }} className={inputCls}>
                <option value="">{!selectedCustomer ? "Select a customer first..." : (isFridge ? "Select the unit..." : "Select the vehicle...")}</option>
                {(vehicles || []).filter((v: any) => v.customer_name === selectedCustomer).map((v: any) => <option key={v.id} value={v.id}>{v.registration_number}{(v.fridge_brand || v.fridge_model) ? ` — ${v.fridge_brand || ""} ${v.fridge_model || ""}` : ""}</option>)}
                <option value="__other__">{isFridge ? "+ Other / New unit" : "+ Other / New vehicle"}</option>
              </select>
            </div>
            {useOther && (
              <div className="border border-primary/30 rounded-xl p-3 space-y-3 bg-primary/5">
                <p className="text-xs text-muted-foreground">New unit — it'll be added to the fleet.</p>
                <input value={form.other_reg} onChange={e => setForm({ ...form, other_reg: e.target.value.toUpperCase() })} placeholder="Registration *" className={inputCls} />
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.unit_make} onChange={e => setForm({ ...form, unit_make: e.target.value })} placeholder={L.brandPlaceholder} className={inputCls} />
                  <input value={form.unit_model} onChange={e => setForm({ ...form, unit_model: e.target.value })} placeholder={L.modelPlaceholder} className={inputCls} />
                </div>
              </div>
            )}

            {form.vehicle_id && !useOther && (
              <div className="border border-border rounded-xl p-3 space-y-3">
                <label className={labelCls}>{isFridge ? "Fridge Unit — Make & Model *" : "Make & Model"}</label>
                <p className="text-xs text-muted-foreground">Enter the {isFridge ? "fridge unit" : "unit"} make and model on this registration — edit if it's changed.</p>
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.unit_make} onChange={e => setForm({ ...form, unit_make: e.target.value })} placeholder={L.brandPlaceholder} className={inputCls} />
                  <input value={form.unit_model} onChange={e => setForm({ ...form, unit_model: e.target.value })} placeholder={L.modelPlaceholder} className={inputCls} />
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>Customer / Client</label>
              <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Customer name" className={inputCls} />
            </div>

            <details className="border border-border rounded-xl p-3">
              <summary className="text-sm font-medium text-foreground cursor-pointer">More client details (optional)</summary>
              <div className="space-y-3 mt-3">
                <input value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} placeholder="Address" className={inputCls} />
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} placeholder="Email" className={inputCls} />
                  <input value={form.client_vat_no} onChange={e => setForm({ ...form, client_vat_no: e.target.value })} placeholder="VAT No." className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Contact Person" className={inputCls} />
                  <input value={form.contact_cell} onChange={e => setForm({ ...form, contact_cell: e.target.value })} placeholder="Cell No." className={inputCls} />
                </div>
                <input value={form.order_no} onChange={e => setForm({ ...form, order_no: e.target.value })} placeholder="Order No. (optional)" className={inputCls} />
              </div>
            </details>

            <div>
              <label className={labelCls}>Job Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {JOB_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setForm({ ...form, service_type: t.value })} className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.service_type === t.value ? "border-primary bg-primary/10 text-foreground" : "border-border bg-secondary/30 text-muted-foreground"}`}>{t.label}</button>
                ))}
              </div>
            </div>

            <div className={isFridge ? "grid grid-cols-3 gap-3" : "grid grid-cols-1 gap-3"}>
              {L.showEngineHrs && <div><label className={labelCls}>Engine Hrs</label><input type="number" inputMode="decimal" value={form.engine_hours} onChange={e => setForm({ ...form, engine_hours: e.target.value })} placeholder="hrs" className={inputCls} /></div>}
              {L.showStandbyHrs && <div><label className={labelCls}>Standby Hrs</label><input type="number" inputMode="decimal" value={form.standby_hours} onChange={e => setForm({ ...form, standby_hours: e.target.value })} className={inputCls} /></div>}
              <div><label className={labelCls}>{L.kmLabel}</label><input type="number" inputMode="decimal" value={form.kilometres} onChange={e => setForm({ ...form, kilometres: e.target.value })} placeholder="km" className={inputCls} /></div>
            </div>

            <div><label className={labelCls}>Client's Instructions</label><textarea value={form.client_instructions} onChange={e => setForm({ ...form, client_instructions: e.target.value })} rows={2} placeholder="What did the client ask for?" className={inputCls} /></div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Technician Report *</label>
                <button type="button" onClick={polishNotes} disabled={polishing} className="flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-50">
                  {polishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Polish with AI
                </button>
              </div>
              <textarea value={form.work_done} onChange={e => setForm({ ...form, work_done: e.target.value })} rows={5} placeholder="Describe the work done. Type rough notes then tap Polish." className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Photos</label>
              <div className={`${inputCls} flex items-center gap-2 cursor-pointer`} onClick={() => document.getElementById("photo-upload")?.click()}>
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">{photos.length > 0 ? `${photos.length} photo(s) — tap to add more` : "Add photos of the job"}</span>
              </div>
              <input id="photo-upload" type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => { setPhotos([...photos, ...Array.from(e.target.files || [])]); (e.target as HTMLInputElement).value = ""; }} />
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

            <div>
              <h2 className="text-sm font-bold text-foreground mb-2">Parts Used</h2>
              <p className="text-xs text-muted-foreground mb-2">Just the part and how many — no pricing needed.</p>
              <div className="space-y-3">
                {parts.map((p, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0 space-y-2">
                      <select value={COMMON_PARTS.includes(p.name) ? p.name : (p.name ? "Other" : "")} onChange={e => updatePart(i, "name", e.target.value === "Other" ? "" : e.target.value)} className={inputCls}>
                        <option value="">Select part...</option>
                        {COMMON_PARTS.map(cp => <option key={cp} value={cp}>{cp}</option>)}
                      </select>
                      {(!COMMON_PARTS.includes(p.name) || p.name === "") && (
                        <input value={p.name} onChange={e => updatePart(i, "name", e.target.value)} placeholder="Part name" className={inputCls} />
                      )}
                    </div>
                    <input value={p.qty} onChange={e => updatePart(i, "qty", e.target.value)} placeholder="Qty" type="number" inputMode="decimal" className="w-20 shrink-0 bg-secondary border border-border rounded-xl px-3 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                    {parts.length > 1 && <button onClick={() => removePart(i)} className="text-muted-foreground pt-3 shrink-0"><X className="w-4 h-4" /></button>}
                  </div>
                ))}
                <button onClick={addPart} className="flex items-center gap-1.5 text-sm text-primary font-semibold"><Plus className="w-4 h-4" /> Add another part</button>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <Row label="Job Card No." value={`#${jcNumber}`} />
              <Row label="Unit" value={useOther ? form.other_reg : (selectedVehicle ? `${selectedVehicle.registration_number}` : "—")} />
              <Row label="Customer" value={form.client_name || "—"} />
              <Row label="Job Type" value={JOB_TYPES.find(t => t.value === form.service_type)?.label || form.service_type} />
              <Row label="Technician" value={form.tech_name || "—"} />
              <Row label="Photos" value={`${photos.length} attached`} />
              <Row label="Parts" value={`${parts.filter(p => (p.name || "").trim()).length} item(s)`} />
            </div>

            <div>
              <label className={labelCls}>Customer Signature</label>
              {!noSignature ? (
                <>
                  <div className="border-2 border-dashed border-border rounded-xl bg-white">
                    <canvas ref={sigCanvas} width={320} height={140} className="w-full touch-none rounded-xl"
                      onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button onClick={clearSig} className="flex items-center gap-1 text-xs text-muted-foreground"><Eraser className="w-3.5 h-3.5" /> Clear</button>
                    <input value={form.customer_sign_name} onChange={e => setForm({ ...form, customer_sign_name: e.target.value })} placeholder="Name of signer" className="text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground w-1/2" />
                  </div>
                </>
              ) : (
                <div className="bg-secondary/40 rounded-xl p-4 text-center text-sm text-muted-foreground">No customer available to sign — noted on the job card.</div>
              )}
              <label className="flex items-center gap-2 mt-3 text-sm text-foreground">
                <input type="checkbox" checked={noSignature} onChange={e => { setNoSignature(e.target.checked); if (e.target.checked) clearSig(); }} className="w-4 h-4" />
                No customer available to sign
              </label>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
              <p className="text-sm text-foreground">On submit, the PDF job card is generated, the office gets it instantly, and it opens so you can share it with the customer.</p>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 flex gap-3 max-w-lg mx-auto">
        {step < 2 ? (
          <button onClick={() => { if (step === 1 && !useOther && !form.vehicle_id) { toast.error("Select a vehicle first"); return; } if (step === 1 && useOther && !form.other_reg) { toast.error("Enter the unit reg"); return; } if (step === 1 && isFridge && (form.vehicle_id || useOther) && !form.unit_make.trim()) { toast.error("Enter the fridge unit make"); return; } setStep(step + 1); }} className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2">Next <ArrowRight className="w-4 h-4" /></button>
        ) : (
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Submit Job Card</button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="text-foreground font-medium text-right">{value}</span></div>;
}
