import { Search, Plus, Download, Loader2, X, Gauge, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVehicles, useCertificates } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { recalculateAllVehicleCompliance, calculateVehicleComplianceScore } from "@/lib/compliance";
import { EquipmentChecklist } from "@/components/vehicle/EquipmentChecklist";
import { BranchFilter } from "@/components/filters/BranchFilter";
import { UpdateKMDialog } from "@/components/vehicle/UpdateKMDialog";
import { useQuery } from "@tanstack/react-query";
import { computeTrackerStatus } from "@/lib/serviceTrackers";

const statusStyles: Record<string, string> = {
  compliant: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  critical: "bg-destructive/20 text-destructive",
  expired: "bg-destructive/30 text-destructive",
};



export default function Vehicles() {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [updateKmFor, setUpdateKmFor] = useState<{ id: string; reg: string; km: number } | null>(null);
  const { profile } = useAuth();
  const isFridgeOnly = (profile as any)?.organisations?.module_type === "fridge_only";
  const { data: vehicles, isLoading } = useVehicles();
  const { data: allCerts } = useCertificates();
  const { data: allTrackers } = useQuery({
    queryKey: ["all_service_trackers", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_service_trackers" as any).select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organisation_id,
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter"); // 'critical', 'warning', 'expired'

  const handleDeleteVehicle = async (e: React.MouseEvent, id: string, reg: string) => {
    e.stopPropagation();
    if (!confirm(`Delete vehicle ${reg}? This removes it and all its records permanently.`)) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${reg} deleted`);
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };

  useEffect(() => {
    recalculateAllVehicleCompliance().then(() => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    });
  }, []);

  const filtered = (vehicles || []).filter(
    (v) =>
      (v.registration_number.toLowerCase().includes(search.toLowerCase()) ||
      (v.fleet_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.make || "").toLowerCase().includes(search.toLowerCase())) &&
      (!branchFilter || v.branch_id === branchFilter) &&
      (!urlFilter || v.compliance_status === urlFilter || (urlFilter === "non-compliant" && v.compliance_status !== "compliant"))
  ).sort((a, b) => {
    const numA = parseInt(a.fleet_number || "0", 10) || 0;
    const numB = parseInt(b.fleet_number || "0", 10) || 0;
    return numA - numB;
  });

  const [form, setForm] = useState({
    registration_number: "", fleet_number: "", make: "", model: "",
    year: "", vehicle_type: "horse", vin_number: "", colour: "",
    current_odometer_km: "", next_service_due_km: "",
  });
  const [equipment, setEquipment] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const regNum = form.registration_number.trim();
    if (!regNum) {
      toast.error("Registration number is required");
      return;
    }
    if (!profile?.organisation_id) {
      toast.error("Organisation not found. Please log out and log in again.");
      return;
    }
    setSaving(true);
    const kmNow = parseInt(form.current_odometer_km) || 0;
    const kmNext = parseInt(form.next_service_due_km) || 0;
    const { error } = await supabase.from("vehicles").insert({
      organisation_id: profile.organisation_id,
      registration_number: regNum,
      fleet_number: form.fleet_number || null,
      make: form.make || null,
      model: form.model || null,
      year: form.year ? parseInt(form.year) : null,
      vehicle_type: form.vehicle_type,
      vin_number: form.vin_number || null,
      colour: form.colour || null,
      current_odometer_km: kmNow,
      next_service_due_km: kmNext,
      equipment: equipment,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Vehicle added successfully");
      setShowForm(false);
      setForm({ registration_number: "", fleet_number: "", make: "", model: "", year: "", vehicle_type: "horse", vin_number: "", colour: "", current_odometer_km: "", next_service_due_km: "" });
      setEquipment([]);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    }
  };

  const handleExport = () => {
    const vList = filtered;
    if (vList.length === 0) { toast.error("No vehicles to export"); return; }
    let csv = "Fleet Number,Registration,Make,Model,Year,Current KM,KM Until Service,Compliance Status,Risk Score\n";
    vList.forEach(v => {
      csv += `"${v.fleet_number || ""}","${v.registration_number}","${v.make || ""}","${v.model || ""}",${v.year || ""},${v.current_odometer_km ?? 0},${v.km_until_service ?? 0},"${v.compliance_status || "compliant"}",${v.risk_score ?? 0}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fleet_vehicles_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Vehicles exported");
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Vehicles</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} vehicles in fleet</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowForm(true)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by reg, fleet no, or make..." className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <BranchFilter value={branchFilter} onChange={setBranchFilter} />
      </div>

      {isLoading ? (
        <div className="glass-card flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-card text-center py-12 text-muted-foreground text-sm">No vehicles found. Add your first vehicle to get started.</div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filtered.map((v) => {
              const vehicleCerts = (allCerts || []).filter(c => c.vehicle_id === v.id);
              const compliance = calculateVehicleComplianceScore(
                v as any,
                vehicleCerts.map(c => ({ certificate_type: c.certificate_type, vehicle_id: c.vehicle_id, expiry_date: c.expiry_date, status: c.status })),
                [],
                ((allTrackers || []) as any[]).filter(t => t.vehicle_id === v.id),
              );
              const trackerWarning = ((allTrackers || []) as any[]).filter(t => t.vehicle_id === v.id).some(t => computeTrackerStatus(t, v.current_odometer_km ?? 0).status !== "ok");
              const kmUntil = compliance.km_until_service;
              const now = new Date();
              const lastUpdate = (v as any).km_last_updated_at ? new Date((v as any).km_last_updated_at) : (v.last_odometer_update ? new Date(v.last_odometer_update) : null);
              const daysSinceUpdate = lastUpdate ? Math.floor((now.getTime() - lastUpdate.getTime()) / 86400000) : null;
              const updateBadge = daysSinceUpdate === null
                ? { text: "Never updated", cls: "bg-destructive/20 text-destructive" }
                : daysSinceUpdate >= 14
                ? { text: `${daysSinceUpdate}d ago`, cls: "bg-destructive/20 text-destructive" }
                : daysSinceUpdate >= 7
                ? { text: `${daysSinceUpdate}d ago`, cls: "bg-warning/20 text-warning" }
                : { text: daysSinceUpdate === 0 ? "Today" : `${daysSinceUpdate}d ago`, cls: "bg-success/20 text-success" };
              const scoreColor = compliance.score >= 80 ? "text-success" : compliance.score >= 50 ? "text-warning" : "text-destructive";
              return (
                <div key={v.id} onClick={() => navigate(`/vehicles/${v.id}`)} className="glass-card p-4 active:bg-secondary/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-foreground">{v.registration_number}</p>
                      <p className="text-xs text-muted-foreground font-mono">{v.fleet_number || "-"} · {v.make} {v.model}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block ${
                        (v as any).vehicle_type === "horse" ? "bg-primary/20 text-primary" :
                        (v as any).vehicle_type === "trailer" ? "bg-warning/20 text-warning" :
                        (v as any).vehicle_type === "reefer" ? "bg-success/20 text-success" :
                        "bg-secondary text-muted-foreground"
                      }`}>
                        {(v as any).vehicle_type === "horse" ? "🚛 Horse" :
                         (v as any).vehicle_type === "trailer" ? "🔗 Trailer" :
                         (v as any).vehicle_type === "rigid" ? "🚚 Rigid" :
                         (v as any).vehicle_type === "reefer" ? "❄️ Reefer" :
                         (v as any).vehicle_type || "Vehicle"}
                      </span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase whitespace-nowrap ${statusStyles[compliance.status]}`}>
                      {compliance.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs my-3">
                    <div>
                      <p className="text-muted-foreground">KM Left</p>
                      <p className={`font-mono font-semibold ${kmUntil < 0 ? "text-destructive" : kmUntil < 2000 ? "text-warning" : "text-foreground"}`}>
                        {kmUntil.toLocaleString()}
                      </p>
                      {trackerWarning && <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded">Tracker warning</span>}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Score</p>
                      <p className={`font-mono font-bold ${scoreColor}`}>{compliance.score}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Updated</p>
                      <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${updateBadge.cls}`}>{updateBadge.text}</span>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setUpdateKmFor({ id: v.id, reg: v.registration_number, km: v.current_odometer_km ?? 0 })}
                      className="w-full inline-flex items-center justify-center gap-1.5 text-xs bg-secondary hover:bg-secondary/80 text-foreground px-3 py-2 rounded-md"
                    >
                      <Gauge className="w-3.5 h-3.5" /> Update KM
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block glass-card overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fleet No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reg No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Make & Model</th>
                  {isFridgeOnly ? (
                    <>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fridge Unit</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </>
                  ) : (
                    <>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">KM Until Service</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">KM Updated</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const vehicleCerts = (allCerts || []).filter(c => c.vehicle_id === v.id);
                  const compliance = calculateVehicleComplianceScore(
                    v as any,
                    vehicleCerts.map(c => ({ certificate_type: c.certificate_type, vehicle_id: c.vehicle_id, expiry_date: c.expiry_date, status: c.status })),
                    [],
                    ((allTrackers || []) as any[]).filter(t => t.vehicle_id === v.id),
                  );
                  const trackerWarning = ((allTrackers || []) as any[]).filter(t => t.vehicle_id === v.id).some(t => computeTrackerStatus(t, v.current_odometer_km ?? 0).status !== "ok");
                  const kmUntil = compliance.km_until_service;
                  const now = new Date();
                  // Use km_last_updated_at (set on every KM save) so badge reflects only KM updates
                  const lastUpdate = (v as any).km_last_updated_at ? new Date((v as any).km_last_updated_at) : (v.last_odometer_update ? new Date(v.last_odometer_update) : null);
                  const daysSinceUpdate = lastUpdate ? Math.floor((now.getTime() - lastUpdate.getTime()) / 86400000) : null;
                  const updateBadge = daysSinceUpdate === null
                    ? { text: "Never updated", cls: "bg-destructive/20 text-destructive" }
                    : daysSinceUpdate >= 14
                    ? { text: `Update KM — ${daysSinceUpdate}d ago`, cls: "bg-destructive/20 text-destructive" }
                    : daysSinceUpdate >= 7
                    ? { text: `Updated ${daysSinceUpdate}d ago`, cls: "bg-warning/20 text-warning" }
                    : { text: daysSinceUpdate === 0 ? "Updated today" : `Updated ${daysSinceUpdate}d ago`, cls: "bg-success/20 text-success" };
                  const scoreColor = compliance.score >= 80 ? "text-success" : compliance.score >= 50 ? "text-warning" : "text-destructive";

                  return (
                    <tr key={v.id} onClick={() => navigate(`/vehicles/${v.id}`)} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{v.fleet_number || "-"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {v.registration_number}
                          {!isFridgeOnly && !v.vin_number && <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">Incomplete</span>}
                          {!isFridgeOnly && kmUntil < 0 && <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">Service Overdue</span>}
                          {!isFridgeOnly && trackerWarning && <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">Tracker Warning</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{v.make} {v.model}</td>
                      {isFridgeOnly ? (
                        <>
                          <td className="px-4 py-3 text-sm text-foreground">{(v as any).customer_name || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{(v as any).fridge_brand ? `${(v as any).fridge_brand} ${(v as any).fridge_model || ""}` : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3 text-center text-sm text-muted-foreground capitalize">{(v as any).vehicle_type || "—"}</td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => handleDeleteVehicle(e, v.id, v.registration_number)} className="text-muted-foreground hover:text-destructive" title="Delete vehicle">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={`px-4 py-3 text-sm text-right font-mono ${kmUntil < 0 ? "text-destructive" : kmUntil < 2000 ? "text-warning" : "text-foreground"}`}>
                            {kmUntil.toLocaleString()} km
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${updateBadge.cls}`}>{updateBadge.text}</span>
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-mono font-bold ${scoreColor}`}>{compliance.score}%</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${statusStyles[compliance.status]}`}>
                              {compliance.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setUpdateKmFor({ id: v.id, reg: v.registration_number, km: v.current_odometer_km ?? 0 })}
                                className="inline-flex items-center gap-1 text-xs bg-secondary hover:bg-secondary/80 text-foreground px-2.5 py-1 rounded-md"
                                title="Update KM"
                              >
                                <Gauge className="w-3.5 h-3.5" /> Update KM
                              </button>
                              <button onClick={(e) => handleDeleteVehicle(e, v.id, v.registration_number)} className="text-muted-foreground hover:text-destructive" title="Delete vehicle">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {updateKmFor && (
        <UpdateKMDialog
          vehicleId={updateKmFor.id}
          organisationId={profile?.organisation_id ?? null}
          currentKm={updateKmFor.km}
          registration={updateKmFor.reg}
          onClose={() => setUpdateKmFor(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["vehicles"] });
          }}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row">
          <div className="hidden md:block flex-1 bg-background/50" onClick={() => setShowForm(false)} />
          <div className="w-full md:w-[450px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen">
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
              <label className="block text-sm font-medium text-foreground mb-1">Vehicle Type *</label>
              <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="horse">🚛 Horse — Prime mover that pulls a trailer</option>
                <option value="trailer">🔗 Trailer — Pulled by a horse (Serco, Afrit, CTS etc)</option>
                <option value="rigid">🚚 Rigid Truck — Fixed body, no separate trailer (Hino 500, Isuzu)</option>
                <option value="reefer">❄️ Reefer — Refrigerated trailer or rigid</option>
                <option value="tipper">🪣 Tipper — Tipper truck or trailer</option>
                <option value="tanker">🛢️ Tanker</option>
                <option value="crane">🏗️ Crane / Crane truck</option>
                <option value="bakkie">🚐 Bakkie / Light vehicle</option>
                <option value="bus">🚌 Bus / Minibus</option>
                <option value="other">⚙️ Other</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {form.vehicle_type === "horse" && "This vehicle can be paired with a trailer in Fleet Availability"}
                {form.vehicle_type === "trailer" && "This vehicle will appear in the trailer pairing dropdown for horses"}
                {form.vehicle_type === "rigid" && "Fixed body truck — no trailer pairing needed"}
                {form.vehicle_type === "reefer" && "Refrigerated unit — tracked separately for fridge service intervals"}
              </p>
            </div>

            <EquipmentChecklist selected={equipment} onChange={setEquipment} />

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
