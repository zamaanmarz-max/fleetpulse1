import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawHeader, drawFooter, sectionHeading, statusColor, tableHeadStyles } from "./pdfTemplate";
import { checkDriverCompliance } from "./driverCompliance";
import { resolveLicence, resolvePrdp, resolveMedical, resolveCriminal, lastToolboxStatus, docStatusLabel, ResolvedDoc } from "./driverComplianceHelpers";

interface DriverDoc {
  id?: string;
  document_type: string | null;
  document_number?: string | null;
  document_name?: string | null;
  expiry_date: string | null;
  created_at?: string | null;
}
interface ToolboxTalk {
  date_conducted: string;
  topic: string;
  conducted_by?: string | null;
}
interface DriverIncidentRow {
  incident_date?: string | null;
  incident_type?: string | null;
  status?: string | null;
  outcome?: string | null;
}

export interface DriverPdfInput {
  driver: {
    full_name: string;
    id_number?: string | null;
    phone?: string | null;
    email?: string | null;
    licence_number?: string | null;
    licence_code?: string | null;
    licence_expiry?: string | null;
    prdp_number?: string | null;
    prdp_category?: string | null;
    prdp_expiry?: string | null;
    demerit_points?: number | null;
    employment_status?: string | null;
  };
  branchName?: string;
  companyName?: string;
  documents: DriverDoc[];
  toolboxTalks: ToolboxTalk[];
  incidents?: DriverIncidentRow[];
  complianceSettings?: { toolbox_talks?: boolean; criminal_background_checks?: boolean };
}

const drawStatusPill = (doc: jsPDF, x: number, y: number, label: string) => {
  const [r, g, b] = statusColor(label);
  const w = doc.getTextWidth(label) + 6;
  doc.setFillColor(r, g, b);
  doc.roundedRect(x, y - 4, w, 6, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(label, x + 3, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return w;
};

export function generateDriverComplianceReport(input: DriverPdfInput) {
  const { driver, documents, toolboxTalks, branchName, companyName, incidents = [], complianceSettings = {} } = input;
  const doc = new jsPDF();
  let y = drawHeader(doc, {
    title: "Driver Compliance Report",
    subtitle: driver.full_name,
    branchName,
    companyName,
  });

  // Build enriched doc list for compliance calc
  const now = Date.now();
  const enriched = documents.map(d => {
    const days = d.expiry_date ? Math.ceil((new Date(d.expiry_date).getTime() - now) / 86400000) : 999;
    return { ...d, calcStatus: days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid" };
  });
  const compliance = checkDriverCompliance(
    {
      licence_expiry: driver.licence_expiry || null,
      prdp_expiry: driver.prdp_expiry || null,
      licence_number: driver.licence_number || null,
      prdp_number: driver.prdp_number || null,
    },
    enriched as any,
    toolboxTalks,
    complianceSettings
  );

  const licence = resolveLicence({ licence_expiry: driver.licence_expiry || null, licence_number: driver.licence_number || null }, documents);
  const prdp = resolvePrdp({ prdp_expiry: driver.prdp_expiry || null, prdp_number: driver.prdp_number || null }, documents);
  const medical = resolveMedical(documents);
  const criminal = resolveCriminal(documents);
  const toolbox = lastToolboxStatus(toolboxTalks);

  // ---- Compliance score banner ----
  const bannerColor = compliance.status === "compliant"
    ? statusColor("compliant")
    : compliance.status === "warning"
      ? statusColor("warning")
      : statusColor("expired");
  doc.setFillColor(...bannerColor);
  doc.roundedRect(14, y, 182, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${compliance.score}%`, 20, y + 12);
  doc.setFontSize(11);
  const statusLabel = compliance.status === "compliant" ? "COMPLIANT" : compliance.status === "warning" ? "WARNING" : "NON-COMPLIANT";
  doc.text(statusLabel, 60, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${compliance.issues.length} open issue(s)`, 195, y + 12, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 26;

  // ---- Personal details ----
  y = sectionHeading(doc, "Personal Details", y);
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 9 },
    body: [
      ["Full Name", driver.full_name || "-"],
      ["ID Number", driver.id_number || "-"],
      ["Phone", driver.phone || "-"],
      ["Email", driver.email || "-"],
      ["Branch", branchName || "-"],
      ["Employment", driver.employment_status || "active"],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40, textColor: [80, 80, 80] } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ---- Document sections (Licence, PrDP, Medical, Criminal) ----
  const docRow = (label: string, number: string, expiry: string, status: string) =>
    [label, number || "-", expiry || "-", status];

  y = sectionHeading(doc, "Documents & Certifications", y);
  autoTable(doc, {
    startY: y,
    head: [["Document", "Number", "Expiry", "Status"]],
    headStyles: tableHeadStyles,
    styles: { fontSize: 9 },
    body: [
      docRow("Driver's Licence", licence.number || driver.licence_number || "-", licence.expiry || "-", docStatusLabel(licence.status)),
      docRow(`PrDP${driver.prdp_category ? ` (${driver.prdp_category})` : ""}`, prdp.number || driver.prdp_number || "-", prdp.expiry || "-", docStatusLabel(prdp.status)),
      docRow("Medical Certificate", medical.number || "-", medical.expiry || "-", docStatusLabel(medical.status)),
      docRow("Criminal Background Check", criminal.number || "-", criminal.expiry || "-", docStatusLabel(criminal.status)),
    ],
    didParseCell: (data: any) => {
      if (data.column.index === 3 && data.section === "body") {
        const [r, g, b] = statusColor(String(data.cell.raw));
        data.cell.styles.textColor = [r, g, b];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ---- Toolbox Talks ----
  if (y > 230) { doc.addPage(); y = 20; }
  y = sectionHeading(doc, "Toolbox Talks", y);
  doc.setFontSize(9);
  doc.text(`Last talk: ${toolbox.lastDate || "Never"}${toolbox.daysSince !== null ? ` (${toolbox.daysSince}d ago)` : ""} · Status: ${toolbox.status === "valid" ? "Done" : "Overdue"}`, 14, y);
  y += 5;
  const recentTalks = toolboxTalks.slice(0, 5);
  if (recentTalks.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Date", "Topic", "Conducted By"]],
      headStyles: tableHeadStyles,
      styles: { fontSize: 9 },
      body: recentTalks.map(t => [t.date_conducted, t.topic, t.conducted_by || "-"]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.text("No toolbox talks recorded.", 14, y + 5);
    y += 12;
  }

  // ---- Demerit Points progress ----
  if (y > 240) { doc.addPage(); y = 20; }
  y = sectionHeading(doc, "AARTO Demerit Points", y);
  const points = Math.max(0, Math.min(12, driver.demerit_points ?? 0));
  doc.setFontSize(9);
  doc.text(`${points} / 12 points`, 14, y);
  // Progress bar
  const barX = 14, barY = y + 2, barW = 182, barH = 6;
  doc.setDrawColor(180, 180, 180);
  doc.setFillColor(235, 235, 235);
  doc.roundedRect(barX, barY, barW, barH, 1.5, 1.5, "F");
  const pct = points / 12;
  const fillColor: [number, number, number] = points >= 9 ? statusColor("expired") : points >= 5 ? statusColor("warning") : statusColor("valid");
  doc.setFillColor(...fillColor);
  if (pct > 0) doc.roundedRect(barX, barY, barW * pct, barH, 1.5, 1.5, "F");
  y += 14;
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(points >= 9 ? "Risk: HIGH — close to suspension" : points >= 5 ? "Risk: ELEVATED" : "Risk: LOW", 14, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  // ---- Score breakdown ----
  if (compliance.breakdown.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    y = sectionHeading(doc, "Score Breakdown", y);
    autoTable(doc, {
      startY: y,
      head: [["Issue", "Severity", "Deduction"]],
      headStyles: tableHeadStyles,
      styles: { fontSize: 9 },
      body: compliance.breakdown.map(b => [b.label, b.severity.toUpperCase(), `-${b.deduction}`]),
      didParseCell: (data: any) => {
        if (data.column.index === 1 && data.section === "body") {
          const sev = String(data.cell.raw).toLowerCase();
          if (sev === "critical") { data.cell.styles.textColor = statusColor("expired"); data.cell.styles.fontStyle = "bold"; }
          else if (sev === "warning") { data.cell.styles.textColor = statusColor("warning"); }
        }
      },
    });
  }

  drawFooter(doc);
  doc.save(`driver_${driver.full_name.replace(/\s+/g, "_")}_compliance_${new Date().toISOString().split("T")[0]}.pdf`);
}
