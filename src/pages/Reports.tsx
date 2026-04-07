import { BarChart3, FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useVehicles, useCertificates, useDrivers } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const reportTypes = [
  { id: "fleet", name: "Full Fleet Compliance Report", desc: "Complete overview of all vehicles and their compliance status" },
  { id: "certs", name: "Certificate Expiry Report", desc: "All certificates with expiry dates and status" },
  { id: "service", name: "KM Service Schedule Report", desc: "Service due/overdue vehicles by kilometre readings" },
  { id: "damage", name: "Damage Inspection Report", desc: "Inspection history and outstanding damage items" },
  { id: "driver", name: "Driver Compliance Report", desc: "Driver licence, PrDP, and demerit point status" },
  { id: "fines", name: "AARTO and Fines Report", desc: "Traffic fines and demerit summary" },
  { id: "branch", name: "Branch Comparison Report", desc: "Side-by-side branch compliance metrics" },
];

export default function Reports() {
  const { data: vehicles } = useVehicles();
  const { data: certificates } = useCertificates();
  const { data: drivers } = useDrivers();
  const { profile } = useAuth();
  const [generating, setGenerating] = useState<string | null>(null);

  const generateFleetPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const vList = vehicles || [];
    const cList = certificates || [];
    const compliant = vList.filter(v => v.compliance_status === "compliant").length;
    const score = vList.length > 0 ? Math.round((compliant / vList.length) * 100) : 0;

    doc.setFontSize(20);
    doc.text("Fleet Compliance Report", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 14, 30);
    doc.text(`Organisation: ${profile?.full_name || "N/A"}`, 14, 36);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Summary", 14, 48);
    doc.setFontSize(10);
    doc.text(`Total Vehicles: ${vList.length}`, 14, 56);
    doc.text(`Compliance Score: ${score}%`, 14, 62);
    doc.text(`Compliant: ${compliant}`, 14, 68);
    doc.text(`Warning: ${vList.filter(v => v.compliance_status === "warning").length}`, 80, 68);
    doc.text(`Critical: ${vList.filter(v => v.compliance_status === "critical").length}`, 140, 68);

    // Vehicles table
    doc.setFontSize(12);
    doc.text("Vehicles", 14, 82);
    autoTable(doc, {
      startY: 88,
      head: [["Reg No", "Fleet", "Make/Model", "Status", "Current KM", "KM to Service"]],
      body: vList.map(v => [
        v.registration_number,
        v.fleet_number || "-",
        `${v.make || ""} ${v.model || ""}`.trim() || "-",
        (v.compliance_status || "compliant").toUpperCase(),
        (v.current_odometer_km ?? 0).toLocaleString(),
        (v.km_until_service ?? 0).toLocaleString(),
      ]),
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185] },
      didParseCell: (data: any) => {
        if (data.column.index === 3 && data.section === "body") {
          const val = data.cell.raw as string;
          if (val === "CRITICAL" || val === "EXPIRED") {
            data.cell.styles.textColor = [220, 50, 50];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    // Certificates table
    const finalY = (doc as any).lastAutoTable?.finalY || 180;
    if (finalY > 240) doc.addPage();
    const certStartY = finalY > 240 ? 20 : finalY + 14;
    doc.setFontSize(12);
    doc.text("Certificates", 14, certStartY);
    autoTable(doc, {
      startY: certStartY + 6,
      head: [["Vehicle", "Type", "Number", "Expiry", "Days Left", "Status"]],
      body: cList.map(c => {
        const days = c.expiry_date ? Math.ceil((new Date(c.expiry_date).getTime() - Date.now()) / 86400000) : null;
        return [
          (c as any).vehicles?.registration_number || "-",
          c.certificate_type,
          c.certificate_number || "-",
          c.expiry_date || "-",
          days !== null ? (days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`) : "-",
          c.status || "valid",
        ];
      }),
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185] },
      didParseCell: (data: any) => {
        if (data.column.index === 5 && data.section === "body") {
          const val = (data.cell.raw as string).toLowerCase();
          if (val === "expired") {
            data.cell.styles.textColor = [220, 50, 50];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    doc.save(`fleet_compliance_report_${now.toISOString().split("T")[0]}.pdf`);
  };

  const generateCSV = (reportId: string) => {
    let csv = "";
    const vList = vehicles || [];
    const cList = certificates || [];
    if (reportId === "fleet") {
      csv = "Registration,Fleet No,Make,Model,Status,Current KM,KM to Service\n";
      vList.forEach(v => {
        csv += `"${v.registration_number}","${v.fleet_number || ""}","${v.make || ""}","${v.model || ""}","${v.compliance_status || "compliant"}",${v.current_odometer_km ?? 0},${v.km_until_service ?? 0}\n`;
      });
    } else if (reportId === "certs") {
      csv = "Vehicle,Type,Number,Expiry,Status\n";
      cList.forEach(c => {
        csv += `"${(c as any).vehicles?.registration_number || ""}","${c.certificate_type}","${c.certificate_number || ""}","${c.expiry_date || ""}","${c.status || "valid"}"\n`;
      });
    } else if (reportId === "driver") {
      csv = "Name,Licence,Licence Expiry,PrDP,PrDP Expiry,Demerits\n";
      (drivers || []).forEach(d => {
        csv += `"${d.full_name}","${d.licence_number || ""}","${d.licence_expiry || ""}","${d.prdp_number || ""}","${d.prdp_expiry || ""}",${d.demerit_points ?? 0}\n`;
      });
    } else {
      csv = "Registration,Fleet No,Status,Current KM\n";
      vList.forEach(v => {
        csv += `"${v.registration_number}","${v.fleet_number || ""}","${v.compliance_status || "compliant"}",${v.current_odometer_km ?? 0}\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportId}_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async (reportId: string, format: "pdf" | "csv") => {
    setGenerating(`${reportId}-${format}`);
    try {
      if (format === "pdf") generateFleetPDF();
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
