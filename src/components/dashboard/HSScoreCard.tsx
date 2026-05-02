import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HardHat, ChevronDown, ChevronUp } from "lucide-react";

export function HSScoreCard() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["hs_score", profile?.organisation_id],
    enabled: !!profile?.organisation_id,
    queryFn: async () => {
      const [d, dd, t, v, i, dam] = await Promise.all([
        supabase.from("drivers").select("id"),
        supabase.from("driver_documents").select("driver_id, document_type, expiry_date"),
        supabase.from("toolbox_talks").select("driver_id, date_conducted"),
        supabase.from("vehicles").select("id").eq("is_active", true),
        supabase.from("damage_inspections").select("vehicle_id, inspection_date"),
        supabase.from("damage_items").select("id, resolved"),
      ]);
      return {
        drivers: d.data || [],
        docs: dd.data || [],
        talks: t.data || [],
        vehicles: v.data || [],
        inspections: i.data || [],
        damages: dam.data || [],
      };
    },
  });

  const now = Date.now();
  const currentYear = new Date().getFullYear();

  const driverIds = (data?.drivers || []).map(d => d.id);
  const totalDrivers = driverIds.length || 1;

  // Driver counts as having a valid medical only when at least one Medical Certificate
  // has a future expiry_date. NULL/missing = NOT valid.
  const validMedical = driverIds.filter(id => {
    return (data?.docs || []).some(x =>
      x.driver_id === id &&
      x.document_type === "Medical Certificate" &&
      x.expiry_date &&
      new Date(x.expiry_date).getTime() > now
    );
  }).length;

  // Toolbox talk counts only if at least one was conducted in the current calendar year.
  const recentTalks = driverIds.filter(id => {
    return (data?.talks || []).some(x => {
      if (x.driver_id !== id || !x.date_conducted) return false;
      const d = new Date(x.date_conducted);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
    });
  }).length;

  // Criminal check requires a record with a future expiry. NULL = not valid.
  const validCriminal = driverIds.filter(id => (data?.docs || []).some(x =>
    x.driver_id === id &&
    x.document_type === "Criminal Background Check" &&
    x.expiry_date &&
    new Date(x.expiry_date).getTime() > now
  )).length;

  const totalVehicles = (data?.vehicles || []).length || 1;
  const lastInsp = new Map<string, string>();
  for (const insp of data?.inspections || []) {
    if (insp.vehicle_id && insp.inspection_date && !lastInsp.has(insp.vehicle_id)) lastInsp.set(insp.vehicle_id, insp.inspection_date);
  }
  const recentInspections = (data?.vehicles || []).filter(v => {
    const d = lastInsp.get(v.id);
    return d && (now - new Date(d).getTime()) <= 90 * 86400000;
  }).length;

  const totalDamage = (data?.damages || []).length || 1;
  const resolvedDamage = (data?.damages || []).filter(d => d.resolved).length;

  const pcts = {
    medical: Math.round((validMedical / totalDrivers) * 100),
    talks: Math.round((recentTalks / totalDrivers) * 100),
    criminal: Math.round((validCriminal / totalDrivers) * 100),
    inspections: Math.round((recentInspections / totalVehicles) * 100),
    damage: Math.round((resolvedDamage / totalDamage) * 100),
  };

  const score = Math.round((pcts.medical + pcts.talks + pcts.criminal + pcts.inspections + pcts.damage) / 5);
  const color = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="stat-card">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <HardHat className="w-4 h-4 text-primary" /> H&amp;S Compliance Score
        </h3>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <div className="flex items-center gap-4">
        <p className={`text-4xl font-bold ${color}`}>{score}<span className="text-lg font-normal opacity-70">%</span></p>
        <div>
          <p className="text-xs text-muted-foreground">Across drivers, vehicles & damage</p>
          <p className={`text-sm font-semibold ${color}`}>
            {score >= 80 ? "Strong" : score >= 50 ? "Needs attention" : "At risk"}
          </p>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-2 text-xs">
          <Row label="Drivers with valid medical" pct={pcts.medical} />
          <Row label="Drivers with recent toolbox talk (30d)" pct={pcts.talks} />
          <Row label="Drivers with criminal check" pct={pcts.criminal} />
          <Row label="Vehicles inspected in last 90 days" pct={pcts.inspections} />
          <Row label="Damage items resolved" pct={pcts.damage} />
        </div>
      )}
    </div>
  );
}

function Row({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
