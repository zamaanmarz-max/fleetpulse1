import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Download, Plus, X, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── OHSA Audit sections — matches Vector Logistics audit exactly ──
const SECTIONS = [
  { key: "h_and_s_file",    label: "Health and Safety File",                    max: 280, pass: 75 },
  { key: "registers",       label: "Registers and Checklists",                  max: 80,  pass: 75 },
  { key: "equipment_cert",  label: "Equipment Certification",                   max: 30,  pass: 75 },
  { key: "training",        label: "Training",                                  max: 80,  pass: 75 },
  { key: "emergency",       label: "Emergency Evacuation",                      max: 20,  pass: 75 },
  { key: "toolbox",         label: "Toolbox Talks",                             max: 30,  pass: 75 },
  { key: "permits",         label: "Permits",                                   max: 20,  pass: 75 },
  { key: "ohs_act",         label: "Occupational Health and Safety Act, 85 of 1993", max: 230, pass: 75 },
  { key: "erw",             label: "Environmental Regulations for Workplaces, 1987 (ERW)", max: 30, pass: 75 },
  { key: "per",             label: "Pressure Equipment Regulations, 2009 (PER)", max: 40, pass: 75 },
  { key: "wall_charts",     label: "Wall Charts",                               max: 40,  pass: 75 },
  { key: "coida",           label: "Compensation for Injuries & Diseases Act, 130 of 1993", max: 40, pass: 75 },
  { key: "gar",             label: "General Administrative Regulations",        max: 30,  pass: 75 },
];

const TOTAL_MAX = SECTIONS.reduce((s, sec) => s + sec.max, 0); // 950

interface Props {
  sites: any[];
}

export function ComplianceAuditTab({ sites }: Props) {
  const qc = useQueryClient();
  const [showNewAudit, setShowNewAudit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  const [newAudit, setNewAudit] = useState({
    site_id: sites[0]?.id || "",
    audit_date: new Date().toISOString().split("T")[0],
    auditor: "",
    notes: "",
    scores: Object.fromEntries(SECTIONS.map(s => [s.key, s.max])), // default to full score
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["compliance_audit_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_audit_sessions" as any)
        .select("*, compliance_sites(name)")
        .order("audit_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0, refetchOnMount: "always",
  });

  const calcTotals = (scores: Record<string, number>) => {
    const total = SECTIONS.reduce((s, sec) => s + (Number(scores[sec.key]) || 0), 0);
    const pct = Math.round((total / TOTAL_MAX) * 100 * 100) / 100;
    return { total, pct };
  };

  const handleSaveAudit = async () => {
    if (!newAudit.site_id) { toast.error("Select a site"); return; }
    const { total, pct } = calcTotals(newAudit.scores);
    setSaving(true);
    const { error } = await supabase.from("compliance_audit_sessions" as any).insert({
      site_id: newAudit.site_id,
      audit_date: newAudit.audit_date,
      auditor: newAudit.auditor || null,
      notes: newAudit.notes || null,
      scores: newAudit.scores,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Audit saved — ${pct}%`);
    setShowNewAudit(false);
    qc.invalidateQueries({ queryKey: ["compliance_audit_sessions"] });
  };

  const generatePDF = (session: any) => {
    const doc = new jsPDF();
    const scores = session.scores || {};
    const site = session.compliance_sites?.name || "Vector Logistics";
    const date = session.audit_date;

    // Header
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LEGAL COMPLIANCE INTERNAL AUDIT", 14, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`OHSA Internal Audit — ${date} | Site: ${site}`, 14, 20);
    if (session.auditor) doc.text(`Auditor: ${session.auditor}`, 140, 20);

    doc.setTextColor(0, 0, 0);

    // Summary score box
    const { total, pct } = calcTotals(scores);
    const passed = pct >= 75;
    doc.setFillColor(passed ? 220 : 254, passed ? 252 : 202, passed ? 231 : 202);
    doc.roundedRect(14, 32, 182, 20, 3, 3, "F");
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(passed ? 21 : 153, passed ? 128 : 27, passed ? 61 : 27);
    doc.text(`${pct}%`, 100, 45, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`Total: ${total} / ${TOTAL_MAX} | Pass Threshold: 75% | Status: ${passed ? "PASSED" : "FAILED"}`, 100, 50, { align: "center" });

    // Main scoring table
    const rows = SECTIONS.map(sec => {
      const score = Number(scores[sec.key]) || 0;
      const pctSec = sec.max > 0 ? Math.round((score / sec.max) * 100) : 0;
      const passSec = pctSec >= sec.pass;
      return [
        sec.label,
        String(score),
        String(sec.max),
        `${sec.pass}%`,
        `${pctSec}%`,
        passSec ? "PASS" : "FAIL",
      ];
    });

    autoTable(doc, {
      startY: 58,
      head: [["LEGISLATION", "SCORE", "TOTAL", "PASS", "PERCENTAGE", "RESULT"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: "center", cellWidth: 18 },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "center", cellWidth: 18 },
        4: { halign: "center", cellWidth: 22 },
        5: { halign: "center", cellWidth: 18 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          if (data.cell.text[0] === "PASS") {
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = "bold";
          } else if (data.cell.text[0] === "FAIL") {
            data.cell.styles.textColor = [153, 27, 27];
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.section === "body" && data.column.index === 4) {
          const val = parseFloat(data.cell.text[0]);
          if (val < 75) data.cell.styles.textColor = [153, 27, 27];
          else data.cell.styles.textColor = [21, 128, 61];
        }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Total row
    autoTable(doc, {
      startY: finalY,
      body: [["GRAND TOTAL", String(total), String(TOTAL_MAX), "75%", `${pct}%`, passed ? "PASSED" : "FAILED"]],
      styles: { fontSize: 10, fontStyle: "bold", fillColor: [241, 245, 249] },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: "center", cellWidth: 18 },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "center", cellWidth: 18 },
        4: { halign: "center", cellWidth: 22 },
        5: { halign: "center", cellWidth: 18, textColor: passed ? [21, 128, 61] : [153, 27, 27] },
      },
    });

    if (session.notes) {
      const y2 = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(`Notes: ${session.notes}`, 14, y2);
    }

    // Footer
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("MARZ Technologies (Pty) Ltd | FleetPulse Compliance System", 14, doc.internal.pageSize.height - 10);
    doc.text(`Generated: ${new Date().toLocaleString("en-ZA")}`, 150, doc.internal.pageSize.height - 10);

    doc.save(`OHSA_Audit_${site.replace(/ /g, "_")}_${date}.pdf`);
    toast.success("PDF report downloaded");
  };

  const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block text-sm font-medium text-foreground mb-1";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">OHSA Internal Audit scoring — 13 sections, 950 points, 75% pass threshold</p>
        <button onClick={() => setShowNewAudit(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> New Audit
        </button>
      </div>

      {/* Past sessions */}
      {isLoading
        ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        : (sessions || []).length === 0
          ? <div className="glass-card p-8 text-center text-muted-foreground text-sm">No audits recorded yet. Click "New Audit" to capture your first score.</div>
          : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border">
                  {["Date", "Site", "Auditor", "Score", "Total", "Result", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(sessions || []).map((s: any) => {
                  const { total, pct } = calcTotals(s.scores || {});
                  const passed = pct >= 75;
                  return (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-foreground font-mono">{s.audit_date}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{s.compliance_sites?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{s.auditor || "—"}</td>
                      <td className="px-4 py-3 text-sm font-bold text-foreground">{total}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{TOTAL_MAX}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${passed ? "text-success" : "text-destructive"}`}>{pct}%</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${passed ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                            {passed ? "PASSED" : "FAILED"}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-secondary rounded-full mt-1.5 relative">
                          <div className={`h-full rounded-full ${passed ? "bg-success" : "bg-destructive"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          <div className="absolute top-0 h-full border-l-2 border-warning" style={{ left: "75%" }} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedSession(s)} className="text-xs text-primary hover:underline">View</button>
                          <button onClick={() => generatePDF(s)} className="text-xs text-success hover:underline flex items-center gap-1"><Download className="w-3 h-3" /> PDF</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      }

      {/* New Audit Form */}
      {showNewAudit && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setShowNewAudit(false)} />
          <div className="w-full max-w-2xl bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New OHSA Audit</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Enter scores per section — pass threshold is 75%</p>
              </div>
              <button onClick={() => setShowNewAudit(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Site *</label>
                  <select value={newAudit.site_id} onChange={e => setNewAudit({ ...newAudit, site_id: e.target.value })} className={inputCls}>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Audit Date</label>
                  <input type="date" value={newAudit.audit_date} onChange={e => setNewAudit({ ...newAudit, audit_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Auditor</label>
                  <input value={newAudit.auditor} onChange={e => setNewAudit({ ...newAudit, auditor: e.target.value })} placeholder="Name" className={inputCls} />
                </div>
              </div>

              {/* Live score */}
              {(() => {
                const { total, pct } = calcTotals(newAudit.scores);
                const passed = pct >= 75;
                return (
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${passed ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
                    <div>
                      <p className="text-xs text-muted-foreground">Live Score</p>
                      <p className={`text-2xl font-bold ${passed ? "text-success" : "text-destructive"}`}>{pct}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{total} / {TOTAL_MAX}</p>
                      <p className={`text-xs font-bold ${passed ? "text-success" : "text-destructive"}`}>{passed ? "✓ PASSING" : "✗ BELOW 75% THRESHOLD"}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Section scores */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Section Scores</p>
                {SECTIONS.map(sec => {
                  const score = Number(newAudit.scores[sec.key]) || 0;
                  const pct = sec.max > 0 ? Math.round((score / sec.max) * 100) : 0;
                  const passed = pct >= sec.pass;
                  return (
                    <div key={sec.key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-foreground">{sec.label}</span>
                          <span className={`text-xs font-semibold ${passed ? "text-success" : "text-destructive"}`}>{pct}%</span>
                        </div>
                        <div className="h-1 bg-secondary rounded-full relative">
                          <div className={`h-full rounded-full ${passed ? "bg-success" : "bg-destructive"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          <div className="absolute top-0 h-full border-l border-warning opacity-50" style={{ left: "75%" }} />
                        </div>
                      </div>
                      <input
                        type="number" min={0} max={sec.max}
                        value={newAudit.scores[sec.key]}
                        onChange={e => setNewAudit({ ...newAudit, scores: { ...newAudit.scores, [sec.key]: Math.min(Number(e.target.value), sec.max) } })}
                        className="w-20 text-center bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-xs text-muted-foreground w-12 text-right">/ {sec.max}</span>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className={labelCls}>Notes / Non-Conformances</label>
                <textarea value={newAudit.notes} onChange={e => setNewAudit({ ...newAudit, notes: e.target.value })} rows={3} placeholder="Areas of non-compliance, corrective actions required..." className={inputCls} />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border flex-shrink-0 flex gap-3">
              <button onClick={handleSaveAudit} disabled={saving} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Save Audit Score
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session detail view */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setSelectedSession(null)} />
          <div className="w-full max-w-2xl bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">Audit — {selectedSession.audit_date}</h2>
                <p className="text-xs text-muted-foreground">{selectedSession.compliance_sites?.name} {selectedSession.auditor ? `· Auditor: ${selectedSession.auditor}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => generatePDF(selectedSession)} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90">
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button onClick={() => setSelectedSession(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {(() => {
                const { total, pct } = calcTotals(selectedSession.scores || {});
                const passed = pct >= 75;
                return (
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${passed ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
                      <p className={`text-3xl font-bold ${passed ? "text-success" : "text-destructive"}`}>{pct}%</p>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{total} / {TOTAL_MAX} points</p>
                        <p className={`text-sm font-bold ${passed ? "text-success" : "text-destructive"}`}>{passed ? "✓ PASSED" : "✗ FAILED"}</p>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border">
                        <th className="text-left py-2 text-xs text-muted-foreground uppercase">Section</th>
                        <th className="text-center py-2 text-xs text-muted-foreground uppercase">Score</th>
                        <th className="text-center py-2 text-xs text-muted-foreground uppercase">Max</th>
                        <th className="text-center py-2 text-xs text-muted-foreground uppercase">%</th>
                      </tr></thead>
                      <tbody>
                        {SECTIONS.map(sec => {
                          const score = Number((selectedSession.scores || {})[sec.key]) || 0;
                          const pctSec = sec.max > 0 ? Math.round((score / sec.max) * 100) : 0;
                          return (
                            <tr key={sec.key} className="border-b border-border/40">
                              <td className="py-2 text-foreground">{sec.label}</td>
                              <td className="py-2 text-center font-mono text-foreground">{score}</td>
                              <td className="py-2 text-center text-muted-foreground">{sec.max}</td>
                              <td className={`py-2 text-center font-semibold ${pctSec >= 75 ? "text-success" : "text-destructive"}`}>{pctSec}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {selectedSession.notes && <div className="bg-secondary/50 rounded-xl p-3 text-sm text-foreground"><p className="text-xs font-semibold text-muted-foreground mb-1">Notes:</p><p>{selectedSession.notes}</p></div>}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
