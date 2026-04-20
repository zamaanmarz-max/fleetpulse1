import jsPDF from "jspdf";

export interface PdfHeaderOptions {
  title: string;
  companyName?: string;
  branchName?: string;
  subtitle?: string;
}

const COLOR_PRIMARY: [number, number, number] = [10, 70, 130];     // deep blue
const COLOR_ACCENT: [number, number, number] = [220, 50, 50];      // red
const COLOR_SUCCESS: [number, number, number] = [34, 139, 90];     // green
const COLOR_WARNING: [number, number, number] = [200, 140, 30];    // amber
const COLOR_MUTED: [number, number, number] = [110, 110, 110];

/** Draw the standard MARZ Fleet header. Returns Y position to start body content. */
export function drawHeader(doc: jsPDF, opts: PdfHeaderOptions): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  // Brand block
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("MARZ Fleet", 14, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR_MUTED);
  doc.text("by MARZ Technologies", 14, 26);

  // Right-aligned date
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  const dateStr = `Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  doc.text(dateStr, pageWidth - 14, 20, { align: "right" });
  if (opts.companyName) {
    doc.text(opts.companyName, pageWidth - 14, 26, { align: "right" });
  }

  // Report title
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(opts.title, 14, 40);

  if (opts.subtitle || opts.branchName) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_MUTED);
    const sub = [opts.branchName ? `Branch: ${opts.branchName}` : null, opts.subtitle].filter(Boolean).join(" · ");
    doc.text(sub, 14, 46);
  }

  // Divider
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(14, 50, pageWidth - 14, 50);

  doc.setTextColor(0, 0, 0);
  return 56;
}

/** Apply standard footer to ALL pages. Call this LAST, before save. */
export function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const stamp = new Date().toLocaleString();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // top border of footer
    doc.setDrawColor(...COLOR_MUTED);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_MUTED);

    doc.text("Confidential — MARZ Fleet", 14, pageHeight - 9);
    doc.text(stamp, pageWidth / 2, pageHeight - 9, { align: "center" });
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 9, { align: "right" });

    doc.text("© 2026 MARZ Technologies (Pty) Ltd. All rights reserved.", pageWidth / 2, pageHeight - 5, { align: "center" });
  }
}

/** Standard table head colour for autoTable */
export const tableHeadStyles = { fillColor: COLOR_PRIMARY, textColor: 255 as any, fontStyle: "bold" as const };

export function statusColor(status: string): [number, number, number] {
  const s = status.toLowerCase();
  if (s.includes("expired") || s.includes("critical") || s.includes("overdue")) return COLOR_ACCENT;
  if (s.includes("expiring") || s.includes("warning") || s.includes("due")) return COLOR_WARNING;
  if (s.includes("valid") || s.includes("compliant") || s.includes("ok") || s.includes("repaired")) return COLOR_SUCCESS;
  return [60, 60, 60];
}

/** Add a section heading inside the body. Returns next Y. */
export function sectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(text, 14, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 6;
}
