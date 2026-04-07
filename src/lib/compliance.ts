import { supabase } from "@/integrations/supabase/client";

interface VehicleComplianceInput {
  id: string;
  current_odometer_km: number | null;
  next_service_due_km: number | null;
  km_until_service: number | null;
  compliance_template_id: string | null;
}

interface CertificateInput {
  vehicle_id: string | null;
  expiry_date: string | null;
  status: string | null;
}

export function calculateComplianceStatus(
  vehicle: VehicleComplianceInput,
  vehicleCerts: CertificateInput[]
): { compliance_status: string; risk_score: number; km_until_service: number } {
  const currentKm = vehicle.current_odometer_km ?? 0;
  const nextServiceKm = vehicle.next_service_due_km ?? 0;
  const kmUntilService = nextServiceKm - currentKm;

  let riskScore = 0;
  let status = "compliant";
  const now = new Date();

  // Service-based checks
  if (kmUntilService < 0) {
    status = "critical";
    riskScore += 25;
  } else if (kmUntilService <= 2000) {
    if (status !== "critical") status = "warning";
    riskScore += 15;
  }

  // Certificate-based checks
  let hasExpired = false;
  let hasExpiring = false;

  for (const cert of vehicleCerts) {
    if (!cert.expiry_date) continue;
    const days = Math.ceil((new Date(cert.expiry_date).getTime() - now.getTime()) / 86400000);
    if (days <= 0) {
      hasExpired = true;
      riskScore += 30;
    } else if (days <= 30) {
      hasExpiring = true;
      riskScore += 10;
    }
  }

  if (hasExpired) {
    status = "expired";
  } else if (hasExpiring && status === "compliant") {
    status = "warning";
  }

  // Cap risk score at 100
  riskScore = Math.min(100, riskScore);

  return { compliance_status: status, risk_score: riskScore, km_until_service: kmUntilService };
}

export async function recalculateAllVehicleCompliance() {
  const [vehiclesRes, certsRes] = await Promise.all([
    supabase.from("vehicles").select("id, current_odometer_km, next_service_due_km, km_until_service, compliance_template_id").eq("is_active", true),
    supabase.from("certificates").select("vehicle_id, expiry_date, status"),
  ]);

  const vehicles = vehiclesRes.data || [];
  const certs = certsRes.data || [];

  const certsByVehicle: Record<string, CertificateInput[]> = {};
  for (const c of certs) {
    if (!c.vehicle_id) continue;
    if (!certsByVehicle[c.vehicle_id]) certsByVehicle[c.vehicle_id] = [];
    certsByVehicle[c.vehicle_id].push(c);
  }

  for (const v of vehicles) {
    const vehicleCerts = certsByVehicle[v.id] || [];
    const result = calculateComplianceStatus(v, vehicleCerts);

    await supabase.from("vehicles").update({
      compliance_status: result.compliance_status,
      risk_score: result.risk_score,
      km_until_service: result.km_until_service,
    }).eq("id", v.id);
  }
}
