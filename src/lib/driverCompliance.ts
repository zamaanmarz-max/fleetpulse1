// Equipment options for vehicles - re-exported from vehicleEquipment for backwards compat
export { EQUIPMENT_OPTIONS, DEFAULT_REQUIRED_CERTS, EQUIPMENT_CERT_MAP, getRequiredCertificates, getEquipmentComplianceStatus } from "@/lib/vehicleEquipment";
import { calcToolboxStatus } from "@/lib/driverComplianceHelpers";

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
 *     -10 toolbox talk expired after 6 months
 *     -15 no toolbox talk
 *   Status bands: >=80 compliant, 50-79 warning, <50 critical
 */
// Match doc types loosely (e.g. "Driver's Licence", "drivers_licence", "licence")
const matchesType = (docType: string | null | undefined, keywords: string[]) => {
  if (!docType) return false;
  const t = docType.toLowerCase().replace(/[^a-z]/g, "");
  return keywords.some(k => t.includes(k));
};

const futureValidDoc = (
  documents: { document_type: string | null; expiry_date: string | null }[],
  keywords: string[],
  now: number
) =>
  documents.find(d =>
    matchesType(d.document_type, keywords) &&
    d.expiry_date &&
    new Date(d.expiry_date).getTime() > now
  );

const latestExpiryDoc = (
  documents: { document_type: string | null; expiry_date: string | null }[],
  keywords: string[]
) =>
  documents
    .filter(d => matchesType(d.document_type, keywords) && d.expiry_date)
    .sort((a, b) => new Date(b.expiry_date!).getTime() - new Date(a.expiry_date!).getTime())[0];

export function checkDriverCompliance(
  driver: {
    licence_expiry: string | null;
    prdp_expiry: string | null;
    licence_number?: string | null;
    prdp_number?: string | null;
  },
  documents: { document_type: string | null; expiry_date: string | null; calcStatus: string }[],
  toolboxTalks: { date_conducted: string }[],
  complianceSettings: { toolbox_talks?: boolean; criminal_background_checks?: boolean } = {}
): DriverComplianceResult {
  const now = Date.now();
  const issues: DriverComplianceResult["issues"] = [];
  const breakdown: DriverComplianceResult["breakdown"] = [];
  let score = 100;
  // Track which of the 4 mandatory conditions pass.
  // A driver is only compliant when ALL are TRUE.
  let licenceOk = false;
  let prdpOk = false;
  let medicalOk = false;
  let toolboxOk = false;

  // ---- Licence: must have a future-dated expiry from drivers table OR documents ----
  const licenceKeywords = ["licence", "license"];
  const licenceFromDoc = futureValidDoc(documents, licenceKeywords, now);
  const driverLicenceFuture = driver.licence_expiry && new Date(driver.licence_expiry).getTime() > now;

  if (licenceFromDoc || driverLicenceFuture) {
    licenceOk = true;
    const effectiveExpiry = [
      driver.licence_expiry,
      latestExpiryDoc(documents, licenceKeywords)?.expiry_date,
    ].filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];
    if (effectiveExpiry) {
      const days = Math.ceil((new Date(effectiveExpiry).getTime() - now) / 86400000);
      if (days <= 30 && days > 0) {
        issues.push({ field: "Driver's Licence", status: "expiring" });
        score -= 5; breakdown.push({ label: `Licence expiring in ${days}d`, deduction: 5, severity: "warning" });
      }
    }
  } else {
    const anyLicenceDoc = latestExpiryDoc(documents, licenceKeywords);
    const hasAnyExpiry = driver.licence_expiry || anyLicenceDoc?.expiry_date;
    if (!hasAnyExpiry) {
      issues.push({ field: "Driver's Licence", status: "missing" });
      score -= 35; breakdown.push({ label: "Licence expiry date not captured (NON-COMPLIANT)", deduction: 35, severity: "critical" });
    } else {
      issues.push({ field: "Driver's Licence", status: "expired" });
      score -= 35; breakdown.push({ label: "Driver's licence expired (NON-COMPLIANT)", deduction: 35, severity: "critical" });
    }
  }

  // ---- PrDP: must have a future-dated expiry ----
  const prdpKeywords = ["prdp", "professionaldriving"];
  const prdpFromDoc = futureValidDoc(documents, prdpKeywords, now);
  const driverPrdpFuture = driver.prdp_expiry && new Date(driver.prdp_expiry).getTime() > now;

  if (prdpFromDoc || driverPrdpFuture) {
    prdpOk = true;
    const effectiveExpiry = [
      driver.prdp_expiry,
      latestExpiryDoc(documents, prdpKeywords)?.expiry_date,
    ].filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];
    if (effectiveExpiry) {
      const days = Math.ceil((new Date(effectiveExpiry).getTime() - now) / 86400000);
      if (days <= 30 && days > 0) {
        issues.push({ field: "PrDP", status: "expiring" });
        score -= 5; breakdown.push({ label: `PrDP expiring in ${days}d`, deduction: 5, severity: "warning" });
      }
    }
  } else {
    const anyPrdpDoc = latestExpiryDoc(documents, prdpKeywords);
    const hasAnyExpiry = driver.prdp_expiry || anyPrdpDoc?.expiry_date;
    if (!hasAnyExpiry) {
      issues.push({ field: "PrDP", status: "missing" });
      score -= 30; breakdown.push({ label: "PrDP expiry date not captured (NON-COMPLIANT)", deduction: 30, severity: "critical" });
    } else {
      issues.push({ field: "PrDP", status: "expired" });
      score -= 30; breakdown.push({ label: "PrDP expired (NON-COMPLIANT)", deduction: 30, severity: "critical" });
    }
  }

  // ---- Medical Certificate: must have at least 1 with status=valid ----
  const medicalKeywords = ["medical"];
  const medicals = documents.filter(d => matchesType(d.document_type, medicalKeywords));
  const validMedical = medicals.find(m => m.calcStatus === "valid" || m.calcStatus === "expiring");
  if (!medicals.length) {
    issues.push({ field: "Medical Certificate", status: "missing" });
    score -= 20; breakdown.push({ label: "Medical certificate not captured (NON-COMPLIANT)", deduction: 20, severity: "critical" });
  } else if (!validMedical) {
    issues.push({ field: "Medical Certificate", status: "expired" });
    score -= 20; breakdown.push({ label: "Medical certificate expired (NON-COMPLIANT)", deduction: 20, severity: "critical" });
  } else {
    medicalOk = true;
    if (validMedical.calcStatus === "expiring") {
      issues.push({ field: "Medical Certificate", status: "expiring" });
      score -= 5; breakdown.push({ label: "Medical certificate expiring soon", deduction: 5, severity: "warning" });
    }
  }

  if (complianceSettings.criminal_background_checks !== false) {
    const criminalKeywords = ["criminal", "background"];
    const criminal = documents.find(d => matchesType(d.document_type, criminalKeywords));
    if (!criminal) {
      issues.push({ field: "Criminal Background Check", status: "missing" });
      score -= 10; breakdown.push({ label: "No criminal background check", deduction: 10, severity: "critical" });
    } else if (criminal.calcStatus === "expired") {
      issues.push({ field: "Criminal Background Check", status: "expired" });
      score -= 10; breakdown.push({ label: "Criminal background check expired", deduction: 10, severity: "critical" });
    }
  }

  // ---- Toolbox Talk: must have at least 1 in the current calendar year ----
  if (complianceSettings.toolbox_talks !== false) {
    const currentYear = new Date().getFullYear();
    const talksThisYear = toolboxTalks.filter(t => {
      const d = new Date(t.date_conducted);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
    });
    if (toolboxTalks.length === 0) {
      issues.push({ field: "Toolbox Talk", status: "missing" });
      score -= 15; breakdown.push({ label: "No toolbox talk on record (NON-COMPLIANT)", deduction: 15, severity: "critical" });
    } else if (talksThisYear.length === 0) {
      issues.push({ field: "Toolbox Talk", status: "missing" });
      score -= 15; breakdown.push({ label: `No toolbox talk in ${currentYear} (NON-COMPLIANT)`, deduction: 15, severity: "critical" });
    } else {
      toolboxOk = true;
      const latest = toolboxTalks.reduce((m, t) => Math.max(m, new Date(t.date_conducted).getTime()), 0);
      const latestDate = new Date(latest).toISOString().split("T")[0];
      const status = calcToolboxStatus(latestDate);
      if (status === "expired") {
        issues.push({ field: "Toolbox Talk", status: "expired" });
        score -= 10; breakdown.push({ label: "Latest toolbox talk expired", deduction: 10, severity: "critical" });
      } else if (status === "expiring") {
        issues.push({ field: "Toolbox Talk", status: "expiring" });
      }
    }
  } else {
    toolboxOk = true; // org disabled this requirement
  }

  score = Math.max(0, Math.min(100, score));

  // STRICT: A driver is only compliant when ALL 4 mandatory conditions are TRUE.
  // Any missing/expired licence, PrDP, medical, or toolbox-this-year forces NON-COMPLIANT.
  const allMandatoryOk = licenceOk && prdpOk && medicalOk && toolboxOk;

  let status: "compliant" | "warning" | "critical";
  if (!allMandatoryOk) {
    status = "critical";
  } else if (score >= 80) {
    status = "compliant";
  } else if (score >= 50) {
    status = "warning";
  } else {
    status = "critical";
  }

  return {
    isCompliant: allMandatoryOk && issues.filter(i => i.status !== "expiring").length === 0,
    status,
    score,
    issues,
    breakdown,
  };
}

