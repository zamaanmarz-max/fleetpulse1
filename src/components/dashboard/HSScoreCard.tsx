import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HardHat, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck } from "lucide-react";

/**
 * H&S Compliance Score — modelled on the SA OHS Act 85 of 1993 plus
 * NRTA, COF, AARTO and Foodstuffs/Cosmetics/Disinfectants Act
 * requirements that a Department of Labour inspector would check on
 * an unannounced visit to a transport / fleet operator.
 *
 * Total: 100 points. Missing data ALWAYS scores ZERO for that line.
 */

type CategoryKey =
  | "medical" | "toolbox" | "prdp" | "criminal" | "defensive"
  | "fire" | "cof" | "damage" | "inspections"
  | "coa" | "loadtest" | "dg";

interface CategoryResult {
  key: CategoryKey;
  group: "Driver H&S" | "Vehicle H&S" | "Company Compliance";
  label: string;
  legalRef: string;
  max: number;
  score: number; // 0..max
  detail: string;
  fixHint: string;
}

const matchesType = (s: string | null | undefined, kws: string[]) => {
  if (!s) return false;
  const t = s.toLowerCase().replace(/[^a-z]/g, "");
  return kws.some(k => t.includes(k));
};

const isFutureDate = (iso: string | null | undefined, now: number) =>
  !!iso && new Date(iso).getTime() > now;

export function HSScoreCard() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["hs_score_v2", profile?.organisation_id],
    enabled: !!profile?.organisation_id,
    queryFn: async () => {
      const [drv, ddocs, talks, veh, insp, dam, certs] = await Promise.all([
        supabase.from("drivers").select("id, staff_type, prdp_expiry, prdp_number, defensive_driving_expiry"),
        supabase.from("driver_documents").select("driver_id, document_type, expiry_date, status"),
        supabase.from("toolbox_talks").select("driver_id, date_conducted"),
        supabase.from("vehicles").select("id, vehicle_type, equipment, equipment_list").eq("is_active", true),
        supabase.from("damage_inspections").select("vehicle_id, inspection_date"),
        supabase.from("damage_items").select("id, severity, resolved"),
        supabase.from("certificates").select("vehicle_id, certificate_type, expiry_date, status, last_inspection_date"),
      ]);
      return {
        drivers: drv.data || [],
        ddocs: ddocs.data || [],
        talks: talks.data || [],
        vehicles: veh.data || [],
        inspections: insp.data || [],
        damages: dam.data || [],
        certs: certs.data || [],
      };
    },
  });

  const now = Date.now();
  const startOfMonth = new Date();
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const startOfMonthMs = startOfMonth.getTime();

  // Only actual drivers count toward driver scoring
  const drivers = (data?.drivers || []).filter(d => (d.staff_type || "driver") === "driver");
  const driverIds = drivers.map(d => d.id);
  const driverCount = driverIds.length;

  const vehicles = data?.vehicles || [];
  const vehicleIds = vehicles.map(v => v.id);
  const vehicleCount = vehicles.length;

  const ddocs = data?.ddocs || [];
  const talks = data?.talks || [];
  const inspections = data?.inspections || [];
  const damages = data?.damages || [];
  const certs = data?.certs || [];

  // ---------- DRIVER METRICS ----------
  const driversWithValidMedical = driverIds.filter(id =>
    ddocs.some(x => x.driver_id === id && matchesType(x.document_type, ["medical"]) && isFutureDate(x.expiry_date, now))
  ).length;

  const driversWithTalkThisMonth = driverIds.filter(id =>
    talks.some(t => t.driver_id === id && t.date_conducted && new Date(t.date_conducted).getTime() >= startOfMonthMs)
  ).length;

  const driversWithValidPrdp = driverIds.filter(id => {
    const d = drivers.find(dd => dd.id === id);
    if (isFutureDate(d?.prdp_expiry, now)) return true;
    return ddocs.some(x => x.driver_id === id && matchesType(x.document_type, ["prdp", "professionaldriving"]) && isFutureDate(x.expiry_date, now));
  }).length;

  const driversWithCriminal = driverIds.filter(id =>
    ddocs.some(x => x.driver_id === id && matchesType(x.document_type, ["criminal", "background"]) && isFutureDate(x.expiry_date, now))
  ).length;

  const driversWithDefensive = driverIds.filter(id => {
    const d = drivers.find(dd => dd.id === id);
    if (isFutureDate(d?.defensive_driving_expiry, now)) return true;
    return ddocs.some(x => x.driver_id === id && matchesType(x.document_type, ["defensive"]) && isFutureDate(x.expiry_date, now));
  }).length;

  const pct = (n: number, total: number) => total > 0 ? (n / total) * 100 : 0;

  // ---------- VEHICLE METRICS ----------
  const equipmentOf = (v: any): string[] => {
    const a = Array.isArray(v?.equipment) ? v.equipment : [];
    const b = Array.isArray(v?.equipment_list) ? v.equipment_list : [];
    return [...a, ...b].map((e: any) => String(e || "").toLowerCase());
  };

  const vehicleHasValidCert = (vehicleId: string, kws: string[]) =>
    certs.some(c => c.vehicle_id === vehicleId && matchesType(c.certificate_type, kws) && isFutureDate(c.expiry_date, now));

  const vehiclesWithValidFire = vehicleIds.filter(id => vehicleHasValidCert(id, ["fireextinguisher", "fire"])).length;
  const vehiclesWithValidCOF = vehicleIds.filter(id => vehicleHasValidCert(id, ["cof", "roadworthy", "certificateoffitness"])).length;

  // Critical unresolved damage
  const unresolvedCritical = damages.filter(d =>
    !d.resolved && (d.severity === "critical" || d.severity === "major")
  ).length;

  const lastInspByVehicle = new Map<string, number>();
  for (const i of inspections) {
    if (!i.vehicle_id || !i.inspection_date) continue;
    const t = new Date(i.inspection_date).getTime();
    const prev = lastInspByVehicle.get(i.vehicle_id) || 0;
    if (t > prev) lastInspByVehicle.set(i.vehicle_id, t);
  }
  const inspectedRecently = vehicleIds.filter(id => {
    const t = lastInspByVehicle.get(id);
    return t && (now - t) <= 90 * 86400000;
  }).length;

  // ---------- COMPANY COMPLIANCE ----------
  const refrigeratedVehicles = vehicles.filter(v =>
    equipmentOf(v).some(e => e.includes("fridge") || e.includes("refriger") || e.includes("chiller"))
  );
  const refrigeratedWithCOA = refrigeratedVehicles.filter(v =>
    vehicleHasValidCert(v.id, ["coa", "certificateofacceptability"])
  ).length;

  const tailLiftVehicles = vehicles.filter(v =>
    equipmentOf(v).some(e => e.includes("tail") || e.includes("crane") || e.includes("lift") || e.includes("hoist"))
  );
  const tailLiftCompliant = tailLiftVehicles.filter(v => {
    const lt = certs.find(c => c.vehicle_id === v.id && matchesType(c.certificate_type, ["loadtest", "load"]));
    if (!lt || !isFutureDate(lt.expiry_date, now)) return false;
    if (!lt.last_inspection_date) return false;
    return (now - new Date(lt.last_inspection_date).getTime()) <= 6 * 30 * 86400000;
  }).length;

  const dgVehicles = vehicles.filter(v =>
    equipmentOf(v).some(e => e.includes("dangerous") || e.includes("hazard") || e.includes("dg"))
  );
  const dgCompliantVehicles = dgVehicles.filter(v =>
    vehicleHasValidCert(v.id, ["dangerousgoods", "dg", "hazchem"])
  ).length;

  // ---------- SCORING ----------
  const cats: CategoryResult[] = [];

  // Medical (15) — full at 90%+, 1 pt per 6%, zero if 0
  {
    const p = pct(driversWithValidMedical, driverCount);
    let s = 0;
    if (driverCount > 0) {
      if (p >= 90) s = 15;
      else if (p > 0) s = Math.min(15, Math.floor(p / 6));
    }
    cats.push({
      key: "medical", group: "Driver H&S", label: "Medical Certificates",
      legalRef: "OHS Act + NRTA – fitness to drive",
      max: 15, score: s,
      detail: driverCount === 0 ? "No drivers captured yet" : `${driversWithValidMedical}/${driverCount} drivers (${Math.round(p)}%) have a valid medical`,
      fixHint: "Upload valid medical certificates for all drivers under Drivers → Documents.",
    });
  }

  // Toolbox Talks (15) — full at 100% drivers with talk THIS MONTH
  {
    const p = pct(driversWithTalkThisMonth, driverCount);
    let s = 0;
    if (driverCount > 0) {
      if (p >= 100) s = 15;
      else if (p > 0) s = Math.min(15, Math.floor(p / 6));
    }
    cats.push({
      key: "toolbox", group: "Driver H&S", label: "Toolbox Talks (this month)",
      legalRef: "OHS Act §8 – ongoing safety training",
      max: 15, score: s,
      detail: driverCount === 0 ? "No drivers captured yet" : `${driversWithTalkThisMonth}/${driverCount} drivers (${Math.round(p)}%) had a talk this month`,
      fixHint: "Run a toolbox talk this month and log it for every driver.",
    });
  }

  // PrDP (10) — full at 90%+, deduct 1pt per 10% missing/expired
  {
    const p = pct(driversWithValidPrdp, driverCount);
    let s = 0;
    if (driverCount > 0) {
      const missingPct = 100 - p;
      s = Math.max(0, Math.round(10 - missingPct / 10));
      if (p >= 90) s = 10;
    }
    cats.push({
      key: "prdp", group: "Driver H&S", label: "PrDP Compliance",
      legalRef: "NRTA – Professional Driving Permit",
      max: 10, score: s,
      detail: driverCount === 0 ? "No drivers captured yet" : `${driversWithValidPrdp}/${driverCount} drivers (${Math.round(p)}%) have a valid PrDP`,
      fixHint: "Capture/renew PrDP details for drivers under Drivers → Edit.",
    });
  }

  // Criminal (5) — full at 90%+
  {
    const p = pct(driversWithCriminal, driverCount);
    let s = 0;
    if (driverCount > 0) {
      if (p >= 90) s = 5;
      else if (p > 0) s = Math.min(5, Math.floor(p / 18));
    }
    cats.push({
      key: "criminal", group: "Driver H&S", label: "Criminal Background Checks",
      legalRef: "Required for food / DG / cash transport",
      max: 5, score: s,
      detail: driverCount === 0 ? "No drivers captured yet" : `${driversWithCriminal}/${driverCount} drivers (${Math.round(p)}%) checked`,
      fixHint: "Upload criminal background check documents for drivers.",
    });
  }

  // Defensive Driving (5) — full at 50%+
  {
    const p = pct(driversWithDefensive, driverCount);
    let s = 0;
    if (driverCount > 0) {
      if (p >= 50) s = 5;
      else if (p > 0) s = Math.min(5, Math.floor(p / 10));
    }
    cats.push({
      key: "defensive", group: "Driver H&S", label: "Defensive Driving Training",
      legalRef: "Industry standard for fleet operators",
      max: 5, score: s,
      detail: driverCount === 0 ? "No drivers captured yet" : `${driversWithDefensive}/${driverCount} drivers (${Math.round(p)}%) trained`,
      fixHint: "Enrol drivers in defensive driving and capture certificates.",
    });
  }

  // Fire Extinguisher (10) — full marks only when ALL vehicles compliant
  {
    const p = pct(vehiclesWithValidFire, vehicleCount);
    let s = 0;
    if (vehicleCount > 0) {
      if (p >= 100) s = 10;
      else s = Math.floor(p / 10);
    }
    cats.push({
      key: "fire", group: "Vehicle H&S", label: "Fire Extinguishers",
      legalRef: "OHS General Safety Regulations",
      max: 10, score: s,
      detail: vehicleCount === 0 ? "No vehicles captured yet" : `${vehiclesWithValidFire}/${vehicleCount} vehicles (${Math.round(p)}%) have a valid fire extinguisher cert`,
      fixHint: "Service fire extinguishers and upload the SANS certificate per vehicle.",
    });
  }

  // COF (10) — full at 90%+
  {
    const p = pct(vehiclesWithValidCOF, vehicleCount);
    let s = 0;
    if (vehicleCount > 0) {
      if (p >= 90) s = 10;
      else s = Math.floor(p / 9);
    }
    cats.push({
      key: "cof", group: "Vehicle H&S", label: "Roadworthiness (COF)",
      legalRef: "NRTA – Certificate of Fitness",
      max: 10, score: s,
      detail: vehicleCount === 0 ? "No vehicles captured yet" : `${vehiclesWithValidCOF}/${vehicleCount} vehicles (${Math.round(p)}%) have a valid COF`,
      fixHint: "Renew COF at a testing station and upload the certificate.",
    });
  }

  // Damage (8) — full marks if zero unresolved critical, -2 each
  {
    let s = 8;
    s = Math.max(0, 8 - unresolvedCritical * 2);
    cats.push({
      key: "damage", group: "Vehicle H&S", label: "Critical Damage Resolution",
      legalRef: "OHS Act – safe working equipment",
      max: 8, score: s,
      detail: unresolvedCritical === 0 ? "No unresolved critical damage" : `${unresolvedCritical} unresolved critical / major damage item${unresolvedCritical === 1 ? "" : "s"}`,
      fixHint: "Repair and mark critical damage as resolved under Inspections.",
    });
  }

  // Inspections (7) — full at 80%+ inspected in last 90 days
  {
    const p = pct(inspectedRecently, vehicleCount);
    let s = 0;
    if (vehicleCount > 0) {
      if (p >= 80) s = 7;
      else s = Math.floor((p / 80) * 7);
    }
    cats.push({
      key: "inspections", group: "Vehicle H&S", label: "Pre-trip Inspections (90d)",
      legalRef: "OHS Act §8 – workplace inspections",
      max: 7, score: s,
      detail: vehicleCount === 0 ? "No vehicles captured yet" : `${inspectedRecently}/${vehicleCount} vehicles (${Math.round(p)}%) inspected in last 90 days`,
      fixHint: "Run digital inspections on each vehicle every quarter.",
    });
  }

  // COA (5) — only if refrigerated vehicles exist
  {
    if (refrigeratedVehicles.length === 0) {
      cats.push({
        key: "coa", group: "Company Compliance", label: "Food Safety (COA)",
        legalRef: "Foodstuffs, Cosmetics & Disinfectants Act",
        max: 5, score: 5,
        detail: "Not applicable – no refrigerated vehicles",
        fixHint: "—",
      });
    } else {
      const p = pct(refrigeratedWithCOA, refrigeratedVehicles.length);
      const s = p >= 100 ? 5 : Math.floor(p / 20);
      cats.push({
        key: "coa", group: "Company Compliance", label: "Food Safety (COA)",
        legalRef: "Foodstuffs, Cosmetics & Disinfectants Act",
        max: 5, score: s,
        detail: `${refrigeratedWithCOA}/${refrigeratedVehicles.length} refrigerated vehicles have a valid COA`,
        fixHint: "Apply for / renew COA at the local municipality for each fridge unit.",
      });
    }
  }

  // Load Test (5) — only if tail-lift / crane / lift equipment
  {
    if (tailLiftVehicles.length === 0) {
      cats.push({
        key: "loadtest", group: "Company Compliance", label: "Load Test Certificates",
        legalRef: "OHS General Safety Regulations 18",
        max: 5, score: 5,
        detail: "Not applicable – no tail-lift/crane vehicles",
        fixHint: "—",
      });
    } else {
      const p = pct(tailLiftCompliant, tailLiftVehicles.length);
      const s = p >= 100 ? 5 : Math.floor(p / 20);
      cats.push({
        key: "loadtest", group: "Company Compliance", label: "Load Test Certificates",
        legalRef: "OHS General Safety Regulations 18",
        max: 5, score: s,
        detail: `${tailLiftCompliant}/${tailLiftVehicles.length} tail-lift vehicles have valid annual cert + 6-month inspection`,
        fixHint: "Book load test + 6-monthly inspection by an approved inspector.",
      });
    }
  }

  // Dangerous Goods (5) — only if DG vehicles
  {
    if (dgVehicles.length === 0) {
      cats.push({
        key: "dg", group: "Company Compliance", label: "Dangerous Goods",
        legalRef: "SANS 10231 / NRTA",
        max: 5, score: 5,
        detail: "Not applicable – no DG vehicles",
        fixHint: "—",
      });
    } else {
      const p = pct(dgCompliantVehicles, dgVehicles.length);
      const s = p >= 100 ? 5 : Math.floor(p / 20);
      cats.push({
        key: "dg", group: "Company Compliance", label: "Dangerous Goods",
        legalRef: "SANS 10231 / NRTA",
        max: 5, score: s,
        detail: `${dgCompliantVehicles}/${dgVehicles.length} DG vehicles have valid permits`,
        fixHint: "Upload current DG transport permits and driver DG training certs.",
      });
    }
  }

  const totalScore = cats.reduce((s, c) => s + c.score, 0);
  const maxScore = 100;

  // Top 3 fixes — biggest gap (max - score), excluding N/A categories
  const topFixes = cats
    .filter(c => c.fixHint !== "—" && c.score < c.max)
    .map(c => ({ ...c, gap: c.max - c.score }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  const band =
    totalScore >= 90 ? { label: "Fully Compliant", color: "text-success", bar: "bg-success", chip: "bg-success/20 text-success" } :
    totalScore >= 70 ? { label: "Needs Attention", color: "text-warning", bar: "bg-warning", chip: "bg-warning/20 text-warning" } :
    totalScore >= 50 ? { label: "At Risk", color: "text-orange-500", bar: "bg-orange-500", chip: "bg-orange-500/20 text-orange-500" } :
    { label: "Non-Compliant", color: "text-destructive", bar: "bg-destructive", chip: "bg-destructive/20 text-destructive" };

  return (
    <div className="stat-card">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <HardHat className="w-4 h-4 text-primary" /> H&amp;S Compliance Score
          <span className="text-[10px] font-normal text-muted-foreground hidden sm:inline">OHS Act 85/1993</span>
        </h3>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <div className="flex items-center gap-4">
        <p className={`text-4xl font-bold ${band.color}`}>
          {isLoading ? "…" : totalScore}
          <span className="text-lg font-normal opacity-70">/{maxScore}</span>
        </p>
        <div>
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${band.chip}`}>
            {band.label}
          </span>
          <p className="text-xs text-muted-foreground mt-1">DoL inspector readiness</p>
        </div>
      </div>

      {/* Top 3 fixes always visible */}
      {topFixes.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-warning" /> Top 3 to fix
          </p>
          {topFixes.map(f => (
            <div key={f.key} className="text-xs bg-secondary/40 rounded p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{f.label}</span>
                <span className="text-destructive font-mono text-[11px]">+{f.gap} pts</span>
              </div>
              <p className="text-muted-foreground text-[11px] mt-0.5">{f.fixHint}</p>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4 text-xs">
          {(["Driver H&S", "Vehicle H&S", "Company Compliance"] as const).map(group => {
            const groupCats = cats.filter(c => c.group === group);
            const groupScore = groupCats.reduce((s, c) => s + c.score, 0);
            const groupMax = groupCats.reduce((s, c) => s + c.max, 0);
            return (
              <div key={group}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-foreground uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-primary" /> {group}
                  </p>
                  <span className="text-[11px] font-mono text-muted-foreground">{groupScore}/{groupMax}</span>
                </div>
                <div className="space-y-2">
                  {groupCats.map(c => <CategoryRow key={c.key} cat={c} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ cat }: { cat: CategoryResult }) {
  const ratio = cat.max > 0 ? cat.score / cat.max : 0;
  const color = ratio >= 0.9 ? "bg-success" : ratio >= 0.7 ? "bg-warning" : ratio >= 0.5 ? "bg-orange-500" : "bg-destructive";
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5 gap-2">
        <span className="text-foreground truncate">{cat.label}</span>
        <span className="font-mono font-semibold text-foreground whitespace-nowrap">{cat.score}/{cat.max}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-muted-foreground text-[10px]">{cat.detail}</span>
        <span className="text-muted-foreground text-[10px] italic hidden md:inline">{cat.legalRef}</span>
      </div>
    </div>
  );
}
