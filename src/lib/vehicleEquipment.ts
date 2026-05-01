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

// Mandatory certificates ALL vehicles require.
// These always affect compliance, regardless of organisation settings.
export const DEFAULT_REQUIRED_CERTS = [
  "COF & Vehicle Licence",
  "Fire Extinguisher Certificate",
];

// Required certs for trailers specifically
export const TRAILER_REQUIRED_CERTS = [
  "Certificate of Acceptability",
];

// Returns required certs taking vehicle type into account
export function getRequiredCertificatesForVehicle(equipment: string[], vehicleType?: string | null): string[] {
  const base = getRequiredCertificates(equipment);
  if ((vehicleType || "").toLowerCase() === "trailer") {
    for (const c of TRAILER_REQUIRED_CERTS) if (!base.includes(c)) base.push(c);
  }
  return base;
}

// Legacy/alternate names that should be treated as equivalent to a canonical required cert.
// Used so historic uploads (e.g. "COF Certificate", "Vehicle Licence", "Licence Disk") still satisfy compliance.
export const CERT_ALIASES: Record<string, string[]> = {
  "COF & Vehicle Licence": [
    "cof & vehicle licence",
    "cof certificate",
    "certificate of fitness (cof)",
    "certificate of fitness",
    "cof",
    "vehicle licence",
    "vehicle license",
    "motor vehicle licence disc",
    "licence disk",
    "licence disc",
    "license disc",
  ],
  "Fire Extinguisher Certificate": [
    "fire extinguisher certificate",
    "fire extinguisher",
    "fire extinguisher inspection",
    "fire equipment certificate",
  ],
};

export function matchesCert(canonical: string, certTypeRaw: string): boolean {
  const lower = (certTypeRaw || "").toLowerCase().trim();
  if (lower === canonical.toLowerCase()) return true;
  const aliases = CERT_ALIASES[canonical];
  return !!aliases?.includes(lower);
}

// Mapping from equipment → required certificates
export const EQUIPMENT_CERT_MAP: Record<string, string[]> = {
  "Refrigeration Unit": ["Fridge Calibration Certificate"],
  "Tail Lift": ["Tail Lift Load Test Certificate"],
  "Crane/Hiab": ["Crane Certificate"],
  "Tanker": ["Tank Calibration Certificate", "Dangerous Goods Permit"],
  "Dangerous Goods (ADR)": ["Dangerous Goods Permit"],
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
    const match = certificates.find(c => matchesCert(certType, c.certificate_type));
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
