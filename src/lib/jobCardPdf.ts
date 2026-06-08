import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface JobCardData {
  jobCardNumber: string;
  clientName: string;
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

const NAVY = [15, 30, 55] as const;
const GREY = [90, 90, 90] as const;

export function generateJobCardPDF(d: JobCardData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 14;

  // ---------- PAGE 1: WHITE (Delivery Note) ----------
  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("AC & R", M, 13);
  doc.setFontSize(11);
  doc.text("REFRIGERATION SERVICES", M, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Unit 23 & 24, Commercia Business Park, 734 Setter Road, Commercia", M, 25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DELIVERY NOTE", W - M, 12, { align: "right" });
  doc.setTextColor(220, 50, 50);
  doc.setFontSize(15);
  doc.text(d.jobCardNumber || "", W - M, 20, { align: "right" });

  let y = 36;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  // Two-column info block
  const leftRows = [
    ["Name", d.clientName],
    ["Order No", d.orderNo],
    ["Technician", d.technicianName],
  ];
  const rightRows = [
    ["Vehicle Reg", d.registration],
    ["Make / Model", `${d.make} ${d.model}`.trim()],
    ["Unit Serial No", d.unitSerial],
    ["Engine Hours", d.engineHours],
    ["Standby Hours", d.standbyHours],
    ["Kilometres", d.kilometres],
  ];

  const col2x = W / 2 + 2;
  let ly = y, ry = y;
  doc.setFont("helvetica", "normal");
  leftRows.forEach(([label, val]) => {
    doc.setTextColor(...GREY); doc.text(`${label}:`, M, ly);
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.text(val || "—", M + 26, ly); doc.setFont("helvetica", "normal");
    ly += 7;
  });
  rightRows.forEach(([label, val]) => {
    doc.setTextColor(...GREY); doc.text(`${label}:`, col2x, ry);
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.text(val || "—", col2x + 30, ry); doc.setFont("helvetica", "normal");
    ry += 7;
  });
  y = Math.max(ly, ry) + 2;

  // Job type badges
  const types = ["inspection", "repair", "scheduled", "breakdown"];
  const typeLabels: Record<string, string> = { inspection: "INSPECTION", repair: "REPAIR", scheduled: "SERVICE", breakdown: "BREAKDOWN" };
  let tx = M;
  types.forEach(t => {
    const active = d.jobType === t;
    if (active) { doc.setFillColor(...NAVY); doc.rect(tx, y - 4, 44, 7, "F"); doc.setTextColor(255, 255, 255); }
    else { doc.setDrawColor(180, 180, 180); doc.rect(tx, y - 4, 44, 7); doc.setTextColor(120, 120, 120); }
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text(typeLabels[t], tx + 22, y, { align: "center" });
    tx += 46;
  });
  y += 10;

  // Client instructions
  doc.setTextColor(...GREY); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("CLIENT'S INSTRUCTIONS", M, y); y += 5;
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
  const ci = doc.splitTextToSize(d.clientInstructions || "—", W - 2 * M);
  doc.text(ci, M, y); y += ci.length * 5 + 4;

  // Technician report
  doc.setTextColor(...GREY); doc.setFont("helvetica", "bold");
  doc.text("TECHNICIAN REPORT", M, y); y += 5;
  doc.setDrawColor(220, 220, 220);
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
  const tr = doc.splitTextToSize(d.technicianReport || "—", W - 2 * M);
  doc.text(tr, M, y); y += tr.length * 5 + 6;

  // Dates
  doc.setTextColor(...GREY); doc.setFontSize(8);
  doc.text(`Date Commenced: ${d.dateCommenced || "—"} ${d.timeCommenced || ""}`, M, y);
  doc.text(`Date Completed: ${d.dateCompleted || "—"} ${d.timeCompleted || ""}`, col2x, y);
  y += 8;

  // Photos
  // (photos are remote URLs; we add a note referencing them since async image loading
  //  in jsPDF requires preloading — office can also view them in the app)
  if (d.photos && d.photos.length > 0) {
    doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`${d.photos.length} photo(s) attached — viewable in MARZ Fleet app`, M, y);
    y += 6;
  }

  // Footer
  doc.setTextColor(...GREY); doc.setFont("helvetica", "italic"); doc.setFontSize(6.5);
  const terms = doc.splitTextToSize("Our Warranty terms and conditions apply. A copy of this warranty is available to all customers. Acceptance of this implies acceptance of AC & R Refrigeration Services warranty. NOT RESPONSIBLE FOR LOSS OR DAMAGE TO TRACTORS, TRAILERS, UNITS AND ACCESSORIES, IN CASE OF FIRE, THEFT OR OTHER CAUSES BEYOND OUR CONTROL.", W - 2 * M);
  doc.text(terms, M, 280);

  // ---------- PAGE 2: YELLOW (Costing) ----------
  doc.addPage();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 16, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("AC & R REFRIGERATION", M, 11);
  doc.setFontSize(9);
  doc.text(`Job ${d.jobCardNumber || ""}`, W - M, 11, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y2 = 24;

  // Parts table
  const partRows = (d.parts || []).map(p => [p.qty || "", p.part_no || "", p.description || "", p.supplier || "", p.price ? `R ${Number(p.price).toFixed(2)}` : ""]);
  autoTable(doc, {
    startY: y2,
    head: [["Qty", "Part No.", "Description", "Supplier", "Price"]],
    body: partRows.length ? partRows : [["", "", "No parts recorded", "", ""]],
    theme: "grid",
    headStyles: { fillColor: [15, 30, 55], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: M, right: M },
  });
  y2 = (doc as any).lastAutoTable.finalY + 8;

  // Costing summary
  const c = d.costing || {};
  const costRows = [
    ["Total Parts", `R ${(c.total_parts || 0).toFixed(2)}`],
    ["Fuel", `R ${(parseFloat(c.fuel) || 0).toFixed(2)}`],
    ["Engine Oil", `R ${(parseFloat(c.engine_oil) || 0).toFixed(2)}`],
    ["Compressor Oil", `R ${(parseFloat(c.compressor_oil) || 0).toFixed(2)}`],
    ["Refrigerant", `R ${(parseFloat(c.refrigerant) || 0).toFixed(2)}`],
    ["Anti-Freeze", `R ${(parseFloat(c.anti_freeze) || 0).toFixed(2)}`],
    ["Consumables", `R ${(parseFloat(c.consumables) || 0).toFixed(2)}`],
    ["Travelling", `${c.travelling_km || 0} km — R ${(parseFloat(c.travelling_amount) || 0).toFixed(2)}`],
    ["Total Labour", `R ${(c.total_labour || 0).toFixed(2)}`],
    ["Total Miscellaneous", `R ${(c.total_misc || 0).toFixed(2)}`],
    ["Subtotal", `R ${(c.subtotal || 0).toFixed(2)}`],
    ["VAT (15%)", `R ${(c.vat || 0).toFixed(2)}`],
    ["INVOICE AMOUNT", `R ${(c.invoice_amount || 0).toFixed(2)}`],
  ];
  autoTable(doc, {
    startY: y2,
    body: costRows,
    theme: "plain",
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80, textColor: [90, 90, 90] }, 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: M, right: M },
    didParseCell: (data: any) => {
      if (data.row.index === costRows.length - 1) { data.cell.styles.fontStyle = "bold"; data.cell.styles.fontSize = 11; data.cell.styles.textColor = [15, 30, 55]; }
    },
  });

  return doc.output("blob");
}
