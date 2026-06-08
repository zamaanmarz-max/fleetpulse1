import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface JobCardData {
  jobCardNumber: string;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  clientVatNo?: string;
  contactPerson?: string;
  contactCell?: string;
  orderNo: string;
  registration: string;
  make: string;
  model: string;
  unitSerial: string;
  jobType: string;
  engineHours: string;
  standbyHours: string;
  kilometres: string;
  clientInstructions: string;
  technicianReport: string;
  technicianName: string;
  dateCommenced: string;
  timeCommenced: string;
  dateCompleted: string;
  timeCompleted: string;
  parts: Array<{ qty: string; part_no: string; description: string; supplier: string; price: string }>;
  costing: any;
  photos: string[];
}

const NAVY: [number, number, number] = [20, 35, 60];
const GREY: [number, number, number] = [110, 110, 110];
const LINE: [number, number, number] = [160, 160, 160];
const R = (n: number) => `R ${(Number(n) || 0).toFixed(2)}`;

export function generateJobCardPDF(d: JobCardData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 12;

  // outer border
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5);
  doc.rect(M, M, W - 2 * M, H - 2 * M);

  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "bold"); doc.setFontSize(9);
  doc.text("Tel:  010 496 8112", M + 3, M + 6);
  doc.setFont("times", "normal"); doc.setFontSize(7);
  doc.text("079 873 0277", M + 9, M + 9.5);
  doc.text("078 512 9294", M + 9, M + 12.5);
  doc.text("Email: info@ac-r.co.za", M + 3, M + 15.5);
  doc.text("P.O. Box 3217, Bedfordview 2008", M + 38, M + 9.5);
  doc.text("Unit 23 & 24, Commercia Business Park", M + 3, M + 19);
  doc.text("734 Setter Road, Commercia", M + 3, M + 22);

  doc.setFont("times", "bold"); doc.setFontSize(26);
  doc.text("AC & R", W / 2 + 8, M + 9, { align: "center" });
  doc.setFontSize(12);
  doc.text("REFRIGERATION", W / 2 + 8, M + 15, { align: "center" });
  doc.setFontSize(9);
  doc.text("SERVICES", W / 2 + 8, M + 19, { align: "center" });

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
  doc.text("DELIVERY NOTE", W - M - 3, M + 6, { align: "right" });
  doc.setTextColor(200, 30, 30); doc.setFontSize(16);
  doc.text(d.jobCardNumber || "", W - M - 3, M + 13, { align: "right" });

  let y = M + 26;
  doc.setDrawColor(...NAVY); doc.line(M, y, W - M, y);

  const midX = W / 2 - 6;
  const blockBottom = y + 62;
  doc.line(midX, y, midX, blockBottom);

  doc.setFontSize(8.5);
  const lx = M + 3; let ly = y + 7;
  const labelVal = (label: string, val: string, x: number, yy: number, valX: number, endX: number) => {
    doc.setTextColor(...GREY); doc.setFont("helvetica", "normal"); doc.text(label, x, yy);
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.text(val || "", valX, yy);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.1); doc.line(valX, yy + 1, endX, yy + 1);
  };
  labelVal("NAME:", d.clientName, lx, ly, lx + 18, midX - 3); ly += 9;
  labelVal("ADDRESS:", d.clientAddress || "", lx, ly, lx + 22, midX - 3); ly += 9;
  labelVal("EMAIL:", d.clientEmail || "", lx, ly, lx + 16, lx + 55);
  labelVal("VAT NO:", d.clientVatNo || "", lx + 58, ly, lx + 74, midX - 3); ly += 9;
  labelVal("CONTACT PERSON:", d.contactPerson || "", lx, ly, lx + 38, midX - 3); ly += 9;
  labelVal("CELL NO:", d.contactCell || "", lx, ly, lx + 20, midX - 3); ly += 9;
  labelVal("ORDER NO:", d.orderNo || "", lx, ly, lx + 24, midX - 3);

  const rx = midX + 4; let ry = y + 7; const rValX = rx + 34;
  const labelValR = (label: string, val: string, yy: number) => {
    doc.setTextColor(...GREY); doc.setFont("helvetica", "normal"); doc.text(label, rx, yy);
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.text(val || "", rValX, yy);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.1); doc.line(rValX, yy + 1, W - M - 3, yy + 1);
  };
  labelValR("DATE:", d.dateCompleted || d.dateCommenced || "", ry); ry += 8.8;
  labelValR("VEHICLE REG:", d.registration, ry); ry += 8.8;
  labelValR("MAKE:", d.make, ry);
  doc.setTextColor(...GREY); doc.setFont("helvetica", "normal"); doc.text("MODEL:", rx + 52, ry);
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.text(d.model || "", rx + 68, ry);
  ry += 8.8;
  labelValR("UNIT SERIAL NO:", d.unitSerial, ry); ry += 8.8;
  labelValR("ENGINE HOURS:", d.engineHours, ry); ry += 8.8;
  labelValR("STANDBY HOURS:", d.standbyHours, ry); ry += 8.8;
  labelValR("KILOMETRES:", d.kilometres, ry);

  y = blockBottom;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);

  const types = [
    { key: "inspection", label: "INSPECTION REPORT" },
    { key: "repair", label: "REPAIR" },
    { key: "scheduled", label: "SERVICE" },
    { key: "breakdown", label: "BREAKDOWN" },
  ];
  const cellW = (W - 2 * M) / 4; const rowH = 8;
  types.forEach((t, i) => {
    const cx = M + i * cellW;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.rect(cx, y, cellW, rowH);
    const boxX = cx + cellW - 9;
    doc.rect(boxX, y + 2, 5, 4);
    if (d.jobType === t.key) { doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("X", boxX + 1, y + 5.4); }
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    doc.text(t.label, cx + 2, y + 5);
  });
  y += rowH;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);

  y += 5;
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text("CLIENT'S INSTRUCTIONS:", M + 3, y);
  doc.setFont("helvetica", "normal");
  const ci = doc.splitTextToSize(d.clientInstructions || "", W - 2 * M - 6);
  doc.text(ci, M + 3, y + 5);
  y += 5 + Math.max(ci.length * 4.5, 10);
  doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y, W - M, y);

  y += 5;
  doc.setFont("helvetica", "bold"); doc.text("TECHNICIAN REPORT:", M + 3, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const tr = doc.splitTextToSize(d.technicianReport || "", W - 2 * M - 6);
  doc.text(tr, M + 3, y + 6);
  const reportEnd = 232;
  doc.setDrawColor(235, 235, 235); doc.setLineWidth(0.1);
  for (let r2 = y + 8; r2 < reportEnd; r2 += 7) doc.line(M + 3, r2, W - M - 3, r2);

  if (d.photos && d.photos.length > 0) {
    doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(d.photos.length + " photo(s) attached - viewable in MARZ Fleet app", M + 3, reportEnd - 2);
  }

  y = reportEnd;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  y += 6;
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text("TECHNICIAN'S NAME:", M + 3, y);
  doc.setFont("helvetica", "normal"); doc.text(d.technicianName || "", M + 42, y);
  y += 7; doc.setDrawColor(...NAVY); doc.line(M, y, W - M, y);
  y += 6;
  doc.setTextColor(...GREY); doc.setFontSize(8);
  doc.text("DATE COMMENCED: " + (d.dateCommenced || ""), M + 3, y);
  doc.text("TIME: " + (d.timeCommenced || ""), M + 78, y);
  doc.text("DATE COMPLETED: " + (d.dateCompleted || ""), M + 102, y);
  doc.text("TIME: " + (d.timeCompleted || ""), W - M - 24, y);
  y += 6; doc.setDrawColor(...NAVY); doc.line(M, y, W - M, y);
  y += 4;
  doc.setTextColor(...GREY); doc.setFont("helvetica", "italic"); doc.setFontSize(6);
  const terms = doc.splitTextToSize("Our Warranty terms and conditions apply. A copy of this warranty is available to all customers. Acceptance of this implies acceptance of AC & R Refrigeration Services warranty. NOT RESPONSIBLE FOR LOSS OR DAMAGE TO TRACTORS, TRAILERS, UNITS AND ACCESSORIES, IN CASE OF FIRE, THEFT OR OTHER CAUSES BEYOND OUR CONTROL.", W - 2 * M - 6);
  doc.text(terms, M + 3, y);

  // PAGE 2 landscape costing
  doc.addPage("a4", "landscape");
  const LW = 297, LM = 10;
  const c = d.costing || {};
  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "bold"); doc.setFontSize(16);
  doc.text("AC & R REFRIGERATION", LM, LM + 6);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("JOB NUMBER: " + (d.jobCardNumber || ""), LW - LM, LM + 6, { align: "right" });

  const partRows = (d.parts || []).map(p => [
    p.qty || "", p.part_no || "", p.description || "", p.supplier || "",
    p.price ? R(Number(p.price)) : "", p.price ? R((Number(p.price) || 0) * (Number(p.qty) || 1)) : "",
  ]);
  while (partRows.length < 8) partRows.push(["", "", "", "", "", ""]);

  autoTable(doc, {
    startY: LM + 12,
    head: [["QTY", "PART NO.", "DESCRIPTION", "SUPPLIER", "PRICE", "AC & R TOTAL"]],
    body: partRows,
    theme: "grid",
    headStyles: { fillColor: NAVY, fontSize: 7.5 },
    bodyStyles: { fontSize: 8, minCellHeight: 6 },
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 28 }, 2: { cellWidth: 55 }, 3: { cellWidth: 32 }, 4: { cellWidth: 24, halign: "right" }, 5: { cellWidth: 26, halign: "right" } },
    margin: { left: LM }, tableWidth: 179,
  });
  const partsEndY = (doc as any).lastAutoTable.finalY;
  autoTable(doc, {
    startY: partsEndY + 2,
    body: [["Total Parts", R(c.total_parts)], ["Less        %", ""], ["NETT TOTAL PARTS", R(c.total_parts)]],
    theme: "grid", bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 100, fontStyle: "bold" }, 1: { cellWidth: 79, halign: "right" } },
    margin: { left: LM }, tableWidth: 179,
  });

  const rightX = LM + 185;
  const miscRows = [
    ["FUEL", R(c.fuel)], ["ENGINE OIL", R(c.engine_oil)], ["COMPRESSOR OIL", R(c.compressor_oil)],
    ["REFRIGERANT", R(c.refrigerant)], ["ANTI-FREEZE", R(c.anti_freeze)], ["CONSUMABLES", R(c.consumables)],
    ["TRAVELLING  " + (c.travelling_km || 0) + " km", R(c.travelling_amount)], ["TOTAL MISCELLANEOUS", R(c.total_misc)],
  ];
  autoTable(doc, {
    startY: LM + 12,
    head: [["MISCELLANEOUS", "Amount"]],
    body: miscRows, theme: "grid",
    headStyles: { fillColor: NAVY, fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, minCellHeight: 5.5 },
    columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: 34, halign: "right" } },
    margin: { left: rightX }, tableWidth: 92,
    didParseCell: (data: any) => { if (data.row.index === miscRows.length - 1) data.cell.styles.fontStyle = "bold"; },
  });
  const miscEndY = (doc as any).lastAutoTable.finalY;

  const labourNormal = (Number(c.labour_normal_hrs) || 0) * (Number(c.labour_normal_rate) || 0);
  const labourOT = (Number(c.labour_ot_hrs) || 0) * (Number(c.labour_ot_rate) || 0);
  const specRows = [
    ["Labour: " + (c.labour_normal_hrs || 0) + " hrs @ N.T.", R(labourNormal)],
    ["Labour: " + (c.labour_ot_hrs || 0) + " hrs @ O.T.", R(labourOT)],
    ["TOTAL LABOUR", R(c.total_labour)], ["TOTAL PARTS", R(c.total_parts)],
    ["TOTAL MISCELLANEOUS", R(c.total_misc)], ["SUB TOTAL", R(c.subtotal)],
    ["ADD VAT (15%)", R(c.vat)], ["INVOICE AMOUNT", R(c.invoice_amount)],
  ];
  autoTable(doc, {
    startY: miscEndY + 3,
    head: [["SPECIFICATION OF TOTAL INVOICE COSTS", "Selling Price"]],
    body: specRows, theme: "grid",
    headStyles: { fillColor: NAVY, fontSize: 7 },
    bodyStyles: { fontSize: 7.5, minCellHeight: 5.5 },
    columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: 34, halign: "right" } },
    margin: { left: rightX }, tableWidth: 92,
    didParseCell: (data: any) => { if (data.row.index === specRows.length - 1) { data.cell.styles.fontStyle = "bold"; data.cell.styles.fontSize = 9; data.cell.styles.textColor = NAVY; } },
  });

  return doc.output("blob");
}
