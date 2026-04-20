import { BarChart3, FileDown, Loader2, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useVehicles, useCertificates, useDrivers, useInspections, useFines } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { BranchFilter } from "@/components/filters/BranchFilter";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const reportTypes = [
  { id: "fleet", name: "Full Fleet Compliance Report", desc: "Vehicles with compliance status and certificate dates" },
  { id: "driver", name: "Driver Compliance Report", desc: "Driver licence, PrDP, medical certificate status only" },
  { id: "certs", name: "Certificate Expiry Report", desc: "All certificates with expiry dates and status" },
  { id: "service", name: "KM Service Schedule Report", desc: "Vehicles with KM readings and service schedule" },
  { id: "damage", name: "Damage Inspection Report", desc: "Inspections with condition and damage counts" },
  { id: "fines", name: "AARTO and Fines Report", desc: "Traffic fines and demerit summary" },
  { id: "hs", name: "H&S Compliance Report", desc: "Health & safety: medicals, toolbox talks, inspections, repairs" },
  { id: "maintenance", name: "Maintenance Cost Report", desc: "Job cards, parts, labour costs per vehicle" },
  { id: "trackers", name: "Service Trackers Report", desc: "Custom service trackers with due dates and KM" },
];

export default function Reports() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: vehicles } = useVehicles();
  const { data: certificates } = useCertificates();
  const { data: drivers } = useDrivers();
  const { data: inspections } = useInspections();
  const { data: fines } = useFines();
  const [generating, setGenerating] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string>("");

  const { data: jobCards } = useQuery({
    queryKey: ["job_cards_report", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("*, vehicles(registration_number, fleet_number, branch_id)")
        .order("work_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: trackers } = useQuery({
    queryKey: ["trackers_report", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_service_trackers")
        .select("*, vehicles(registration_number, fleet_number, branch_id, current_odometer_km)")
        .order("tracker_name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: toolboxTalks } = useQuery({
    queryKey: ["toolbox_talks_report", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolbox_talks")
        .select("*, drivers(full_name, branch_id)")
        .order("date_conducted", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: driverDocs } = useQuery({
    queryKey: ["driver_docs_report", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_documents")
        .select("*, drivers(full_name, branch_id)");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: damageItems } = useQuery({
    queryKey: ["damage_items_report", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_items")
        .select("*, vehicles(registration_number, branch_id)");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  // Branch-filtered datasets
  const filtered = useMemo(() => {
    const fb = (item: any, key = "branch_id") => !branchId || item?.[key] === branchId || item?.vehicles?.branch_id === branchId || item?.drivers?.branch_id === branchId;
    return {
      vehicles: (vehicles || []).filter(v => fb(v)),
      certificates: (certificates || []).filter(c => fb(c)),
      drivers: (drivers || []).filter(d => fb(d)),
      inspections: (inspections || []).filter(i => fb(i)),
      fines: (fines || []).filter(f => fb(f)),
      jobCards: (jobCards || []).filter(j => fb(j)),
      trackers: (trackers || []).filter(t => fb(t)),
      toolboxTalks: (toolboxTalks || []).filter(t => fb(t)),
      driverDocs: (driverDocs || []).filter(d => fb(d)),
      damageItems: (damageItems || []).filter(d => fb(d)),
    };
  }, [branchId, vehicles, certificates, drivers, inspections, fines, jobCards, trackers, toolboxTalks, driverDocs, damageItems]);

  const pdfHeader = (doc: jsPDF, title: string) => {
    const now = new Date();
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 14, 30);
    doc.text("MARZ Fleet by MARZ Technologies", 14, 36);
    if (branchId) doc.text("Filtered by selected branch", 14, 42);
    doc.setTextColor(0);
    return branchId ? 50 : 44;
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
    const vList = filtered.vehicles;
    const cList = filtered.certificates;
    const dList = filtered.drivers;
    const iList = filtered.inspections;
    const fList = filtered.fines;
    const jList = filtered.jobCards;
    const tList = filtered.trackers;
    const ttList = filtered.toolboxTalks;
    const ddList = filtered.driverDocs;
    const diList = filtered.damageItems;
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
    } else if (reportId === "hs") {
      let y = pdfHeader(doc, "H&S Compliance Report");
      // Score breakdown
      const driversWithMedical = dList.filter(d => ddList.some(doc => doc.driver_id === d.id && /medical/i.test(doc.document_type || "") && doc.expiry_date && new Date(doc.expiry_date) > now)).length;
      const driversWithRecentTalk = dList.filter(d => ttList.some(t => t.driver_id === d.id && (now.getTime() - new Date(t.date_conducted).getTime()) / 86400000 <= 30)).length;
      const driversWithCriminal = dList.filter(d => ddList.some(doc => doc.driver_id === d.id && /criminal/i.test(doc.document_type || ""))).length;
      const ninetyDays = 90 * 86400000;
      const vehiclesWithRecentInsp = vList.filter(v => iList.some(i => i.vehicle_id === v.id && (now.getTime() - new Date(i.inspection_date || 0).getTime()) <= ninetyDays)).length;
      const totalDamages = diList.length;
      const resolvedDamages = diList.filter(d => d.resolved).length;
      const damagePct = totalDamages > 0 ? (resolvedDamages / totalDamages) * 100 : 100;
      const dCount = dList.length || 1;
      const vCount = vList.length || 1;
      const overall = Math.round(((driversWithMedical / dCount) * 20 + (driversWithRecentTalk / dCount) * 20 + (driversWithCriminal / dCount) * 20 + (vehiclesWithRecentInsp / vCount) * 20 + (damagePct / 100) * 20));

      doc.setFontSize(12); doc.text(`Overall H&S Score: ${overall}%`, 14, y);
      autoTable(doc, {
        startY: y + 8,
        head: [["Metric", "Status", "%"]],
        body: [
          ["Drivers with valid medical certs", `${driversWithMedical}/${dList.length}`, `${Math.round((driversWithMedical / dCount) * 100)}%`],
          ["Drivers with toolbox talk (30d)", `${driversWithRecentTalk}/${dList.length}`, `${Math.round((driversWithRecentTalk / dCount) * 100)}%`],
          ["Drivers with criminal check", `${driversWithCriminal}/${dList.length}`, `${Math.round((driversWithCriminal / dCount) * 100)}%`],
          ["Vehicles inspected (90d)", `${vehiclesWithRecentInsp}/${vList.length}`, `${Math.round((vehiclesWithRecentInsp / vCount) * 100)}%`],
          ["Damages resolved", `${resolvedDamages}/${totalDamages}`, `${Math.round(damagePct)}%`],
        ],
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
      });

      const lastY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11); doc.text("Outstanding Repairs", 14, lastY);
      const unresolvedDamages = diList.filter(d => !d.resolved);
      if (unresolvedDamages.length > 0) {
        autoTable(doc, {
          startY: lastY + 4,
          head: [["Vehicle", "Location", "Severity", "Type"]],
          body: unresolvedDamages.map(d => [(d as any).vehicles?.registration_number || "-", d.location || "-", (d.severity || "-").toUpperCase(), d.damage_type || "-"]),
          theme: "striped", headStyles: { fillColor: [41, 128, 185] },
        });
      } else {
        doc.setFontSize(10); doc.text("None — all damages resolved.", 14, lastY + 8);
      }

      const recY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : lastY + 20;
      doc.setFontSize(11); doc.text("Recommendations", 14, recY);
      const recs: string[] = [];
      if (driversWithMedical < dList.length) recs.push(`• Schedule medical checks for ${dList.length - driversWithMedical} driver(s)`);
      if (driversWithRecentTalk < dList.length) recs.push(`• Conduct toolbox talks for ${dList.length - driversWithRecentTalk} driver(s) within 30 days`);
      if (vehiclesWithRecentInsp < vList.length) recs.push(`• Inspect ${vList.length - vehiclesWithRecentInsp} vehicle(s) — last inspection > 90 days`);
      if (unresolvedDamages.length > 0) recs.push(`• Resolve ${unresolvedDamages.length} outstanding damage repair(s)`);
      if (recs.length === 0) recs.push("• Excellent — no immediate H&S actions required.");
      doc.setFontSize(10);
      recs.forEach((r, i) => doc.text(r, 14, recY + 8 + i * 6));
    } else if (reportId === "maintenance") {
      let y = pdfHeader(doc, "Maintenance Cost Report");
      const totalSpend = jList.reduce((s, j) => s + (Number(j.total_cost) || 0), 0);
      const totalLabour = jList.reduce((s, j) => s + (Number(j.labour_cost) || 0), 0);
      const totalParts = jList.reduce((s, j) => s + (Number(j.parts_cost) || 0), 0);
      doc.setFontSize(10);
      doc.text(`Total Job Cards: ${jList.length} | Total Spend: R ${totalSpend.toLocaleString()} | Labour: R ${totalLabour.toLocaleString()} | Parts: R ${totalParts.toLocaleString()}`, 14, y);
      autoTable(doc, {
        startY: y + 8,
        head: [["Date", "Vehicle", "Type", "Workshop", "Labour", "Parts", "Total", "Status"]],
        body: jList.map(j => [j.work_date || "-", (j as any).vehicles?.registration_number || "-", j.job_type, j.workshop_name || "-", `R ${(Number(j.labour_cost) || 0).toLocaleString()}`, `R ${(Number(j.parts_cost) || 0).toLocaleString()}`, `R ${(Number(j.total_cost) || 0).toLocaleString()}`, (j.status || "open").toUpperCase()]),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
      });

      // Per-vehicle aggregation
      const byVehicle: Record<string, number> = {};
      jList.forEach(j => {
        const reg = (j as any).vehicles?.registration_number || "Unknown";
        byVehicle[reg] = (byVehicle[reg] || 0) + (Number(j.total_cost) || 0);
      });
      const lastY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11); doc.text("Spend by Vehicle", 14, lastY);
      autoTable(doc, {
        startY: lastY + 4,
        head: [["Vehicle", "Total Spend"]],
        body: Object.entries(byVehicle).sort((a, b) => b[1] - a[1]).map(([reg, total]) => [reg, `R ${total.toLocaleString()}`]),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
      });
    } else if (reportId === "trackers") {
      let y = pdfHeader(doc, "Service Trackers Report");
      autoTable(doc, {
        startY: y,
        head: [["Vehicle", "Tracker", "Type", "Interval", "Last Done", "Next Due", "Status"]],
        body: tList.map(t => {
          let status = "OK";
          let nextDueDisplay = "-";
          if (t.tracking_type === "km") {
            const currentKm = (t as any).vehicles?.current_odometer_km ?? 0;
            const remaining = (t.next_due_value ?? 0) - currentKm;
            nextDueDisplay = `${(t.next_due_value ?? 0).toLocaleString()} km`;
            if (remaining < 0) status = "OVERDUE"; else if (remaining < 500) status = "DUE SOON";
          } else if (t.tracking_type === "days" && t.next_due_date) {
            const days = Math.ceil((new Date(t.next_due_date).getTime() - now.getTime()) / 86400000);
            nextDueDisplay = t.next_due_date;
            if (days < 0) status = "OVERDUE"; else if (days < 14) status = "DUE SOON";
          } else if (t.tracking_type === "hours") {
            nextDueDisplay = `${(t.next_due_value ?? 0).toLocaleString()} hrs`;
          }
          const lastDone = t.tracking_type === "days" ? (t.last_done_date || "-") : `${(t.last_done_value ?? 0).toLocaleString()} ${t.tracking_type}`;
          return [(t as any).vehicles?.registration_number || "-", t.tracker_name, t.tracking_type, `${t.interval_value} ${t.tracking_type}`, lastDone, nextDueDisplay, status];
        }),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
        didParseCell: (data: any) => { if (data.column.index === 6 && data.section === "body" && data.cell.raw === "OVERDUE") { data.cell.styles.textColor = [220, 50, 50]; data.cell.styles.fontStyle = "bold"; } },
      });
    }

    pdfFooter(doc);
    doc.save(`${reportId}_report_${now.toISOString().split("T")[0]}.pdf`);
  };

  const generateCSV = (reportId: string) => {
    let csv = "";
    const now = new Date();
    const vList = filtered.vehicles;
    const cList = filtered.certificates;
    const dList = filtered.drivers;
    const iList = filtered.inspections;
    const fList = filtered.fines;
    const jList = filtered.jobCards;
    const tList = filtered.trackers;

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
    } else if (reportId === "maintenance") {
      csv = "Date,Vehicle,Type,Workshop,Labour,Parts,Total,Status\n";
      jList.forEach(j => { csv += `"${j.work_date || ""}","${(j as any).vehicles?.registration_number || ""}","${j.job_type}","${j.workshop_name || ""}",${Number(j.labour_cost) || 0},${Number(j.parts_cost) || 0},${Number(j.total_cost) || 0},"${j.status || "open"}"\n`; });
    } else if (reportId === "trackers") {
      csv = "Vehicle,Tracker,Type,Interval,Last Done,Next Due\n";
      tList.forEach(t => {
        const lastDone = t.tracking_type === "days" ? (t.last_done_date || "") : (t.last_done_value ?? 0);
        const nextDue = t.tracking_type === "days" ? (t.next_due_date || "") : (t.next_due_value ?? 0);
        csv += `"${(t as any).vehicles?.registration_number || ""}","${t.tracker_name}","${t.tracking_type}",${t.interval_value},"${lastDone}","${nextDue}"\n`;
      });
    } else if (reportId === "hs") {
      csv = "Driver,Medical,Toolbox 30d,Criminal Check\n";
      dList.forEach(d => {
        const med = (driverDocs || []).some((doc: any) => doc.driver_id === d.id && /medical/i.test(doc.document_type || "") && doc.expiry_date && new Date(doc.expiry_date) > now) ? "Yes" : "No";
        const tb = (toolboxTalks || []).some((t: any) => t.driver_id === d.id && (now.getTime() - new Date(t.date_conducted).getTime()) / 86400000 <= 30) ? "Yes" : "No";
        const crim = (driverDocs || []).some((doc: any) => doc.driver_id === d.id && /criminal/i.test(doc.document_type || "")) ? "Yes" : "No";
        csv += `"${d.full_name}","${med}","${tb}","${crim}"\n`;
      });
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Generate and export compliance reports</p>
        </div>
        <BranchFilter value={branchId} onChange={setBranchId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => {
          const isDriver = report.id === "driver";
          return (
            <div key={report.id} className="stat-card flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">{report.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{report.desc}</p>
              </div>
              {isDriver ? (
                <button
                  onClick={() => navigate("/reports/driver-compliance")}
                  className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-md text-xs hover:opacity-90"
                >
                  Open Report <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
