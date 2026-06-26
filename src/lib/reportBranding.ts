import jsPDF from "jspdf";

/**
 * Shared report branding so the whole MARZ Fleet report set (Fleet Availability,
 * Certificate reports, etc.) looks consistent and is branded per logged-in org
 * instead of hard-coding a single client's details.
 */

// ---- Palette -------------------------------------------------------------
export const COLORS = {
  navy: [12, 24, 48] as [number, number, number],      // header / footer band
  primary: [10, 70, 130] as [number, number, number],  // deep blue
  green: [21, 128, 61] as [number, number, number],     // available / certified
  red: [153, 27, 27] as [number, number, number],       // repair / expired
  amber: [161, 98, 7] as [number, number, number],      // off road / due
  grey: [90, 90, 100] as [number, number, number],      // standby / muted
  accent: [0, 200, 150] as [number, number, number],    // MARZ green accent rule
  faintRow: [248, 250, 252] as [number, number, number],
};

export interface OrgBranding {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  vat_number?: string | null;
  logo_url?: string | null;
}

/** Pull branding off the auth profile's joined organisation row. */
export function getOrgBranding(profile: any): OrgBranding {
  const o = (profile && profile.organisations) || {};
  return {
    name: o.name || "Your Organisation",
    phone: o.phone ?? null,
    email: o.email ?? null,
    address: o.address ?? null,
    vat_number: o.vat_number ?? null,
    logo_url: o.logo_url ?? null,
  };
}

// ---- Date helpers --------------------------------------------------------
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Add whole months, clamping the day to the end of the target month. */
export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  const targetMonth = x.getMonth() + months;
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(targetMonth);
  const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, lastDay));
  return x;
}

export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

// ---- Certificate status (load-test rule, reused for the badge & report) --
export type CertStatus = "CERTIFIED" | "NOT CERTIFIED" | "EXPIRED";

export interface CertStatusInput {
  expiry_date?: string | null;
  issue_date?: string | null;
  last_inspection_date?: string | null;
  inspection_interval_months?: number | null;
  certificate_type?: string | null;
}

/**
 * Rule (expiry is the hard stop; the interim inspection never extends it):
 *   EXPIRED        if today > expiry_date
 *   else CERTIFIED if last_inspection_date is set
 *   else NOT CERTIFIED if today >= issue_date + interval months
 *   else CERTIFIED (inspection not yet due)
 *
 * The interim-inspection requirement only applies when an interval is known.
 * Load-test certs default to a 6-month interim check; other cert types that
 * carry no interval are simply valid-until-expiry.
 */
export function computeCertStatus(c: CertStatusInput): CertStatus {
  const today = startOfDay(new Date());
  const expiry = c.expiry_date ? startOfDay(new Date(c.expiry_date)) : null;
  if (expiry && !isNaN(expiry.getTime()) && today.getTime() > expiry.getTime()) return "EXPIRED";
  if (c.last_inspection_date) return "CERTIFIED";
  const isLoadTest = (c.certificate_type || "").toLowerCase().includes("load test");
  const interval = c.inspection_interval_months ?? (isLoadTest ? 6 : null);
  if (c.issue_date && interval) {
    const issued = new Date(c.issue_date);
    if (!isNaN(issued.getTime())) {
      const due = startOfDay(addMonths(issued, interval));
      if (today.getTime() >= due.getTime()) return "NOT CERTIFIED";
    }
  }
  return "CERTIFIED";
}

export function certStatusColor(status: CertStatus): [number, number, number] {
  if (status === "EXPIRED") return COLORS.red;
  if (status === "NOT CERTIFIED") return COLORS.amber;
  return COLORS.green;
}

// ---- Logo loading (best-effort; degrades to no logo) ---------------------
export async function loadLogoDataUrl(
  url?: string | null
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (!url) return null;
  // We can only embed something the browser can fetch directly. Storage paths
  // (no scheme) can't be resolved here, so skip them gracefully.
  if (!/^https?:\/\//i.test(url) && !url.startsWith("data:")) return null;
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
  } catch {
    return null; // CORS-tainted or unreachable — just omit the logo
  }
}

// ---- Header --------------------------------------------------------------
export interface ReportHeaderOptions {
  org: OrgBranding;
  title: string;          // e.g. "FLEET AVAILABILITY"
  scope?: string;         // e.g. "All Sites" / a site name
  reportTag?: string;     // e.g. "MANAGER REPORT"
  logo?: { dataUrl: string; w: number; h: number } | null;
}

/** Draw the shared branded header band. Returns the Y to start body content. */
export function drawReportHeader(doc: jsPDF, opts: ReportHeaderOptions): number {
  const W = doc.internal.pageSize.getWidth();
  const bandH = 32;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });

  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, W, bandH, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, bandH, W, 2, "F");

  // Left: logo (optional) + org name
  let textX = 14;
  if (opts.logo) {
    const maxH = 18, maxW = 42;
    const ratio = opts.logo.w / opts.logo.h || 1;
    let h = maxH, w = h * ratio;
    if (w > maxW) { w = maxW; h = w / ratio; }
    const boxPad = 2;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 6, w + boxPad * 2, h + boxPad * 2, 2, 2, "F");
    try { doc.addImage(opts.logo.dataUrl, "PNG", 14 + boxPad, 6 + boxPad, w, h); } catch { /* ignore */ }
    textX = 14 + w + boxPad * 2 + 6;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(opts.org.name, textX, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(170, 200, 185);
  doc.text("Powered by MARZ Fleet · fleet.marzai.co.za", textX, 20);

  const contactBits = [opts.org.phone, opts.org.email, opts.org.address].filter(Boolean) as string[];
  if (contactBits.length) {
    let contact = contactBits.join("  ·  ");
    if (contact.length > 90) contact = contact.slice(0, 89) + "…";
    doc.setTextColor(150, 170, 160);
    doc.text(contact, textX, 26);
  }
  if (opts.org.vat_number) {
    doc.setTextColor(150, 170, 160);
    doc.text(`VAT: ${opts.org.vat_number}`, textX, 31);
  }

  // Right: title + meta
  const rightX = W - 14;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(opts.title, rightX, 13, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(200, 215, 208);
  doc.text(`${dateStr}  |  ${timeStr}`, rightX, 20, { align: "right" });
  if (opts.scope) doc.text(`Scope: ${opts.scope}`, rightX, 25.5, { align: "right" });

  if (opts.reportTag) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const tagW = doc.getTextWidth(opts.reportTag) + 6;
    doc.setFillColor(...COLORS.accent);
    doc.roundedRect(rightX - tagW, 28, tagW, 6, 1.5, 1.5, "F");
    doc.setTextColor(...COLORS.navy);
    doc.text(opts.reportTag, rightX - tagW / 2, 32, { align: "center" });
  }

  doc.setTextColor(0, 0, 0);
  return bandH + 8; // body start
}

// ---- Footer --------------------------------------------------------------
export function drawReportFooter(doc: jsPDF, org: OrgBranding, note?: string): void {
  const pageCount = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(205, 205, 215);
    doc.setLineWidth(0.2);
    doc.line(14, H - 12, W - 14, H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 130);
    doc.text(`${org.name}  ·  Powered by MARZ Technologies  ·  fleet.marzai.co.za`, 14, H - 7);
    doc.text(`Page ${i} of ${pageCount}  ·  ${note || "Confidential"}`, W - 14, H - 7, { align: "right" });
  }
}

// ---- Stat tally boxes ----------------------------------------------------
export interface StatBox {
  label: string;
  value: string;
  color: [number, number, number];
}

/** Draw a row of stat boxes. Returns the Y just below them. */
export function drawStatBoxes(doc: jsPDF, x0: number, y: number, boxes: StatBox[]): number {
  const boxW = 45, gap = 3, boxH = 16;
  boxes.forEach((s, i) => {
    const x = x0 + i * (boxW + gap);
    doc.setFillColor(...COLORS.faintRow);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "S");
    doc.setFillColor(...s.color);
    doc.rect(x, y, 3, boxH, "F");
    doc.setTextColor(...s.color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(s.value, x + 7, y + 10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(s.label, x + 7, y + 13.6);
  });
  doc.setTextColor(0, 0, 0);
  return y + boxH;
}

// ---- Coloured group band row for jspdf-autotable -------------------------
/** A full-width coloured band row (group header) for an autoTable body. */
export function bandRow(label: string, count: number, colSpan: number, color: [number, number, number]): any {
  return [{
    content: `${label}  —  ${count}`,
    colSpan,
    styles: {
      fillColor: color,
      textColor: [255, 255, 255] as any,
      fontStyle: "bold" as const,
      fontSize: 9,
      halign: "left" as const,
      cellPadding: { top: 2.4, bottom: 2.4, left: 4, right: 4 } as any,
    },
  }];
}
