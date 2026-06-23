import jsPDF from "jspdf";

interface JobCardData {
  jobCardNumber: string;
  // ----- logged-in company branding (read per-org, no longer hardcoded) -----
  orgName: string;
  orgPhone?: string;
  orgEmail?: string;
  orgVat?: string;
  orgAddress?: string;
  orgLogoUrl?: string | null;
  // ----- client -----
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
  // simplified: part name + quantity only
  parts: Array<{ name: string; qty: string }>;
  photos: string[];
  signature?: string | null;
  signName?: string;
  noSignature?: boolean;
}

const NAVY: [number, number, number] = [20, 35, 60];
const GREY: [number, number, number] = [110, 110, 110];
const LINE: [number, number, number] = [160, 160, 160];

// load a remote image as a data URL so jsPDF can embed it
async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = data;
    });
    return { data, w: dims.w, h: dims.h };
  } catch { return null; }
}

export async function generateJobCardPDF(d: JobCardData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 12;
  const company = (d.orgName || "").trim() || "Company";

  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5);
  doc.rect(M, M, W - 2 * M, H - 2 * M);

  // ===== HEADER: per-org branding =====
  // Left column: contact details (only render what the org actually has)
  doc.setTextColor(0, 0, 0);
  let hy = M + 6;
  const leftX = M + 3;
  doc.setFont("times", "normal"); doc.setFontSize(8);
  if (d.orgPhone) { doc.setFont("times", "bold"); doc.text(`Tel: ${d.orgPhone}`, leftX, hy); doc.setFont("times", "normal"); hy += 4; }
  if (d.orgEmail) { doc.text(`Email: ${d.orgEmail}`, leftX, hy); hy += 4; }
  if (d.orgAddress) {
    const addrLines = doc.splitTextToSize(d.orgAddress, W / 2 - M - 8);
    doc.text(addrLines, leftX, hy); hy += addrLines.length * 4;
  }
  if (d.orgVat) { doc.text(`VAT No: ${d.orgVat}`, leftX, hy); hy += 4; }

  // Centre: company wordmark (or logo if the org has uploaded one)
  let logoDrawn = false;
  if (d.orgLogoUrl) {
    const logo = await loadImage(d.orgLogoUrl);
    if (logo) {
      const maxW = 55, maxH = 20;
      const ratio = logo.h / logo.w;
      let lw = maxW, lh = maxW * ratio;
      if (lh > maxH) { lh = maxH; lw = maxH / ratio; }
      try { doc.addImage(logo.data, "PNG", W / 2 - lw / 2, M + 2, lw, lh); logoDrawn = true; } catch { /* fall back to text */ }
    }
  }
  if (!logoDrawn) {
    // size the wordmark down for long names so it never collides with the columns
    const nameSize = company.length <= 16 ? 24 : company.length <= 24 ? 18 : company.length <= 34 ? 14 : 11;
    doc.setFont("times", "bold"); doc.setFontSize(nameSize); doc.setTextColor(...NAVY);
    const nameLines = doc.splitTextToSize(company.toUpperCase(), 90);
    doc.text(nameLines, W / 2 + 6, M + 10, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  // Right column: delivery note + job number
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
  y += 5 + Math.max(ci.length * 4.5, 8);
  doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y, W - M, y);

  y += 5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text("TECHNICIAN REPORT:", M + 3, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const tr = doc.splitTextToSize(d.technicianReport || "", W - 2 * M - 6);
  doc.text(tr, M + 3, y + 6);
  y = y + 6 + tr.length * 4.5 + 4;

  // ===== PARTS USED (name + qty only) =====
  const usedParts = (d.parts || []).filter(p => (p.name || "").trim());
  if (usedParts.length > 0 && y < 224) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    doc.text("PARTS USED:", M + 3, y);
    y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    // keep it inside the page; if the list is long, summarise the overflow
    const maxRows = Math.max(0, Math.floor((228 - y) / 4.4));
    const shown = usedParts.slice(0, maxRows);
    shown.forEach((p) => {
      const qty = (p.qty || "").trim();
      doc.text(`•  ${qty ? `${qty} ×  ` : ""}${p.name}`, M + 5, y);
      y += 4.4;
    });
    if (usedParts.length > shown.length) {
      doc.setTextColor(...GREY);
      doc.text(`+ ${usedParts.length - shown.length} more part(s)`, M + 5, y);
      doc.setTextColor(0, 0, 0);
      y += 4.4;
    }
  }

  // Signature block on page 1
  const sigY = 232;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(M, sigY, W - M, sigY);
  let sy = sigY + 6;
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text("TECHNICIAN'S NAME:", M + 3, sy);
  doc.setFont("helvetica", "normal"); doc.text(d.technicianName || "", M + 42, sy);

  // customer signature
  if (d.noSignature) {
    doc.setFont("helvetica", "italic"); doc.setTextColor(...GREY);
    doc.text("Customer signature: No customer available to sign", M + 105, sy);
  } else if (d.signature) {
    try { doc.addImage(d.signature, "PNG", M + 105, sy - 5, 45, 16); } catch { /* ignore bad sig */ }
    doc.setDrawColor(...LINE); doc.line(M + 105, sy + 12, M + 150, sy + 12);
    doc.setFontSize(7); doc.setTextColor(...GREY);
    doc.text(`Signed: ${d.signName || ""}`, M + 105, sy + 15);
  }

  sy += 20;
  doc.setDrawColor(...NAVY); doc.line(M, sy, W - M, sy);
  sy += 5;
  doc.setTextColor(...GREY); doc.setFontSize(8);
  doc.text("DATE COMMENCED: " + (d.dateCommenced || ""), M + 3, sy);
  doc.text("TIME: " + (d.timeCommenced || ""), M + 70, sy);
  doc.text("DATE COMPLETED: " + (d.dateCompleted || ""), M + 100, sy);
  doc.text("TIME: " + (d.timeCompleted || ""), W - M - 22, sy);
  sy += 5;
  doc.setDrawColor(...NAVY); doc.line(M, sy, W - M, sy);
  sy += 4;
  doc.setFont("helvetica", "italic"); doc.setFontSize(5.5);
  const terms = doc.splitTextToSize(`Our Warranty terms and conditions apply. A copy of this warranty is available to all customers. Acceptance of this implies acceptance of ${company} warranty. NOT RESPONSIBLE FOR LOSS OR DAMAGE TO TRACTORS, TRAILERS, UNITS AND ACCESSORIES, IN CASE OF FIRE, THEFT OR OTHER CAUSES BEYOND OUR CONTROL.`, W - 2 * M - 6);
  doc.text(terms, M + 3, sy);

  // ===== PHOTO PAGES (embedded) =====
  if (d.photos && d.photos.length > 0) {
    doc.addPage("a4", "portrait");
    doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(`Job Card #${d.jobCardNumber} — Photos`, M, M + 6);
    let px = M, py = M + 14;
    const cellWp = (W - 2 * M - 6) / 2;
    const cellHp = 65;
    let count = 0;
    for (const url of d.photos) {
      const img = await loadImage(url);
      if (img) {
        const ratio = img.h / img.w;
        let dw = cellWp, dh = cellWp * ratio;
        if (dh > cellHp) { dh = cellHp; dw = cellHp / ratio; }
        try { doc.addImage(img.data, "JPEG", px + (cellWp - dw) / 2, py, dw, dh); } catch { /* skip bad image */ }
      }
      count++;
      if (count % 2 === 0) { px = M; py += cellHp + 6; }
      else { px = M + cellWp + 6; }
      if (py > H - cellHp - M && count < d.photos.length) { doc.addPage("a4", "portrait"); px = M; py = M + 6; }
    }
  }

  return doc.output("blob");
}
