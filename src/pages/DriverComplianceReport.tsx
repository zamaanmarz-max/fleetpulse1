import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Loader2, FileSpreadsheet, Search, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDrivers } from "@/hooks/useOrgData";
import { supabase } from "@/integrations/supabase/client";
import { BranchFilter } from "@/components/filters/BranchFilter";
import { checkDriverCompliance } from "@/lib/driverCompliance";
import { resolveLicence, resolvePrdp, resolveMedical, resolveCriminal, lastToolboxStatus, docStatusLabel } from "@/lib/driverComplianceHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { drawHeader, drawFooter, sectionHeading, statusColor, tableHeadStyles } from "@/lib/pdfTemplate";

type FilterMode = "all" | "non-compliant" | "expiring";

const statusBadge: Record<string, string> = {
  compliant: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  critical: "bg-destructive/20 text-destructive",
};

const docBadge: Record<string, string> = {
  valid: "bg-success/20 text-success",
  expiring: "bg-warning/20 text-warning",
  expired: "bg-destructive/20 text-destructive",
  missing: "bg-destructive/20 text-destructive",
};

export default function DriverComplianceReport() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: drivers, isLoading } = useDrivers();
  const [branchId, setBranchId] = useState("");
  const [mode, setMode] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: docs } = useQuery({
    queryKey: ["dcr_driver_docs", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_documents").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: talks } = useQuery({
    queryKey: ["dcr_toolbox_talks", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("toolbox_talks").select("*").order("date_conducted", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: branches } = useQuery({
    queryKey: ["dcr_branches", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const branchName = branchId ? branches?.find(b => b.id === branchId)?.name : undefined;

  const enriched = useMemo(() => {
    const now = Date.now();
    return (drivers || []).map(d => {
      const driverDocs = (docs || []).filter(x => x.driver_id === d.id);
      const driverTalks = (talks || []).filter(x => x.driver_id === d.id);
      const enrichedDocs = driverDocs.map(doc => {
        const days = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date).getTime() - now) / 86400000) : 999;
        return { ...doc, calcStatus: days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid" };
      });
      const compliance = checkDriverCompliance(
        { licence_expiry: d.licence_expiry, prdp_expiry: d.prdp_expiry, licence_number: d.licence_number, prdp_number: d.prdp_number },
        enrichedDocs as any,
        driverTalks
      );
      const licence = resolveLicence({ licence_expiry: d.licence_expiry, licence_number: d.licence_number }, driverDocs);
      const prdp = resolvePrdp({ prdp_expiry: d.prdp_expiry, prdp_number: d.prdp_number }, driverDocs);
      const medical = resolveMedical(driverDocs);
      const criminal = resolveCriminal(driverDocs);
      const toolbox = lastToolboxStatus(driverTalks);
      return { driver: d, compliance, licence, prdp, medical, criminal, toolbox };
    });
  }, [drivers, docs, talks]);

  const filtered = useMemo(() => {
    return enriched.filter(row => {
      if (branchId && row.driver.branch_id !== branchId) return false;
      if (search && !`${row.driver.full_name} ${row.driver.id_number || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (mode === "non-compliant" && row.compliance.status === "compliant") return false;
      if (mode === "expiring") {
        const anyExpiring = [row.licence.status, row.prdp.status, row.medical.status, row.criminal.status].includes("expiring");
        if (!anyExpiring) return false;
      }
      return true;
    });
  }, [enriched, branchId, mode, search]);

  // Summary stats (always over branch-filtered set, ignoring search/mode)
  const summary = useMemo(() => {
    const inScope = enriched.filter(r => !branchId || r.driver.branch_id === branchId);
    const total = inScope.length;
    const compliant = inScope.filter(r => r.compliance.status === "compliant").length;
    const warning = inScope.filter(r => r.compliance.status === "warning").length;
    const critical = inScope.filter(r => r.compliance.status === "critical").length;
    const avg = total > 0 ? Math.round(inScope.reduce((s, r) => s + r.compliance.score, 0) / total) : 0;
    return { total, compliant, warning, critical, avg };
  }, [enriched, branchId]);

  const exportPDF = () => {
    setExporting("pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      let y = drawHeader(doc, {
        title: "Driver Compliance Report",
        companyName: profile?.organisation_id ? "" : undefined,
        branchName,
        subtitle: `${filtered.length} driver(s) · Filter: ${mode === "all" ? "All" : mode === "non-compliant" ? "Non-Compliant Only" : "Expiring This Month"}`,
      });

      // Summary cards row
      const cardW = 50, cardH = 16, gap = 4;
      const cards = [
        { label: "Total", value: String(summary.total), color: [60, 60, 60] as [number, number, number] },
        { label: "Compliant", value: String(summary.compliant), color: statusColor("compliant") },
        { label: "Warning", value: String(summary.warning), color: statusColor("warning") },
        { label: "Non-Compliant", value: String(summary.critical), color: statusColor("expired") },
        { label: "Avg Score", value: `${summary.avg}%`, color: [10, 70, 130] as [number, number, number] },
      ];
      let x = 14;
      cards.forEach(c => {
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, "F");
        doc.setDrawColor(...c.color);
        doc.setLineWidth(0.6);
        doc.line(x, y + cardH, x + cardW, y + cardH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...c.color);
        doc.text(c.value, x + 3, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(110, 110, 110);
        doc.text(c.label, x + 3, y + 13);
        x += cardW + gap;
      });
      y += cardH + 10;
      doc.setTextColor(0, 0, 0);

      y = sectionHeading(doc, "Driver Detail", y);
      autoTable(doc, {
        startY: y,
        head: [["Name", "ID Number", "Licence", "PrDP", "Medical", "Criminal", "Toolbox", "Score", "Status"]],
        headStyles: tableHeadStyles,
        styles: { fontSize: 8, cellPadding: 1.5 },
        body: filtered.map(r => [
          r.driver.full_name,
          r.driver.id_number || "-",
          `${r.licence.expiry || "-"}\n${docStatusLabel(r.licence.status)}`,
          `${r.prdp.expiry || "-"}\n${docStatusLabel(r.prdp.status)}`,
          `${r.medical.expiry || "-"}\n${docStatusLabel(r.medical.status)}`,
          `${r.criminal.expiry || "-"}\n${docStatusLabel(r.criminal.status)}`,
          `${r.toolbox.lastDate || "Never"}\n${r.toolbox.status === "valid" ? "Done" : "Overdue"}`,
          `${r.compliance.score}%`,
          r.compliance.status === "compliant" ? "COMPLIANT" : r.compliance.status === "warning" ? "WARNING" : "NON-COMPLIANT",
        ]),
        didParseCell: (data: any) => {
          if (data.section !== "body") return;
          const colorize = (label: string) => {
            const [rr, gg, bb] = statusColor(label);
            data.cell.styles.textColor = [rr, gg, bb];
            data.cell.styles.fontStyle = "bold";
          };
          if ([2, 3, 4, 5, 6].includes(data.column.index)) {
            const txt = String(data.cell.raw).split("\n").pop() || "";
            colorize(txt);
          }
          if (data.column.index === 8) colorize(String(data.cell.raw));
        },
      });

      drawFooter(doc);
      doc.save(`driver_compliance_report_${new Date().toISOString().split("T")[0]}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  const exportXLSX = () => {
    setExporting("xlsx");
    try {
      const rows = filtered.map(r => ({
        "Full Name": r.driver.full_name,
        "ID Number": r.driver.id_number || "",
        "Licence Number": r.licence.number || r.driver.licence_number || "",
        "Licence Expiry": r.licence.expiry || "",
        "Licence Status": docStatusLabel(r.licence.status),
        "PrDP Number": r.prdp.number || r.driver.prdp_number || "",
        "PrDP Expiry": r.prdp.expiry || "",
        "PrDP Status": docStatusLabel(r.prdp.status),
        "Medical Expiry": r.medical.expiry || "",
        "Medical Status": docStatusLabel(r.medical.status),
        "Criminal Check Expiry": r.criminal.expiry || "",
        "Criminal Status": docStatusLabel(r.criminal.status),
        "Last Toolbox Talk": r.toolbox.lastDate || "Never",
        "Toolbox Status": r.toolbox.status === "valid" ? "Done" : "Overdue",
        "Demerits": r.driver.demerit_points ?? 0,
        "Compliance Score %": r.compliance.score,
        "Overall Status": r.compliance.status === "compliant" ? "Compliant" : r.compliance.status === "warning" ? "Warning" : "Non-Compliant",
      }));
      const wb = XLSX.utils.book_new();
      const summaryRows = [
        ["MARZ Fleet — Driver Compliance Report"],
        [`Generated: ${new Date().toLocaleString()}`],
        branchName ? [`Branch: ${branchName}`] : ["Branch: All"],
        [],
        ["Total Drivers", summary.total],
        ["Compliant", summary.compliant],
        ["Warning", summary.warning],
        ["Non-Compliant", summary.critical],
        ["Average Score %", summary.avg],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Drivers");
      XLSX.writeFile(wb, `driver_compliance_report_${new Date().toISOString().split("T")[0]}.xlsx`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/reports")} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Driver Compliance Report</h1>
          <p className="text-sm text-muted-foreground">Comprehensive view of every driver's compliance status</p>
        </div>
        <button onClick={exportXLSX} disabled={!!exporting} className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-sm hover:bg-secondary/80 disabled:opacity-50">
          {exporting === "xlsx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
        </button>
        <button onClick={exportPDF} disabled={!!exporting} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm hover:opacity-90 disabled:opacity-50">
          {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="stat-card"><p className="text-xs uppercase text-muted-foreground tracking-wider">Total Drivers</p><p className="text-2xl font-bold text-foreground mt-1">{summary.total}</p></div>
        <div className="stat-card border-l-2 border-success"><p className="text-xs uppercase text-muted-foreground tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-success" /> Compliant</p><p className="text-2xl font-bold text-success mt-1">{summary.compliant}</p></div>
        <div className="stat-card border-l-2 border-warning"><p className="text-xs uppercase text-muted-foreground tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-warning" /> Warning</p><p className="text-2xl font-bold text-warning mt-1">{summary.warning}</p></div>
        <div className="stat-card border-l-2 border-destructive"><p className="text-xs uppercase text-muted-foreground tracking-wider flex items-center gap-1"><AlertCircle className="w-3 h-3 text-destructive" /> Non-Compliant</p><p className="text-2xl font-bold text-destructive mt-1">{summary.critical}</p></div>
        <div className="stat-card"><p className="text-xs uppercase text-muted-foreground tracking-wider">Avg Score</p><p className={`text-2xl font-bold mt-1 ${summary.avg >= 80 ? "text-success" : summary.avg >= 50 ? "text-warning" : "text-destructive"}`}>{summary.avg}%</p></div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search driver name or ID..." className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {([
            { v: "all", label: "All" },
            { v: "non-compliant", label: "Non-Compliant" },
            { v: "expiring", label: "Expiring" },
          ] as { v: FilterMode; label: string }[]).map(opt => (
            <button key={opt.v} onClick={() => setMode(opt.v)} className={`text-xs px-3 py-1.5 rounded-md transition-colors ${mode === opt.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{opt.label}</button>
          ))}
        </div>
        <BranchFilter value={branchId} onChange={setBranchId} />
      </div>

      <div className="glass-card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-sm text-muted-foreground">No drivers match the selected filters.</p>
        ) : (
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID Number</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Licence</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">PrDP</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Medical</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Criminal</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Toolbox</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.driver.id} onClick={() => navigate(`/drivers/${r.driver.id}`)} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-3 py-3 text-sm font-medium text-foreground">{r.driver.full_name}</td>
                  <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{r.driver.id_number || "-"}</td>
                  <DocCell number={r.licence.number || r.driver.licence_number} expiry={r.licence.expiry} status={r.licence.status} />
                  <DocCell number={r.prdp.number || r.driver.prdp_number} expiry={r.prdp.expiry} status={r.prdp.status} />
                  <DocCell number={r.medical.number} expiry={r.medical.expiry} status={r.medical.status} />
                  <DocCell number={r.criminal.number} expiry={r.criminal.expiry} status={r.criminal.status} />
                  <td className="px-3 py-3 text-xs">
                    <div className="text-foreground">{r.toolbox.lastDate || <span className="text-muted-foreground">Never</span>}</div>
                    <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.toolbox.status === "valid" ? docBadge.valid : docBadge.expired}`}>
                      {r.toolbox.status === "valid" ? "Done" : "Overdue"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-sm font-bold ${r.compliance.score >= 80 ? "text-success" : r.compliance.score >= 50 ? "text-warning" : "text-destructive"}`}>{r.compliance.score}%</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge[r.compliance.status]}`}>
                      {r.compliance.status === "compliant" ? "Compliant" : r.compliance.status === "warning" ? "Warning" : "Non-Compliant"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DocCell({ number, expiry, status }: { number: string | null; expiry: string | null; status: "valid" | "expiring" | "expired" | "missing" }) {
  return (
    <td className="px-3 py-3 text-xs">
      {number && <div className="font-mono text-muted-foreground text-[11px]">{number}</div>}
      <div className="text-foreground">{expiry || <span className="text-muted-foreground">—</span>}</div>
      <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${docBadge[status]}`}>
        {status === "valid" ? "Valid" : status === "expiring" ? "Expiring" : status === "expired" ? "Expired" : "Missing"}
      </span>
    </td>
  );
}
