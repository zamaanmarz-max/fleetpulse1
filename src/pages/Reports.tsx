import { BarChart3, FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useVehicles, useCertificates, useDrivers, useInspections, useFines } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const reportTypes = [
  { id: "fleet", name: "Full Fleet Compliance Report", desc: "Vehicles with compliance status and certificate dates" },
  { id: "driver", name: "Driver Compliance Report", desc: "Driver licence, PrDP, medical certificate status only" },
  { id: "certs", name: "Certificate Expiry Report", desc: "All certificates with expiry dates and status" },
  { id: "service", name: "KM Service Schedule Report", desc: "Vehicles with KM readings and service schedule" },
  { id: "damage", name: "Damage Inspection Report", desc: "Inspections with condition and damage counts" },
  { id: "fines", name: "AARTO and Fines Report", desc: "Traffic fines and demerit summary" },
];

export default function Reports() {
  const { data: vehicles } = useVehicles();
  const { data: certificates } = useCertificates();
  const { data: drivers } = useDrivers();
  const { data: inspections } = useInspections();
  const { data: fines } = useFines();
  const { profile } = useAuth();
  const [generating, setGenerating] = useState<string | null>(null);

  const pdfHeader = (doc: jsPDF, title: string) => {
    const now = new Date();
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 14, 30);
    doc.text("FleetPulse by MARZ Technologies", 14, 36);
    doc.setTextColor(0);
    return 44;
  };

  const pdfFooter = (doc: jsPDF) => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("© 2026 MARZ Technologies (Pty) Ltd. All rights reserved.", 14, doc.internal.pageSize.height - 10);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }
  };

  const generatePDF = (reportId: string) => {
    const doc = new jsPDF();
    const vList = vehicles || [];
    const cList = certificates || [];
    const dList = drivers || [];
    const iList = inspections || [];
    const fList = fines || [];
    const now = new Date();

    if (reportId === "fleet") {
      let y = pdfHeader(doc, "Full Fleet Compliance Report");
      const compliant = vList.filter(v => v.compliance_status === "compliant").length;
      doc.setFontSize(10);
      doc.text(`Total Vehicles: ${vList.length} | Compliant: ${compliant} | Score: ${vList.length > 0 ? Math.round((compliant / vList.length) * 100) : 0}%`, 14, y);
      autoTable(doc, {
        startY: y + 8,
        head: [["Reg No", "Fleet", "Make/Model", "Status", "Current KM", "KM to Service"]],
        body: vList.map(v => [v.registration_number, v.fleet_number || "-", `${v.make || ""} ${v.model || ""}`.trim() || "-", (v.compliance_status || "compliant").toUpperCase(), (v.current_odometer_km ?? 0).toLocaleString(), (v.km_until_service ?? 0).toLocaleString()]),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
        didParseCell: (data: any) => { if (data.column.index === 3 && data.section === "body" && ["CRITICAL", "EXPIRED"].includes(data.cell.raw)) { data.cell.styles.textColor = [220, 50, 50]; data.cell.styles.fontStyle = "bold"; } },
      });
    } else if (reportId === "driver") {
      let y = pdfHeader(doc, "Driver Compliance Report");
      autoTable(doc, {
        startY: y,
        head: [["Name", "Licence Code", "Licence Expiry", "PrDP Expiry", "Demerits", "Status"]],
        body: dList.map(d => {
          const licDays = d.licence_expiry ? Math.ceil((new Date(d.licence_expiry).getTime() - now.getTime()) / 86400000) : null;
          const prdpDays = d.prdp_expiry ? Math.ceil((new Date(d.prdp_expiry).getTime() - now.getTime()) / 86400000) : null;
          let status = "Compliant";
          if ((licDays !== null && licDays <= 0) || (prdpDays !== null && prdpDays <= 0)) status = "CRITICAL";
          else if ((licDays !== null && licDays <= 30) || (prdpDays !== null && prdpDays <= 30)) status = "WARNING";
          return [d.full_name, d.licence_code || "-", d.licence_expiry || "-", d.prdp_expiry || "-", d.demerit_points ?? 0, status];
        }),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
        didParseCell: (data: any) => { if (data.column.index === 5 && data.section === "body" && data.cell.raw === "CRITICAL") { data.cell.styles.textColor = [220, 50, 50]; data.cell.styles.fontStyle = "bold"; } },
      });
    } else if (reportId === "certs") {
      let y = pdfHeader(doc, "Certificate Expiry Report");
      autoTable(doc, {
        startY: y,
        head: [["Vehicle", "Type", "Number", "Expiry", "Days Left", "Status"]],
        body: cList.map(c => {
          const days = c.expiry_date ? Math.ceil((new Date(c.expiry_date).getTime() - now.getTime()) / 86400000) : null;
          return [(c as any).vehicles?.registration_number || "-", c.certificate_type, c.certificate_number || "-", c.expiry_date || "-", days !== null ? (days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`) : "-", c.status || "valid"];
        }),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
        didParseCell: (data: any) => { if (data.column.index === 5 && data.section === "body" && (data.cell.raw as string).toLowerCase() === "expired") { data.cell.styles.textColor = [220, 50, 50]; data.cell.styles.fontStyle = "bold"; } },
      });
    } else if (reportId === "service") {
      let y = pdfHeader(doc, "KM Service Schedule Report");
      autoTable(doc, {
        startY: y,
        head: [["Fleet No", "Reg No", "Current KM", "Last Service KM", "Next Due KM", "KM Remaining", "Status"]],
        body: vList.map(v => {
          const kmUntil = (v.next_service_due_km ?? 0) - (v.current_odometer_km ?? 0);
          const status = kmUntil < 0 ? "OVERDUE" : kmUntil < 500 ? "WARNING" : "OK";
          return [v.fleet_number || "-", v.registration_number, (v.current_odometer_km ?? 0).toLocaleString(), (v.last_service_km ?? 0).toLocaleString(), (v.next_service_due_km ?? 0).toLocaleString(), kmUntil.toLocaleString(), status];
        }),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
        didParseCell: (data: any) => { if (data.column.index === 6 && data.section === "body" && data.cell.raw === "OVERDUE") { data.cell.styles.textColor = [220, 50, 50]; data.cell.styles.fontStyle = "bold"; } },
      });
    } else if (reportId === "damage") {
      let y = pdfHeader(doc, "Damage Inspection Report");
      autoTable(doc, {
        startY: y,
        head: [["Vehicle", "Date", "Condition", "Total Items", "New Items", "Critical", "Status"]],
        body: iList.map(ins => [(ins as any).vehicles?.registration_number || "-", ins.inspection_date || "-", ins.overall_condition || "-", ins.total_damage_items ?? 0, ins.new_damage_items ?? 0, ins.has_critical_damage ? "Yes" : "No", ins.status || "draft"]),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
      });
    } else if (reportId === "fines") {
      let y = pdfHeader(doc, "AARTO and Fines Report");
      const totalOutstanding = fList.filter(f => f.payment_status !== "paid").reduce((s, f) => s + (Number(f.amount) || 0), 0);
      doc.setFontSize(10);
      doc.text(`Total Fines: ${fList.length} | Outstanding: R ${totalOutstanding.toLocaleString()}`, 14, y);
      autoTable(doc, {
        startY: y + 8,
        head: [["Fine No", "Vehicle", "Driver", "Amount", "Demerits", "Date", "Status"]],
        body: fList.map(f => [f.fine_number || "-", (f as any).vehicles?.registration_number || "-", (f as any).drivers?.full_name || "-", `R ${(Number(f.amount) || 0).toLocaleString()}`, f.demerit_points_applied ?? 0, f.offence_date || "-", f.payment_status || "unpaid"]),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
      });
    }

    pdfFooter(doc);
    doc.save(`${reportId}_report_${now.toISOString().split("T")[0]}.pdf`);
  };

  const generateCSV = (reportId: string) => {
    let csv = "";
    const now = new Date();
    const vList = vehicles || [];
    const cList = certificates || [];
    const dList = drivers || [];
    const iList = inspections || [];
    const fList = fines || [];

    if (reportId === "fleet") {
      csv = "Registration,Fleet No,Make,Model,Status,Current KM,KM to Service\n";
      vList.forEach(v => { csv += `"${v.registration_number}","${v.fleet_number || ""}","${v.make || ""}","${v.model || ""}","${v.compliance_status || "compliant"}",${v.current_odometer_km ?? 0},${v.km_until_service ?? 0}\n`; });
    } else if (reportId === "driver") {
      csv = "Name,Licence Code,Licence Expiry,PrDP Expiry,Demerits\n";
      dList.forEach(d => { csv += `"${d.full_name}","${d.licence_code || ""}","${d.licence_expiry || ""}","${d.prdp_expiry || ""}",${d.demerit_points ?? 0}\n`; });
    } else if (reportId === "certs") {
      csv = "Vehicle,Type,Number,Expiry,Status\n";
      cList.forEach(c => { csv += `"${(c as any).vehicles?.registration_number || ""}","${c.certificate_type}","${c.certificate_number || ""}","${c.expiry_date || ""}","${c.status || "valid"}"\n`; });
    } else if (reportId === "service") {
      csv = "Fleet No,Registration,Current KM,Last Service KM,Next Due KM,KM Remaining\n";
      vList.forEach(v => { csv += `"${v.fleet_number || ""}","${v.registration_number}",${v.current_odometer_km ?? 0},${v.last_service_km ?? 0},${v.next_service_due_km ?? 0},${(v.next_service_due_km ?? 0) - (v.current_odometer_km ?? 0)}\n`; });
    } else if (reportId === "damage") {
      csv = "Vehicle,Date,Condition,Total Items,New Items,Status\n";
      iList.forEach(ins => { csv += `"${(ins as any).vehicles?.registration_number || ""}","${ins.inspection_date || ""}","${ins.overall_condition || ""}",${ins.total_damage_items ?? 0},${ins.new_damage_items ?? 0},"${ins.status || "draft"}"\n`; });
    } else if (reportId === "fines") {
      csv = "Fine No,Vehicle,Driver,Amount,Demerits,Date,Status\n";
      fList.forEach(f => { csv += `"${f.fine_number || ""}","${(f as any).vehicles?.registration_number || ""}","${(f as any).drivers?.full_name || ""}",${Number(f.amount) || 0},${f.demerit_points_applied ?? 0},"${f.offence_date || ""}","${f.payment_status || "unpaid"}"\n`; });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportId}_report_${now.toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async (reportId: string, format: "pdf" | "csv") => {
    setGenerating(`${reportId}-${format}`);
    try {
      if (format === "pdf") generatePDF(reportId);
      else generateCSV(reportId);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate and export compliance reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <div key={report.id} className="stat-card flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">{report.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{report.desc}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleGenerate(report.id, "pdf")}
                disabled={generating === `${report.id}-pdf`}
                className="flex-1 flex items-center justify-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-xs hover:bg-secondary/80 disabled:opacity-50"
              >
                {generating === `${report.id}-pdf` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} PDF
              </button>
              <button
                onClick={() => handleGenerate(report.id, "csv")}
                disabled={generating === `${report.id}-csv`}
                className="flex-1 flex items-center justify-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-xs hover:bg-secondary/80 disabled:opacity-50"
              >
                {generating === `${report.id}-csv` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} CSV
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
