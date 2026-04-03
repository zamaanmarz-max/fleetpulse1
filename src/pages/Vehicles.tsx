import { Search, Filter, Plus, Download, Upload, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useVehicles } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const statusStyles: Record<string, string> = {
  compliant: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  critical: "bg-destructive/20 text-destructive",
  expired: "bg-destructive/30 text-destructive",
};

function riskColor(score: number) {
  if (score <= 25) return "text-success";
  if (score <= 50) return "text-warning";
  if (score <= 75) return "text-destructive";
  return "text-destructive font-bold";
}

export default function Vehicles() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { data: vehicles, isLoading } = useVehicles();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const filtered = (vehicles || []).filter(
    (v) =>
      v.registration_number.toLowerCase().includes(search.toLowerCase()) ||
      (v.fleet_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.make || "").toLowerCase().includes(search.toLowerCase())
  );

  const [form, setForm] = useState({
    registration_number: "", fleet_number: "", make: "", model: "",
    year: "", vehicle_type: "truck", vin_number: "", colour: "",
    current_odometer_km: "", next_service_due_km: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.registration_number || !profile?.organisation_id) {
      toast.error("Registration number is required");
      return;
    }
    setSaving(true);
    const kmNow = parseInt(form.current_odometer_km) || 0;
    const kmNext = parseInt(form.next_service_due_km) || 0;
    const { error } = await supabase.from("vehicles").insert({
      organisation_id: profile.organisation_id,
      registration_number: form.registration_number,
      fleet_number: form.fleet_number || null,
      make: form.make || null,
      model: form.model || null,
      year: form.year ? parseInt(form.year) : null,
      vehicle_type: form.vehicle_type,
      vin_number: form.vin_number || null,
      colour: form.colour || null,
      current_odometer_km: kmNow,
      next_service_due_km: kmNext,
      km_until_service: kmNext - kmNow,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Vehicle added successfully");
      setShowForm(false);
      setForm({ registration_number: "", fleet_number: "", make: "", model: "", year: "", vehicle_type: "truck", vin_number: "", colour: "", current_odometer_km: "", next_service_due_km: "" });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vehicles</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} vehicles in fleet</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by reg, fleet no, or make..." className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No vehicles found. Add your first vehicle to get started.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fleet No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reg No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Make & Model</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">KM Until Service</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Score</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-foreground">{v.fleet_number || "-"}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{v.registration_number}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{v.make} {v.model}</td>
                  <td className={`px-4 py-3 text-sm text-right font-mono ${(v.km_until_service ?? 0) < 0 ? "text-destructive" : (v.km_until_service ?? 0) < 1000 ? "text-warning" : "text-foreground"}`}>
                    {(v.km_until_service ?? 0).toLocaleString()} km
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-mono ${riskColor(v.risk_score ?? 0)}`}>{v.risk_score ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${statusStyles[v.compliance_status || "compliant"]}`}>
                      {v.compliance_status || "compliant"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Vehicle Side Panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/50" onClick={() => setShowForm(false)} />
          <div className="w-[450px] bg-card border-l border-border p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Add Vehicle</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {[
              { key: "registration_number", label: "Registration Number *", placeholder: "GP 123-456" },
              { key: "fleet_number", label: "Fleet Number", placeholder: "FP-001" },
              { key: "make", label: "Make", placeholder: "Toyota" },
              { key: "model", label: "Model", placeholder: "Hilux" },
              { key: "year", label: "Year", placeholder: "2024", type: "number" },
              { key: "vin_number", label: "VIN Number", placeholder: "" },
              { key: "colour", label: "Colour", placeholder: "White" },
              { key: "current_odometer_km", label: "Current Odometer (km)", placeholder: "0", type: "number" },
              { key: "next_service_due_km", label: "Next Service Due (km)", placeholder: "10000", type: "number" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                <input
                  type={f.type || "text"}
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Vehicle Type</label>
              <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {["truck", "trailer", "bakkie", "bus", "tanker", "crane", "other"].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save Vehicle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
