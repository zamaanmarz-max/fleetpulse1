import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawHeader, drawFooter, sectionHeading, tableHeadStyles, statusColor } from "./pdfTemplate";
import { ComplianceScoreResult } from "./compliance";
import { ServiceTracker, computeTrackerStatus } from "./serviceTrackers";

interface VehicleData {
  registration_number: string;
  fleet_number?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vin_number?: string | null;
  colour?: string | null;
  vehicle_type?: string | null;
  current_odometer_km?: number | null;
  last_service_km?: number | null;
  next_service_due_km?: number | null;
  last_odometer_update?: string | null;
  equipment?: any;
  branches?: { name?: string } | null;
}

interface CertRow { certificate_type: string; certificate_number?: string | null; expiry_date?: string | null; status?: string | null; }
interface InspRow { inspection_date?: string | null; overall_condition?: string | null; total_damage_items?: number | null; new_damage_items?: number | null; has_critical_damage?: boolean | null; }
interface JobRow { work_date?: string | null; job_card_number?: string | null; job_type?: string | null; description?: string | null; workshop_name?: string | null; labour_cost?: number | string | null; parts_cost?: number | string | null; total_cost?: number | string | null; status?: string | null; }
interface DamageRow { location?: string | null; damage_type?: string | null; severity?: string | null; created_at?: string | null; resolved?: boolean | null; }

export function generateVehiclePdfReport(opts: {
  vehicle: VehicleData;
  compliance: ComplianceScoreResult;
  certificates: CertRow[];
  trackers: ServiceTracker[];
  inspections: InspRow[];
  jobCards: JobRow[];
  damageItems?: DamageRow[];
  companyName?: string;
  branchName?: string;
}) {
  const { vehicle, compliance, certificates, trackers, inspections, jobCards, damageItems = [], companyName, branchName } = opts;
  const doc = new jsPDF();
  const now = new Date();

  let y = drawHeader(doc, {
    title: `Vehicle Report — ${vehicle.registration_number}`,
    companyName,
    branchName: branchName || vehicle.branches?.name,
    subtitle: `${vehicle.make || ""} ${vehicle.model || ""}${vehicle.year ? ` (${vehicle.year})` : ""}`,
  });

  // VEHICLE INFO BLOCK
  y = sectionHeading(doc, "Vehicle Information", y);
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.2 },
    body: [
      ["Registration", vehicle.registration_number, "Fleet Number", vehicle.fleet_number || "-"],
      ["Make / Model", `${vehicle.make || "-"} ${vehicle.model || ""}`.trim(), "Year", String(vehicle.year || "-")],
      ["VIN", vehicle.vin_number || "-", "Colour", vehicle.colour || "-"],
      ["Vehicle Type", vehicle.vehicle_type || "-", "Branch", vehicle.branches?.name || "-"],
      ["Current Odometer", `${(vehicle.current_odometer_km ?? 0).toLocaleString()} km`, "Last KM Update", vehicle.last_odometer_update || "-"],
      ["Last Service KM", `${(vehicle.last_service_km ?? 0).toLocaleString()} km`, "Next Service KM", `${(vehicle.next_service_due_km ?? 0).toLocaleString()} km`],
      ["Equipment", ((vehicle.equipment as string[]) || []).join(", ") || "-", "", ""],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 32 }, 2: { fontStyle: "bold", cellWidth: 30 } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // COMPLIANCE SCORE
  y = sectionHeading(doc, `Compliance Score: ${compliance.score}% — ${compliance.status.toUpperCase()}`, y);
  if (compliance.breakdown.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(34, 139, 90);
    doc.text("No issues — vehicle is fully compliant.", 14, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Factor", "Deduction"]],
      body: compliance.breakdown.map(b => [b.label, `−${b.deduction}%`]),
      theme: "striped",
      headStyles: tableHeadStyles,
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: "right", cellWidth: 30, fontStyle: "bold" } },
      didParseCell: (data: any) => {
        if (data.column.index === 1 && data.section === "body") {
          data.cell.styles.textColor = [220, 50, 50];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // CERTIFICATES
  y = sectionHeading(doc, `Certificates (${certificates.length})`, y);
  if (certificates.length === 0) {
    doc.setFontSize(9); doc.setTextColor(110); doc.text("No certificates on file.", 14, y); doc.setTextColor(0); y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Type", "Number", "Expiry", "Days Left", "Status"]],
      body: certificates.map(c => {
        const days = c.expiry_date ? Math.ceil((new Date(c.expiry_date).getTime() - now.getTime()) / 86400000) : null;
        const statusText = days === null ? (c.status || "valid") : days <= 0 ? "EXPIRED" : days <= 30 ? "EXPIRING" : "VALID";
        return [c.certificate_type, c.certificate_number || "-", c.expiry_date || "-", days === null ? "-" : days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`, statusText];
      }),
      theme: "striped",
      headStyles: tableHeadStyles,
      styles: { fontSize: 9 },
      didParseCell: (data: any) => {
        if (data.column.index === 4 && data.section === "body") {
          const c = statusColor(String(data.cell.raw));
          data.cell.styles.textColor = c;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // SERVICE TRACKERS
  y = sectionHeading(doc, `Custom Service Trackers (${trackers.length})`, y);
  if (trackers.length === 0) {
    doc.setFontSize(9); doc.setTextColor(110); doc.text("No custom service trackers.", 14, y); doc.setTextColor(0); y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Tracker", "Type", "Last Done", "Next Due", "Status"]],
      body: trackers.map(t => {
        const s = computeTrackerStatus(t, vehicle.current_odometer_km ?? 0);
        const next = t.tracking_type === "days" ? (t.next_due_date || "-") : `${Number(t.next_due_value || 0).toLocaleString()}${t.tracking_type === "km" ? " km" : " hrs"}`;
        return [t.tracker_name, t.tracking_type, t.last_done_date || "-", next, s.status === "overdue" ? "OVERDUE" : s.status === "due_soon" ? "DUE SOON" : "OK"];
      }),
      theme: "striped",
      headStyles: tableHeadStyles,
      styles: { fontSize: 9 },
      didParseCell: (data: any) => {
        if (data.column.index === 4 && data.section === "body") {
          const c = statusColor(String(data.cell.raw));
          data.cell.styles.textColor = c;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // LAST 3 INSPECTIONS
  const last3 = inspections.slice(0, 3);
  y = sectionHeading(doc, `Last 3 Inspections`, y);
  if (last3.length === 0) {
    doc.setFontSize(9); doc.setTextColor(110); doc.text("No inspections on record.", 14, y); doc.setTextColor(0); y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Date", "Condition", "Items", "New", "Critical"]],
      body: last3.map(i => [
        i.inspection_date || "-",
        (i.overall_condition || "-").toUpperCase(),
        String(i.total_damage_items ?? 0),
        String(i.new_damage_items ?? 0),
        i.has_critical_damage ? "YES" : "No",
      ]),
      theme: "striped",
      headStyles: tableHeadStyles,
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // JOB CARDS
  const last5Jobs = jobCards.slice(0, 5);
  const totalSpend = jobCards.reduce((s, j) => s + (Number(j.total_cost) || 0), 0);
  y = sectionHeading(doc, `Last 5 Job Cards — Total Spend: R ${totalSpend.toLocaleString()}`, y);
  if (jobCards.length === 0) {
    doc.setFontSize(9); doc.setTextColor(110); doc.text("No maintenance records.", 14, y); doc.setTextColor(0);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Job Card", "Work", "Workshop", "Labour", "Parts", "Total", "Status"]],
      body: last5Jobs.map(j => [j.job_card_number || j.work_date || "-", j.description || j.job_type || "-", j.workshop_name || "-", `R ${(Number(j.labour_cost) || 0).toLocaleString()}`, `R ${(Number(j.parts_cost) || 0).toLocaleString()}`, `R ${(Number(j.total_cost) || 0).toLocaleString()}`, (j.status || "-").toUpperCase()]),
      theme: "striped",
      headStyles: tableHeadStyles,
      styles: { fontSize: 8 },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  y = sectionHeading(doc, `Unresolved Damage Items (${damageItems.length})`, y);
  if (damageItems.length === 0) {
    doc.setFontSize(9); doc.setTextColor(34, 139, 90); doc.text("No unresolved damage items.", 14, y); doc.setTextColor(0);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Location", "Type", "Severity", "Reported", "Status"]],
      body: damageItems.map(d => [d.location || "-", d.damage_type || "-", (d.severity || "-").toUpperCase(), d.created_at ? d.created_at.split("T")[0] : "-", d.resolved ? "RESOLVED" : "OPEN"]),
      theme: "striped",
      headStyles: tableHeadStyles,
      styles: { fontSize: 9 },
    });
  }

  drawFooter(doc);
  doc.save(`vehicle_${vehicle.registration_number.replace(/\s+/g, "_")}_${now.toISOString().split("T")[0]}.pdf`);
}
