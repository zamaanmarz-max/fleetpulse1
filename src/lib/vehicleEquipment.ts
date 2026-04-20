// Equipment options for vehicles
export const EQUIPMENT_OPTIONS = [
  "Refrigeration Unit",
  "Tail Lift",
  "Crane/Hiab",
  "Tanker",
  "Tipper Body",
  "Flatbed",
  "Curtainsider",
  "Dangerous Goods (ADR)",
  "Abnormal Load Permit",
  "Passenger Carrier",
  "Livestock Carrier",
  "Skip/Waste",
] as const;

// Default certificates ALL vehicles require (only COF is mandatory by default)
export const DEFAULT_REQUIRED_CERTS = [
  "COF Certificate",
];

// Mapping from equipment → required certificates
export const EQUIPMENT_CERT_MAP: Record<string, string[]> = {
  "Refrigeration Unit": ["Fridge Calibration Certificate"],
  "Tail Lift": ["Tail Lift Load Test Certificate"],
  "Crane/Hiab": ["Lifting Equipment Certificate"],
  "Tanker": ["Tank Calibration Certificate", "Dangerous Goods Permit"],
  "Dangerous Goods (ADR)": ["ADR Certificate", "Dangerous Goods Permit"],
  "Passenger Carrier": ["Operator Permit", "Public Liability Certificate"],
};

// Get all required certificates for a vehicle based on its equipment
export function getRequiredCertificates(equipment: string[]): string[] {
  const certs = new Set<string>(DEFAULT_REQUIRED_CERTS);
  for (const eq of equipment) {
    const mapped = EQUIPMENT_CERT_MAP[eq];
    if (mapped) mapped.forEach(c => certs.add(c));
  }
  return Array.from(certs);
}

// Get compliance status for a vehicle based on equipment and certificates
export function getEquipmentComplianceStatus(
  equipment: string[],
  certificates: { certificate_type: string; expiry_date: string | null; status: string | null }[]
): { required: string[]; status: Record<string, "valid" | "expiring" | "expired" | "missing"> } {
  const required = getRequiredCertificates(equipment);
  const now = Date.now();
  const status: Record<string, "valid" | "expiring" | "expired" | "missing"> = {};

  for (const certType of required) {
    const match = certificates.find(c => c.certificate_type.toLowerCase() === certType.toLowerCase());
    if (!match) {
      status[certType] = "missing";
    } else if (!match.expiry_date) {
      status[certType] = "valid";
    } else {
      const days = Math.ceil((new Date(match.expiry_date).getTime() - now) / 86400000);
      if (days <= 0) status[certType] = "expired";
      else if (days <= 30) status[certType] = "expiring";
      else status[certType] = "valid";
    }
  }

  return { required, status };
}
