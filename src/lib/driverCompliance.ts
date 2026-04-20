// Equipment options for vehicles - re-exported from vehicleEquipment for backwards compat
export { EQUIPMENT_OPTIONS, DEFAULT_REQUIRED_CERTS, EQUIPMENT_CERT_MAP, getRequiredCertificates, getEquipmentComplianceStatus } from "@/lib/vehicleEquipment";

export interface DriverComplianceResult {
  isCompliant: boolean;
  status: "compliant" | "warning" | "critical";
  score: number; // 0..100
  issues: { field: string; status: "expired" | "expiring" | "missing" }[];
  breakdown: { label: string; deduction: number; severity: "critical" | "warning" | "info" }[];
}

/**
 * Driver compliance score (per user spec):
 *   Start at 100. Deduct:
 *     -25 no licence
 *     -30 licence expired
 *     -20 no PrDP
 *     -25 PrDP expired
 *     -15 no medical cert
 *     -20 medical expired
 *     -10 no criminal check
 *     -20 no toolbox talk in 30 days
 *   Status bands: >=80 compliant, 50-79 warning, <50 critical
 */
export function checkDriverCompliance(
  driver: {
    licence_expiry: string | null;
    prdp_expiry: string | null;
    licence_number?: string | null;
    prdp_number?: string | null;
  },
  documents: { document_type: string; expiry_date: string | null; calcStatus: string }[],
  toolboxTalks: { date_conducted: string }[]
): DriverComplianceResult {
  const now = Date.now();
  const issues: DriverComplianceResult["issues"] = [];
  const breakdown: DriverComplianceResult["breakdown"] = [];
  let score = 100;

  // Licence — needs both number AND valid (future) expiry
  if (!driver.licence_number || driver.licence_number.trim() === "") {
    issues.push({ field: "Driver's Licence", status: "missing" });
    score -= 25; breakdown.push({ label: "No licence number on file", deduction: 25, severity: "critical" });
  } else if (!driver.licence_expiry) {
    issues.push({ field: "Driver's Licence", status: "missing" });
    score -= 25; breakdown.push({ label: "No licence expiry on file", deduction: 25, severity: "critical" });
  } else {
    const days = Math.ceil((new Date(driver.licence_expiry).getTime() - now) / 86400000);
    if (days <= 0) {
      issues.push({ field: "Driver's Licence", status: "expired" });
      score -= 30; breakdown.push({ label: `Licence expired (${Math.abs(days)}d ago)`, deduction: 30, severity: "critical" });
    } else if (days <= 30) {
      issues.push({ field: "Driver's Licence", status: "expiring" });
      score -= 5; breakdown.push({ label: `Licence expiring in ${days}d`, deduction: 5, severity: "warning" });
    }
  }

  // PrDP — same logic
  if (!driver.prdp_number || driver.prdp_number.trim() === "") {
    issues.push({ field: "PrDP", status: "missing" });
    score -= 20; breakdown.push({ label: "No PrDP number on file", deduction: 20, severity: "critical" });
  } else if (!driver.prdp_expiry) {
    issues.push({ field: "PrDP", status: "missing" });
    score -= 20; breakdown.push({ label: "No PrDP expiry on file", deduction: 20, severity: "critical" });
  } else {
    const days = Math.ceil((new Date(driver.prdp_expiry).getTime() - now) / 86400000);
    if (days <= 0) {
      issues.push({ field: "PrDP", status: "expired" });
      score -= 25; breakdown.push({ label: `PrDP expired (${Math.abs(days)}d ago)`, deduction: 25, severity: "critical" });
    } else if (days <= 30) {
      issues.push({ field: "PrDP", status: "expiring" });
      score -= 5; breakdown.push({ label: `PrDP expiring in ${days}d`, deduction: 5, severity: "warning" });
    }
  }

  // Medical
  const medical = documents.find(d => d.document_type === "Medical Certificate");
  if (!medical) {
    issues.push({ field: "Medical Certificate", status: "missing" });
    score -= 15; breakdown.push({ label: "No medical certificate", deduction: 15, severity: "critical" });
  } else if (medical.calcStatus === "expired") {
    issues.push({ field: "Medical Certificate", status: "expired" });
    score -= 20; breakdown.push({ label: "Medical certificate expired", deduction: 20, severity: "critical" });
  } else if (medical.calcStatus === "expiring") {
    issues.push({ field: "Medical Certificate", status: "expiring" });
    score -= 5; breakdown.push({ label: "Medical certificate expiring soon", deduction: 5, severity: "warning" });
  }

  // Criminal
  const criminal = documents.find(d => d.document_type === "Criminal Background Check");
  if (!criminal) {
    issues.push({ field: "Criminal Background Check", status: "missing" });
    score -= 10; breakdown.push({ label: "No criminal background check", deduction: 10, severity: "warning" });
  }

  // Toolbox talk
  if (toolboxTalks.length === 0) {
    issues.push({ field: "Toolbox Talk", status: "missing" });
    score -= 20; breakdown.push({ label: "No toolbox talk on record", deduction: 20, severity: "critical" });
  } else {
    const latest = toolboxTalks.reduce((m, t) => Math.max(m, new Date(t.date_conducted).getTime()), 0);
    const daysSince = Math.ceil((now - latest) / 86400000);
    if (daysSince > 30) {
      issues.push({ field: "Toolbox Talk", status: "expired" });
      score -= 20; breakdown.push({ label: `No toolbox talk in ${daysSince} days`, deduction: 20, severity: "critical" });
    }
  }

  score = Math.max(0, Math.min(100, score));
  let status: "compliant" | "warning" | "critical";
  if (score >= 80) status = "compliant";
  else if (score >= 50) status = "warning";
  else status = "critical";

  return {
    isCompliant: issues.length === 0,
    status,
    score,
    issues,
    breakdown,
  };
}
