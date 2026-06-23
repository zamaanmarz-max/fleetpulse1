import { jsPDF } from "jspdf";

interface JobCardData {
  jobCardNumber: string;
  // ----- logged-in company branding (read per-org, never hardcoded) -----
  orgName: string;
  orgPhone?: string;
  orgEmail?: string;
  orgVat?: string;
  orgAddress?: string;
  orgLogoUrl?: string | null;
  industry?: string;
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
  parts: Array<{ name: string; qty: string }>;
  photos: string[];
  signature?: string | null;
  signName?: string;
  noSignature?: boolean;
}

// ---- palette (MARZ Fleet job card) ----
type RGB = [number, number, number];
const NAVY: RGB = [21, 49, 79];
const NAVY_SOFT: RGB = [42, 70, 104];
const AMBER: RGB = [230, 145, 42];
const GREEN: RGB = [31, 160, 110];
const INK: RGB = [30, 36, 45];
const MUTED: RGB = [125, 134, 146];
const LINE: RGB = [223, 228, 234];
const CARD: RGB = [248, 250, 252];

const W = 210, H = 297, M = 14;
const CONTENT_W = W - 2 * M;

const JOB_LABELS: Record<string, string> = {
  inspection: "Inspection", repair: "Repair", scheduled: "Service", breakdown: "Breakdown",
};

function industrySubtitle(industry?: string): string {
  switch ((industry || "").toLowerCase()) {
    case "electrical": return "Auto Electrical Specialists";
    case "refrigeration": return "Transport Refrigeration Specialists";
    case "transport": return "Fleet & Logistics Services";
    default: return "Fleet Service Specialists";
  }
}

function initials(name: string): string {
  const words = (name || "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "MF";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function fmtDate(s?: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
}

// split a free-text technician report into clean numbered work items
function workItems(report: string): string[] {
  const raw = (report || "").trim();
  if (!raw) return [];
  let parts = raw.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  // strip any leading "1." / "1)" / "-" / "•" the tech may have typed
  parts = parts.map(s => s.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean);
  if (parts.length <= 1) {
    // one block — break on sentence boundaries so it still reads as a checklist
    const sentences = raw.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(s => s.trim()).filter(Boolean);
    if (sentences.length > 1) return sentences;
  }
  return parts.length ? parts : [raw];
}

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
  const company = (d.orgName || "").trim() || "MARZ Fleet";

  const sd = (c: RGB) => doc.setDrawColor(...c);
  const sf = (c: RGB) => doc.setFillColor(...c);
  const st = (c: RGB) => doc.setTextColor(...c);
  const font = (style: "normal" | "bold" | "italic", size: number) => { doc.setFont("helvetica", style); doc.setFontSize(size); };

  // ===================== HEADER =====================
  // logo badge (org logo if available, otherwise a navy monogram)
  let logoDrawn = false;
  if (d.orgLogoUrl) {
    const logo = await loadImage(d.orgLogoUrl);
    if (logo) {
      const s = 16, ratio = logo.h / logo.w;
      let lw = s, lh = s * ratio; if (lh > s) { lh = s; lw = s / ratio; }
      try { doc.addImage(logo.data, "PNG", M, 16, lw, lh); logoDrawn = true; } catch { /* fall back */ }
    }
  }
  if (!logoDrawn) {
    sf(NAVY); doc.circle(M + 8, 23, 8, "F");
    st([255, 255, 255]); font("bold", 13);
    doc.text(initials(company), M + 8, 25.4, { align: "center" });
  }

  // company name + subtitle
  st(NAVY); font("bold", 17);
  const nameMax = 95;
  let nameSize = 17;
  while (doc.getTextWidth(company.toUpperCase()) > nameMax && nameSize > 10) { nameSize -= 0.5; font("bold", nameSize); }
  doc.text(company.toUpperCase(), M + 21, 22);
  st(MUTED); font("bold", 7.5);
  doc.text(industrySubtitle(d.industry).toUpperCase(), M + 21, 27.5);

  // right-aligned contact block
  const rX = W - M;
  st(MUTED); font("normal", 8);
  let hy = 18;
  if (d.orgAddress) { doc.text(d.orgAddress, rX, hy, { align: "right" }); hy += 4.2; }
  const phone = (d.orgPhone || "").trim();
  if (phone) {
    let phoneLine = `Tel ${phone}`;
    if (phone.includes("/")) { const [a, b] = phone.split("/").map(s => s.trim()); phoneLine = `Tel ${a}  ·  Cell ${b}`; }
    doc.text(phoneLine, rX, hy, { align: "right" }); hy += 4.2;
  }
  if (d.orgEmail) { doc.text(d.orgEmail, rX, hy, { align: "right" }); hy += 4.2; }
  if (d.orgVat) { st(INK); font("bold", 8); doc.text(`VAT No. ${d.orgVat}`, rX, hy, { align: "right" }); hy += 4.2; }

  // two-tone divider (navy -> amber) under the header
  const divY = Math.max(34, hy + 1);
  sf(NAVY); doc.rect(M, divY, CONTENT_W * 0.64, 1.3, "F");
  sf(AMBER); doc.rect(M + CONTENT_W * 0.64, divY, CONTENT_W * 0.36, 1.3, "F");

  // ===================== TITLE ROW =====================
  let y = divY + 12;
  st(NAVY); font("bold", 23);
  doc.text("JOB CARD", M, y);
  const refText = d.orderNo ? `Ref: ${d.orderNo}` : (d.clientInstructions ? "" : "");
  if (refText) { st(MUTED); font("normal", 9); doc.text(refText, M, y + 5.5); }

  // job number + status pill (right)
  st(MUTED); font("bold", 7.5);
  doc.text("JOB CARD NO.", rX, y - 6.5, { align: "right" });
  st(NAVY); font("bold", 18);
  doc.text(`#${d.jobCardNumber || "—"}`, rX, y, { align: "right" });
  const completed = !!d.dateCompleted;
  const statusTxt = completed ? "COMPLETED" : "IN PROGRESS";
  const statusCol = completed ? GREEN : AMBER;
  font("bold", 7.5);
  const pillW = doc.getTextWidth(statusTxt) + 10;
  const pillX = rX - pillW, pillY = y + 3.5;
  sf([statusCol[0], statusCol[1], statusCol[2]]);
  // tint background
  doc.setFillColor(Math.round(statusCol[0] * 0.16 + 255 * 0.84), Math.round(statusCol[1] * 0.16 + 255 * 0.84), Math.round(statusCol[2] * 0.16 + 255 * 0.84));
  doc.roundedRect(pillX, pillY, pillW, 6, 3, 3, "F");
  sf(statusCol); doc.circle(pillX + 4, pillY + 3, 1.1, "F");
  st(statusCol); doc.text(statusTxt, pillX + 7, pillY + 4);

  // ===================== DETAILS CARD =====================
  y += 11;
  const make = [d.make, d.model].filter(Boolean).join(" ").trim();
  const cells: Array<{ label: string; value: string }> = [
    { label: "CUSTOMER", value: d.clientName || "—" },
    { label: "DATE", value: fmtDate(d.dateCompleted || d.dateCommenced) },
    { label: "TECHNICIAN", value: d.technicianName || "—" },
    { label: "VEHICLE / UNIT REG", value: d.registration || "—" },
    { label: "MAKE / MODEL", value: make || "—" },
    { label: "KM READING", value: d.kilometres ? `${Number(d.kilometres).toLocaleString("en-ZA")} km` : "—" },
    { label: "JOB TYPE", value: JOB_LABELS[d.jobType] || d.jobType || "—" },
    { label: "ORDER / REF NO.", value: d.orderNo || "—" },
    { label: d.engineHours ? "ENGINE HOURS" : "UNIT SERIAL NO.", value: d.engineHours ? `${d.engineHours} hrs` : (d.unitSerial || "—") },
  ];
  const rows = 3, cols = 3;
  const cellW = CONTENT_W / cols, cellH = 13.5;
  const cardH = rows * cellH;
  sf([255, 255, 255]); sd(LINE); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CONTENT_W, cardH, 2.5, 2.5, "FD");
  // grid lines
  sd(LINE); doc.setLineWidth(0.2);
  for (let r = 1; r < rows; r++) doc.line(M, y + r * cellH, M + CONTENT_W, y + r * cellH);
  for (let c = 1; c < cols; c++) doc.line(M + c * cellW, y + 4, M + c * cellW, y + cardH - 4);
  cells.forEach((cell, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const cx = M + c * cellW + 4, cy = y + r * cellH;
    st(MUTED); font("bold", 6.8);
    doc.text(cell.label, cx, cy + 5);
    st(INK); font("bold", 10);
    const v = doc.splitTextToSize(cell.value, cellW - 8);
    doc.text(v[0], cx, cy + 10.5);
  });
  y += cardH + 9;

  // section heading helper (amber accent bar + navy title)
  const heading = (text: string) => {
    sf(AMBER); doc.roundedRect(M, y - 3.6, 1.8, 5, 0.9, 0.9, "F");
    st(NAVY); font("bold", 11);
    doc.text(text.toUpperCase(), M + 5, y);
    y += 6.5;
  };
  const pageBreak = (need: number) => {
    if (y + need > H - 22) { doc.addPage(); y = M + 6; }
  };

  // ===================== WORK CARRIED OUT =====================
  const items = workItems(d.technicianReport);
  if (items.length) {
    heading("Work Carried Out / Job Description");
    font("normal", 9.5);
    items.forEach((it, i) => {
      const lines = doc.splitTextToSize(it, CONTENT_W - 16);
      const rowH = Math.max(8, lines.length * 4.6 + 3.5);
      pageBreak(rowH);
      sf(CARD); sd(LINE); doc.setLineWidth(0.2);
      doc.roundedRect(M, y, CONTENT_W, rowH, 1.6, 1.6, "FD");
      // number badge
      sf([237, 242, 247]); doc.circle(M + 6, y + rowH / 2, 3, "F");
      st(NAVY); font("bold", 8);
      doc.text(String(i + 1), M + 6, y + rowH / 2 + 1, { align: "center" });
      st(INK); font("normal", 9.5);
      doc.text(lines, M + 13, y + 5);
      y += rowH + 2.5;
    });
    y += 3;
  }

  // ===================== CLIENT'S INSTRUCTIONS =====================
  if ((d.clientInstructions || "").trim()) {
    pageBreak(18);
    heading("Client's Instructions");
    st(INK); font("normal", 9.5);
    const ci = doc.splitTextToSize(d.clientInstructions.trim(), CONTENT_W - 4);
    doc.text(ci, M + 1, y);
    y += ci.length * 4.6 + 6;
  }

  // ===================== PARTS USED =====================
  const parts = (d.parts || []).filter(p => (p.name || "").trim());
  if (parts.length) {
    pageBreak(14 + parts.length * 6);
    heading("Parts Used");
    st(INK); font("normal", 9.5);
    parts.forEach(p => {
      const qty = (p.qty || "").trim();
      sf(AMBER); doc.circle(M + 2, y - 1.3, 0.9, "F");
      st(INK);
      doc.text(`${qty ? `${qty} ×  ` : ""}${p.name}`, M + 6, y);
      y += 5.4;
    });
    y += 4;
  }

  // ===================== JOB PHOTOS =====================
  if (d.photos && d.photos.length) {
    pageBreak(20);
    heading("Job Photos · Captured On Site");
    const gap = 6, photoW = (CONTENT_W - gap) / 2, photoH = 58;
    let col = 0;
    for (const url of d.photos) {
      pageBreak(photoH + 4);
      const px = M + col * (photoW + gap);
      // frame
      sf([15, 23, 36]); doc.roundedRect(px, y, photoW, photoH, 2, 2, "F");
      const img = await loadImage(url);
      if (img) {
        const ratio = img.h / img.w;
        let dw = photoW - 4, dh = (photoW - 4) * ratio;
        const maxH = photoH - 9;
        if (dh > maxH) { dh = maxH; dw = maxH / ratio; }
        try { doc.addImage(img.data, "JPEG", px + (photoW - dw) / 2, y + 2, dw, dh); } catch { /* skip */ }
      }
      // caption strip
      sf([0, 0, 0]); doc.rect(px, y + photoH - 6, photoW, 6, "F");
      st([235, 235, 235]); font("normal", 6.8);
      doc.text(`Captured on site · ${fmtDate(d.dateCompleted || d.dateCommenced)}`, px + 3, y + photoH - 2);
      col++;
      if (col === 2) { col = 0; y += photoH + gap; }
    }
    if (col === 1) y += photoH + gap;
    y += 2;
  }

  // ===================== SIGNATURES =====================
  pageBreak(30);
  y += 2;
  const colW = (CONTENT_W - 10) / 2;
  // technician
  st(MUTED); font("bold", 7);
  doc.text("TECHNICIAN", M, y);
  st(INK); font("bold", 11);
  doc.text(d.technicianName || "—", M, y + 7);
  sd(LINE); doc.setLineWidth(0.3); doc.line(M, y + 11, M + colW, y + 11);
  st(MUTED); font("normal", 7.5);
  doc.text(`Signed & completed on site · ${fmtDate(d.dateCompleted || d.dateCommenced)}`, M, y + 15);

  // customer acceptance
  const cX = M + colW + 10;
  st(MUTED); font("bold", 7);
  doc.text("CUSTOMER ACCEPTANCE", cX, y);
  if (d.noSignature) {
    st(MUTED); font("italic", 8.5);
    doc.text("No customer available to sign.", cX, y + 7);
  } else if (d.signature) {
    try { doc.addImage(d.signature, "PNG", cX, y - 3, 40, 14); } catch { /* ignore */ }
  }
  sd(LINE); doc.setLineWidth(0.3); doc.line(cX, y + 11, cX + colW, y + 11);
  st(MUTED); font("normal", 7.5);
  doc.text(d.signName ? d.signName : "Name & signature on completion", cX, y + 15);

  // ===================== FOOTER (every page) =====================
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const fy = H - 12;
    sd(LINE); doc.setLineWidth(0.2); doc.line(M, fy, W - M, fy);
    sf(NAVY); doc.roundedRect(M, fy + 2.5, 5, 5, 1.2, 1.2, "F");
    st([255, 255, 255]); font("bold", 7.5); doc.text("M", M + 2.5, fy + 6, { align: "center" });
    st(MUTED); font("normal", 7);
    doc.text("Powered by ", M + 7, fy + 5.7);
    const pw = doc.getTextWidth("Powered by ");
    st(NAVY); font("bold", 7);
    doc.text("MARZ Fleet", M + 7 + pw, fy + 5.7);
    const mw = doc.getTextWidth("MARZ Fleet");
    st(MUTED); font("normal", 7);
    doc.text(" · fleet.marzai.co.za", M + 7 + pw + mw, fy + 5.7);
    doc.text("Digital job card · captured on a phone, nothing lost.", W - M, fy + 5.7, { align: "right" });
    if (pages > 1) { st(MUTED); font("normal", 6.5); doc.text(`Page ${p} of ${pages}`, W / 2, fy + 5.7, { align: "center" }); }
  }

  return doc.output("blob");
}
