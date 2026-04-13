// Equipment options with their required certificates
export const VEHICLE_EQUIPMENT = [
  { id: "refrigeration_unit", label: "Refrigeration Unit", requiredCerts: ["Fridge Calibration Certificate"] },
  { id: "tail_lift", label: "Tail Lift", requiredCerts: ["Tail Lift Load Test Certificate"] },
  { id: "crane_hiab", label: "Crane/Hiab", requiredCerts: ["Crane/Lifting Equipment Certificate"] },
  { id: "tanker", label: "Tanker", requiredCerts: ["Dangerous Goods Permit", "Tank Calibration Certificate"] },
  { id: "tipper", label: "Tipper", requiredCerts: [] },
  { id: "flatbed", label: "Flatbed", requiredCerts: [] },
  { id: "curtainsider", label: "Curtainsider", requiredCerts: [] },
  { id: "dangerous_goods", label: "Dangerous Goods (ADR)", requiredCerts: ["ADR Certificate", "Dangerous Goods Permit"] },
  { id: "abnormal_load", label: "Abnormal Load", requiredCerts: [] },
  { id: "passenger_carrier", label: "Passenger Carrier", requiredCerts: [] },
] as const;

export function getRequiredCertsForEquipment(equipment: string[]): string[] {
  const certs = new Set<string>();
  for (const eq of equipment) {
    const found = VEHICLE_EQUIPMENT.find(e => e.id === eq);
    if (found) {
      for (const cert of found.requiredCerts) {
        certs.add(cert);
      }
    }
  }
  return Array.from(certs);
}

// Driver compliance check
export interface DriverComplianceResult {
  isCompliant: boolean;
  status: "compliant" | "warning" | "critical";
  issues: { field: string; status: "expired" | "expiring" | "missing" }[];
}

export function checkDriverCompliance(
  driver: {
    licence_expiry: string | null;
    prdp_expiry: string | null;
  },
  documents: { document_type: string; expiry_date: string | null; calcStatus: string }[],
  toolboxTalks: { date_conducted: string }[]
): DriverComplianceResult {
  const now = Date.now();
  const issues: DriverComplianceResult["issues"] = [];

  // Check licence
  if (!driver.licence_expiry) {
    issues.push({ field: "Driver's Licence", status: "missing" });
  } else {
    const days = Math.ceil((new Date(driver.licence_expiry).getTime() - now) / 86400000);
    if (days <= 0) issues.push({ field: "Driver's Licence", status: "expired" });
    else if (days <= 30) issues.push({ field: "Driver's Licence", status: "expiring" });
  }

  // Check PrDP
  if (!driver.prdp_expiry) {
    issues.push({ field: "PrDP", status: "missing" });
  } else {
    const days = Math.ceil((new Date(driver.prdp_expiry).getTime() - now) / 86400000);
    if (days <= 0) issues.push({ field: "PrDP", status: "expired" });
    else if (days <= 30) issues.push({ field: "PrDP", status: "expiring" });
  }

  // Check Medical Certificate
  const medical = documents.find(d => d.document_type === "Medical Certificate");
  if (!medical) {
    issues.push({ field: "Medical Certificate", status: "missing" });
  } else if (medical.calcStatus === "expired") {
    issues.push({ field: "Medical Certificate", status: "expired" });
  } else if (medical.calcStatus === "expiring") {
    issues.push({ field: "Medical Certificate", status: "expiring" });
  }

  // Check Criminal Background Check
  const criminal = documents.find(d => d.document_type === "Criminal Background Check");
  if (!criminal) {
    issues.push({ field: "Criminal Background Check", status: "missing" });
  } else if (criminal.calcStatus === "expired") {
    issues.push({ field: "Criminal Background Check", status: "expired" });
  } else if (criminal.calcStatus === "expiring") {
    issues.push({ field: "Criminal Background Check", status: "expiring" });
  }

  // Check Toolbox Talk (must be done within last 30 days)
  if (toolboxTalks.length === 0) {
    issues.push({ field: "Toolbox Talk", status: "missing" });
  } else {
    const latestTalk = toolboxTalks.reduce((latest, t) => {
      const d = new Date(t.date_conducted).getTime();
      return d > latest ? d : latest;
    }, 0);
    const daysSinceTalk = Math.ceil((now - latestTalk) / 86400000);
    if (daysSinceTalk > 30) {
      issues.push({ field: "Toolbox Talk", status: "expired" });
    }
  }

  const hasExpiredOrMissing = issues.some(i => i.status === "expired" || i.status === "missing");
  const hasExpiring = issues.some(i => i.status === "expiring");

  return {
    isCompliant: issues.length === 0,
    status: hasExpiredOrMissing ? "critical" : hasExpiring ? "warning" : "compliant",
    issues,
  };
}
