import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  OrgBranding, COLORS, bandRow, computeCertStatus, certStatusColor, fmtDate,
  drawReportHeader, drawReportFooter, drawStatBoxes, loadLogoDataUrl, CertStatus,
  startOfDay,
} from "./reportBranding";

export interface CertReportVehicle {
  id: string;
  registration_number?: string | null;
  make?: string | null;
  model?: string | null;
  vehicle_type?: string | null;
  fleet_number?: string | null;
}

export interface CertReportCert {
  vehicle_id?: string | null;
  certificate_type?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  last_inspection_date?: string | null;
  inspection_interval_months?: number | null;
  vehicles?: { registration_number?: string | null } | null;
}

export interface GenerateCertReportArgs {
  certType: string;                       // exact certificate_type to export
  certificates: CertReportCert[];         // full list (filtered inside)
  vehicleMap: Map<string, CertReportVehicle>;
  org: OrgBranding;
}

const TYPE_ORDER: Record<string, number> = { horse: 0, rigid: 1, other: 2, trailer: 3 };
const TYPE_LABEL: Record<string, string> = {
  horse: "HORSES", rigid: "RIGIDS", other: "OTHER UNITS", trailer: "TRAILERS",
};

export function prettifyCertType(t: string): string {
  return (t || "Certificate")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export async function generateCertificateReport(args: GenerateCertReportArgs): Promise<void> {
  const { certType, certificates, vehicleMap, org } = args;

  // The 6-month interim inspection / Certified-vs-Not-Certified ruling is unique
  // to load-test certificates. Every other certificate type is simply
  // valid-until-expiry, so those reports drop the inspection column entirely and
  // use a plain VALID / EXPIRED status.
  const isLoadTest = (certType || "").toLowerCase().includes("load test");

  const simpleStatus = (expiry?: string | null): "VALID" | "EXPIRED" => {
    if (!expiry) return "VALID";
    const e = startOfDay(new Date(expiry));
    if (isNaN(e.getTime())) return "VALID";
    return startOfDay(new Date()).getTime() > e.getTime() ? "EXPIRED" : "VALID";
  };

  const rowsData = certificates
    .filter((c) => (c.certificate_type || "") === certType)
    .map((c) => {
      const v = (c.vehicle_id && vehicleMap.get(c.vehicle_id)) || null;
      const reg = v?.registration_number || c.vehicles?.registration_number || "—";
      const makeModel = [v?.make, v?.model].filter(Boolean).join(" ").trim();
      const vType = (v?.vehicle_type || "other").toLowerCase();
      const status: string = isLoadTest ? computeCertStatus(c) : simpleStatus(c.expiry_date);
      return {
        reg,
        makeType: makeModel ? `${makeModel}${v?.vehicle_type ? ` · ${v.vehicle_type}` : ""}` : (v?.vehicle_type || "—"),
        vType: TYPE_ORDER[vType] !== undefined ? vType : "other",
        fleetNum: parseInt(v?.fleet_number || "") || 99999,
        issue: fmtDate(c.issue_date),
        expiry: fmtDate(c.expiry_date),
        inspection: c.last_inspection_date ? fmtDate(c.last_inspection_date) : "—",
        status,
      };
    })
    .sort((a, b) => {
      const ta = TYPE_ORDER[a.vType] ?? 9, tb = TYPE_ORDER[b.vType] ?? 9;
      if (ta !== tb) return ta - tb;
      if (a.fleetNum !== b.fleetNum) return a.fleetNum - b.fleetNum;
      return a.reg.localeCompare(b.reg);
    });

  const doc = new jsPDF({ orientation: "landscape" });
  const logo = await loadLogoDataUrl(org.logo_url);
  const prettyType = prettifyCertType(certType);

  const startY = drawReportHeader(doc, {
    org,
    title: prettyType.toUpperCase(),
    scope: "All Sites",
    reportTag: "CERTIFICATE REPORT",
    logo,
  });

  // Tally — load test has a third "not certified" state; others are valid/expired.
  let afterStats: number;
  if (isLoadTest) {
    const counts: Record<CertStatus, number> = { CERTIFIED: 0, "NOT CERTIFIED": 0, EXPIRED: 0 };
    rowsData.forEach((r) => { counts[r.status as CertStatus]++; });
    afterStats = drawStatBoxes(doc, 14, startY, [
      { label: "Total", value: String(rowsData.length), color: COLORS.primary },
      { label: "Certified", value: String(counts.CERTIFIED), color: COLORS.green },
      { label: "Not Certified", value: String(counts["NOT CERTIFIED"]), color: COLORS.amber },
      { label: "Expired", value: String(counts.EXPIRED), color: COLORS.red },
    ]);
  } else {
    const valid = rowsData.filter((r) => r.status === "VALID").length;
    const expired = rowsData.filter((r) => r.status === "EXPIRED").length;
    afterStats = drawStatBoxes(doc, 14, startY, [
      { label: "Total", value: String(rowsData.length), color: COLORS.primary },
      { label: "Valid", value: String(valid), color: COLORS.green },
      { label: "Expired", value: String(expired), color: COLORS.red },
    ]);
  }

  const NCOLS = isLoadTest ? 6 : 5;
  const statusColIdx = isLoadTest ? 5 : 4;
  const body: any[] = [];
  let lastType: string | null = null;
  const groupCount = (vt: string) => rowsData.filter((r) => r.vType === vt).length;

  if (rowsData.length === 0) {
    body.push([{ content: "No certificates of this type on record.", colSpan: NCOLS, styles: { halign: "center", textColor: COLORS.grey, fontStyle: "italic" } }]);
  } else {
    rowsData.forEach((r) => {
      if (r.vType !== lastType) {
        lastType = r.vType;
        const bandColor = r.vType === "trailer" ? COLORS.primary : COLORS.navy;
        body.push(bandRow(TYPE_LABEL[r.vType] || "UNITS", groupCount(r.vType), NCOLS, bandColor));
      }
      body.push(
        isLoadTest
          ? [r.reg, r.makeType, r.issue, r.expiry, r.inspection, r.status]
          : [r.reg, r.makeType, r.issue, r.expiry, r.status]
      );
    });
  }

  const head = isLoadTest
    ? [["Reg", "Make / Type", "Last Tested", "Expiry", "6-Month Inspection", "Status"]]
    : [["Reg", "Make / Type", "Issued", "Expiry", "Status"]];

  const columnStyles: Record<number, any> = isLoadTest
    ? {
        0: { cellWidth: 34, fontStyle: "bold" },
        1: { cellWidth: 80 },
        2: { cellWidth: 38, halign: "center" },
        3: { cellWidth: 37, halign: "center" },
        4: { cellWidth: 42, halign: "center" },
        5: { cellWidth: 38, halign: "center", fontStyle: "bold" },
      }
    : {
        0: { cellWidth: 36, fontStyle: "bold" },
        1: { cellWidth: 99 },
        2: { cellWidth: 44, halign: "center" },
        3: { cellWidth: 44, halign: "center" },
        4: { cellWidth: 46, halign: "center", fontStyle: "bold" },
      };

  autoTable(doc, {
    startY: afterStats + 6,
    head,
    body,
    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [225, 228, 235], lineWidth: 0.1, valign: "middle" },
    headStyles: { fillColor: COLORS.navy, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: COLORS.faintRow },
    columnStyles,
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === statusColIdx) {
        const val = (d.cell.text[0] || "");
        if (val === "CERTIFIED" || val === "NOT CERTIFIED" || val === "EXPIRED") {
          d.cell.styles.textColor = certStatusColor(val as CertStatus);
        } else if (val === "VALID") {
          d.cell.styles.textColor = COLORS.green;
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  drawReportFooter(doc, org, "Certificate Report");

  const safeType = prettyType.replace(/[^A-Za-z0-9]+/g, "_");
  const safeOrg = (org.name || "Org").replace(/[^A-Za-z0-9]+/g, "_");
  doc.save(`${safeOrg}_${safeType}_Report_${new Date().toISOString().split("T")[0]}.pdf`);
}
