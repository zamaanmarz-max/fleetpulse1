// Shared helpers for driver compliance UI and reporting.
// Keep logic in one place so list / detail / report all stay in sync.

export type DocStatus = "valid" | "expiring" | "expired" | "missing";

export const calcDocStatus = (expiry: string | null | undefined): DocStatus => {
  if (!expiry) return "missing";
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days <= 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
};

export const addMonths = (date: string, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};

export const toolboxExpiry = (dateConducted: string) => addMonths(dateConducted, 12);

// Required talks per year (one per month)
export const TOOLBOX_TALKS_REQUIRED_PER_YEAR = 12;

/**
 * Counts the number of toolbox talks conducted in the current calendar year.
 * Returns { done, required, onTrack } where onTrack = done meets the monthly average so far.
 */
export const toolboxYearProgress = (
  talks: { date_conducted: string }[]
): { done: number; required: number; expected: number; onTrack: boolean } => {
  const now = new Date();
  const year = now.getFullYear();
  const done = (talks || []).filter(t => {
    const d = new Date(t.date_conducted);
    return !isNaN(d.getTime()) && d.getFullYear() === year;
  }).length;
  // Expected so far: 1 per month elapsed (including current month)
  const monthsElapsed = now.getMonth() + 1;
  const expected = monthsElapsed;
  return {
    done,
    required: TOOLBOX_TALKS_REQUIRED_PER_YEAR,
    expected,
    onTrack: done >= expected,
  };
};

export const calcToolboxStatus = (dateConducted: string): Exclude<DocStatus, "missing"> => {
  const days = Math.ceil((new Date(toolboxExpiry(dateConducted)).getTime() - Date.now()) / 86400000);
  if (days <= 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
};

export const docStatusLabel = (s: DocStatus) =>
  s === "valid" ? "Valid" : s === "expiring" ? "Expiring" : s === "expired" ? "Expired" : "Missing";

const matchesType = (docType: string | null | undefined, keywords: string[]) => {
  if (!docType) return false;
  const t = docType.toLowerCase().replace(/[^a-z]/g, "");
  return keywords.some(k => t.includes(k));
};

/**
 * Resolve the effective expiry/number for a driver doc category by checking
 * BOTH the drivers table fields and the driver_documents collection.
 * Returns the LATEST future-dated source if any, otherwise the latest known.
 */
export interface ResolvedDoc {
  status: DocStatus;
  expiry: string | null;
  number: string | null;
  source: "driver" | "document" | "none";
}

const resolveFromDocs = (
  documents: { document_type: string | null; document_number?: string | null; expiry_date: string | null }[],
  keywords: string[]
) => {
  const matches = documents.filter(d => matchesType(d.document_type, keywords));
  if (matches.length === 0) return null;
  // Pick the one with the latest expiry
  return matches
    .slice()
    .sort((a, b) => new Date(b.expiry_date || 0).getTime() - new Date(a.expiry_date || 0).getTime())[0];
};

export const resolveLicence = (
  driver: { licence_expiry: string | null; licence_number: string | null },
  documents: { document_type: string | null; document_number?: string | null; expiry_date: string | null }[]
): ResolvedDoc => resolveCategory(
  { expiry: driver.licence_expiry, number: driver.licence_number },
  documents,
  ["licence", "license"]
);

export const resolvePrdp = (
  driver: { prdp_expiry: string | null; prdp_number: string | null },
  documents: { document_type: string | null; document_number?: string | null; expiry_date: string | null }[]
): ResolvedDoc => resolveCategory(
  { expiry: driver.prdp_expiry, number: driver.prdp_number },
  documents,
  ["prdp", "professionaldriving"]
);

export const resolveMedical = (
  documents: { document_type: string | null; document_number?: string | null; expiry_date: string | null }[]
): ResolvedDoc => resolveCategory({ expiry: null, number: null }, documents, ["medical"]);

export const resolveCriminal = (
  documents: { document_type: string | null; document_number?: string | null; expiry_date: string | null }[]
): ResolvedDoc => resolveCategory({ expiry: null, number: null }, documents, ["criminal", "background"]);

function resolveCategory(
  driverFields: { expiry: string | null; number: string | null },
  documents: { document_type: string | null; document_number?: string | null; expiry_date: string | null }[],
  keywords: string[]
): ResolvedDoc {
  const fromDoc = resolveFromDocs(documents, keywords);
  const driverExpiry = driverFields.expiry || null;
  const docExpiry = fromDoc?.expiry_date || null;

  // Pick the latest expiry across the two sources
  const candidates = [
    driverExpiry ? { expiry: driverExpiry, number: driverFields.number || null, source: "driver" as const } : null,
    docExpiry ? { expiry: docExpiry, number: fromDoc?.document_number || null, source: "document" as const } : null,
  ].filter(Boolean) as { expiry: string; number: string | null; source: "driver" | "document" }[];

  if (candidates.length === 0) {
    return { status: "missing", expiry: null, number: null, source: "none" };
  }
  candidates.sort((a, b) => new Date(b.expiry).getTime() - new Date(a.expiry).getTime());
  const best = candidates[0];
  return { status: calcDocStatus(best.expiry), expiry: best.expiry, number: best.number, source: best.source };
}

export const lastToolboxStatus = (talks: { date_conducted: string }[]): { status: "valid" | "expiring" | "expired" | "missing"; lastDate: string | null; daysSince: number | null; expiryDate: string | null; daysUntilExpiry: number | null } => {
  if (!talks || talks.length === 0) return { status: "missing", lastDate: null, daysSince: null, expiryDate: null, daysUntilExpiry: null };
  const latestMs = talks.reduce((m, t) => Math.max(m, new Date(t.date_conducted).getTime()), 0);
  const days = Math.ceil((Date.now() - latestMs) / 86400000);
  const lastDate = new Date(latestMs).toISOString().split("T")[0];
  const expiryDate = toolboxExpiry(lastDate);
  const daysUntilExpiry = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  return { status: calcToolboxStatus(lastDate), lastDate, daysSince: days, expiryDate, daysUntilExpiry };
};
