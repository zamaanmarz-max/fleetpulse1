import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_REQUIRED_CERTS, EQUIPMENT_CERT_MAP, getRequiredCertificates, matchesCert } from "@/lib/vehicleEquipment";
import { computeTrackerStatus } from "@/lib/serviceTrackers";

interface VehicleComplianceInput {
  id: string;
  current_odometer_km: number | null;
  next_service_due_km: number | null;
  km_until_service: number | null;
  compliance_template_id: string | null;
  equipment?: any;
  compliance_settings?: any;
}

interface CertificateInput {
  certificate_type: string;
  vehicle_id?: string | null;
  expiry_date: string | null;
  status: string | null;
}

interface InspectionInput {
  vehicle_id: string | null;
  inspection_date: string | null;
}

interface TrackerInput {
  vehicle_id: string;
  tracker_name?: string | null;
  tracking_type: string;
  interval_value?: number | null;
  last_done_value?: number | null;
  last_done_date?: string | null;
  next_due_value: number | null;
  next_due_date: string | null;
}

interface DamageInput {
  vehicle_id: string | null;
  severity?: string | null;
  resolved?: boolean | null;
  requires_immediate_action?: boolean | null;
}

export interface ComplianceBreakdownItem {
  label: string;
  deduction: number;
  severity: "critical" | "warning" | "info";
}

export interface ComplianceScoreResult {
  score: number;                     // 0..100
  status: "compliant" | "warning" | "critical";
  compliance_status: string;
  risk_score: number;                // legacy field, 0..100 inverse
  km_until_service: number;
  breakdown: ComplianceBreakdownItem[];
}

/**
 * New compliance score model (per user spec):
 *   Start at 100. Deduct:
 *     -20 missing required cert (per cert)
 *     -25 expired cert (per cert)
 *     -10 cert expiring within 30 days (per cert)
 *     -20 service overdue (km < 0)
 *     -10 service due within 2000km
 *     -10 no inspection in 90 days
 *     -10 custom tracker overdue (per tracker)
 *   Bands: 80-100 compliant, 50-79 warning, 0-49 critical
 */
export function calculateVehicleComplianceScore(
  vehicle: VehicleComplianceInput,
  vehicleCerts: CertificateInput[],
  vehicleInspections: InspectionInput[] = [],
  vehicleTrackers: TrackerInput[] = [],
  damageItems: DamageInput[] = []
): ComplianceScoreResult {
  let score = 100;
  const breakdown: ComplianceBreakdownItem[] = [];
  const now = Date.now();

  const currentKm = vehicle.current_odometer_km ?? 0;
  const nextServiceKm = vehicle.next_service_due_km ?? 0;
  const kmUntilService = nextServiceKm - currentKm;

  const equipment = (vehicle.equipment as string[]) || [];
  const required = getRequiredCertificates(equipment);
  const equipmentCerts = new Set(equipment.flatMap(eq => EQUIPMENT_CERT_MAP[eq] || []));

  for (const reqCert of required) {
    const match = vehicleCerts.find(c => matchesCert(reqCert, c.certificate_type));
    const isCof = matchesCert("COF & Vehicle Licence", reqCert);
    const isFire = matchesCert("Fire Extinguisher Certificate", reqCert);
    const missingDeduction = isCof ? 40 : isFire ? 15 : equipmentCerts.has(reqCert) ? 20 : 0;
    const expiredDeduction = isCof ? 40 : isFire ? 15 : equipmentCerts.has(reqCert) ? 20 : 0;
    if (!match) {
      if (missingDeduction > 0) {
        score -= missingDeduction;
        breakdown.push({ label: `${reqCert} missing — ${missingDeduction}% deduction`, deduction: missingDeduction, severity: "critical" });
      }
      continue;
    }
    if (match.expiry_date) {
      const days = Math.ceil((new Date(match.expiry_date).getTime() - now) / 86400000);
      if (days <= 0 && expiredDeduction > 0) {
        score -= expiredDeduction;
        breakdown.push({ label: `${reqCert} expired — ${expiredDeduction}% deduction`, deduction: expiredDeduction, severity: "critical" });
      }
    }
  }

  // Expiring warnings for required certificates only; optional certificates are informational.
  for (const cert of vehicleCerts) {
    if (!cert.expiry_date) continue;
    const isRequired = required.some(req => matchesCert(req, cert.certificate_type));
    if (!isRequired) continue;
    const days = Math.ceil((new Date(cert.expiry_date).getTime() - now) / 86400000);
    if (days > 0 && days <= 30) {
      breakdown.push({ label: `${cert.certificate_type} expiring in ${days} days`, deduction: 0, severity: "warning" });
    }
  }

  // Service status
  if (kmUntilService < 0) {
    score -= 15;
    breakdown.push({
      label: `Service overdue by ${Math.abs(kmUntilService).toLocaleString()} km — 15% deduction`,
      deduction: 15,
      severity: "critical",
    });
  } else if (kmUntilService <= 2000) {
    score -= 10;
    breakdown.push({
      label: `Service due in ${kmUntilService.toLocaleString()} km`,
      deduction: 10,
      severity: "warning",
    });
  }

  // No inspection in 90 days
  const lastInsp = vehicleInspections
    .filter(i => i.inspection_date)
    .sort((a, b) => new Date(b.inspection_date!).getTime() - new Date(a.inspection_date!).getTime())[0];
  if (!lastInsp) {
    score -= 10;
    breakdown.push({ label: "No inspection on record", deduction: 10, severity: "warning" });
  } else {
    const daysSince = Math.floor((now - new Date(lastInsp.inspection_date!).getTime()) / 86400000);
    if (daysSince > 90) {
      score -= 10;
      breakdown.push({ label: `Last inspection ${daysSince} days ago`, deduction: 10, severity: "warning" });
    }
  }

  // Custom equipment/service trackers
  for (const t of vehicleTrackers) {
    const tracker = { id: "", interval_value: 0, last_done_value: null, last_done_date: null, ...t } as any;
    const trackerStatus = computeTrackerStatus(tracker, currentKm);
    const name = t.tracker_name || "Equipment tracker";
    if (trackerStatus.status === "overdue") {
      score -= 10;
      breakdown.push({ label: `${name} overdue — 10% deduction`, deduction: 10, severity: "warning" });
    } else if (trackerStatus.status === "due_soon") {
      score -= 5;
      breakdown.push({ label: `${name} due soon — 5% deduction`, deduction: 5, severity: "warning" });
    }
  }

  const criticalDamage = damageItems.filter(d => !d.resolved && (d.requires_immediate_action || (d.severity || "").toLowerCase() === "critical"));
  for (const d of criticalDamage) {
    score -= 5;
    breakdown.push({ label: "Unresolved critical damage — 5% deduction", deduction: 5, severity: "warning" });
  }

  score = Math.max(0, Math.min(100, score));
  let status: "compliant" | "warning" | "critical";
  if (score >= 80) status = "compliant";
  else if (score >= 50) status = "warning";
  else status = "critical";

  // Legacy compliance_status string (for existing UI badges)
  let compliance_status = status;
  const hasExpired = breakdown.some(b => b.label.startsWith("Expired:"));
  if (hasExpired && status === "critical") compliance_status = "critical" as any;

  return {
    score,
    status,
    compliance_status,
    risk_score: 100 - score,
    km_until_service: kmUntilService,
    breakdown,
  };
}

// Backward compat for existing call sites
export function calculateComplianceStatus(
  vehicle: VehicleComplianceInput,
  vehicleCerts: CertificateInput[]
) {
  const result = calculateVehicleComplianceScore(vehicle, vehicleCerts);
  return {
    compliance_status: result.compliance_status,
    risk_score: result.risk_score,
    km_until_service: result.km_until_service,
  };
}

export async function recalculateAllVehicleCompliance() {
  const [vehiclesRes, certsRes, inspectionsRes, trackersRes] = await Promise.all([
    supabase.from("vehicles").select("id, current_odometer_km, next_service_due_km, km_until_service, compliance_template_id, equipment").eq("is_active", true),
    supabase.from("certificates").select("certificate_type, vehicle_id, expiry_date, status"),
    supabase.from("damage_inspections").select("vehicle_id, inspection_date"),
    supabase.from("vehicle_service_trackers" as any).select("vehicle_id, tracker_name, tracking_type, interval_value, last_done_value, last_done_date, next_due_value, next_due_date"),
  ]);

  const vehicles = vehiclesRes.data || [];
  const certs = certsRes.data || [];
  const inspections = (inspectionsRes.data || []) as InspectionInput[];
  const trackers = ((trackersRes.data as any) || []) as TrackerInput[];

  const certsByV: Record<string, CertificateInput[]> = {};
  for (const c of certs) {
    if (!c.vehicle_id) continue;
    (certsByV[c.vehicle_id] = certsByV[c.vehicle_id] || []).push(c);
  }
  const inspByV: Record<string, InspectionInput[]> = {};
  for (const i of inspections) {
    if (!i.vehicle_id) continue;
    (inspByV[i.vehicle_id] = inspByV[i.vehicle_id] || []).push(i);
  }
  const trackersByV: Record<string, TrackerInput[]> = {};
  for (const t of trackers) {
    if (!t.vehicle_id) continue;
    (trackersByV[t.vehicle_id] = trackersByV[t.vehicle_id] || []).push(t);
  }

  for (const v of vehicles) {
    const result = calculateVehicleComplianceScore(
      v,
      certsByV[v.id] || [],
      inspByV[v.id] || [],
      trackersByV[v.id] || []
    );
    await supabase.from("vehicles").update({
      compliance_status: result.status,
      risk_score: result.risk_score,
    }).eq("id", v.id);
  }
}
