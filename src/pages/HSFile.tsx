import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Shield, Plus, X, Loader2, Upload, CheckCircle, AlertTriangle,
  Clock, FileText, ChevronDown, ChevronUp, Download, Building2,
  Sparkles, Eye, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Status helpers ────────────────────────────────────────────
const getDocStatus = (doc: any, req: any): "valid" | "expiring" | "expired" | "missing" | "pending" => {
  if (!doc) return "missing";
  if (!req.has_expiry) return "valid";
  if (!doc.expiry_date) return "pending";
  const days = Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  if (days <= 90) return "expiring";
  return "valid";
};

const STATUS_STYLE = {
  valid:    { bg: "bg-success/10 border-success/30",    text: "text-success",          badge: "bg-success/20 text-success",          label: "✓ Valid" },
  expiring: { bg: "bg-warning/10 border-warning/30",    text: "text-warning",          badge: "bg-warning/20 text-warning",          label: "⚠ Expiring" },
  expired:  { bg: "bg-destructive/10 border-destructive/30", text: "text-destructive", badge: "bg-destructive/20 text-destructive",  label: "✗ Expired" },
  missing:  { bg: "bg-muted/50 border-border",          text: "text-muted-foreground", badge: "bg-muted text-muted-foreground",      label: "Missing" },
  pending:  { bg: "bg-primary/10 border-primary/20",    text: "text-primary",          badge: "bg-primary/20 text-primary",          label: "Uploaded" },
};

const SECTION_ICONS: Record<number, string> = {
  1: "🏢", 2: "📋", 3: "⚠", 4: "📅", 5: "👤", 6: "🚨",
  7: "📝", 8: "🔍", 9: "🚑", 10: "⚙", 11: "🎓", 12: "⚖",
};

const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1";

export default function HSFile() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [showNewSite, setShowNewSite] = useState(false);
  const [showUpload, setShowUpload] = useState<{ req: any; site_id: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<number[]>([1, 2, 3]);
  const [uploading, setUploading] = useState(false);
  const [aiVerifying, setAiVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  const [siteForm, setSiteForm] = useState({ name: "", address: "", responsible_person: "", contact_number: "", site_type: "general", industry: "transport" });
  const [uploadForm, setUploadForm] = useState({ issue_date: "", expiry_date: "", uploaded_by: "", notes: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);

  // ── Data ─────────────────────────────────────────────────────
  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: ["hs_sites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hs_sites" as any).select("*").order("name");
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0,
  });

  const { data: requirements } = useQuery({
    queryKey: ["hs_document_requirements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hs_document_requirements" as any).select("*").order("section_number").order("sort_order");
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: Infinity,
  });

  const { data: documents, refetch: refetchDocs } = useQuery({
    queryKey: ["hs_documents", selectedSite],
    enabled: !!selectedSite,
    queryFn: async () => {
      const { data, error } = await supabase.from("hs_documents" as any).select("*").eq("site_id", selectedSite).order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0,
  });

  // ── Score calculation ─────────────────────────────────────────
  const docMap = new Map<string, any>();
  (documents || []).forEach(d => { if (!docMap.has(d.requirement_id)) docMap.set(d.requirement_id, d); });

  const reqs = requirements || [];
  const total = reqs.length;
  const validCount = reqs.filter(r => {
    const doc = docMap.get(r.id);
    const s = getDocStatus(doc, r);
    return s === "valid" || s === "pending";
  }).length;
  const score = total > 0 ? Math.round((validCount / total) * 100) : 0;
  const passed = score >= 75;

  const missingCount = reqs.filter(r => !docMap.get(r.id)).length;
  const expiredCount = reqs.filter(r => { const s = getDocStatus(docMap.get(r.id), r); return s === "expired"; }).length;
  const expiringCount = reqs.filter(r => { const s = getDocStatus(docMap.get(r.id), r); return s === "expiring"; }).length;

  // ── Grouped by section ────────────────────────────────────────
  const sections: Record<number, { name: string; reqs: any[] }> = {};
  reqs.forEach(r => {
    if (!sections[r.section_number]) sections[r.section_number] = { name: r.section_name, reqs: [] };
    sections[r.section_number].reqs.push(r);
  });

  // ── Create site ───────────────────────────────────────────────
  const handleCreateSite = async () => {
    if (!siteForm.name) { toast.error("Site name required"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("hs_sites" as any).insert({
      ...siteForm,
      organisation_id: profile?.organisation_id || null,
    }).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Site created");
    setShowNewSite(false);
    setSiteForm({ name: "", address: "", responsible_person: "", contact_number: "", site_type: "general", industry: "transport" });
    qc.invalidateQueries({ queryKey: ["hs_sites"] });
    setSelectedSite((data as any).id);
  };

  // ── AI Verification ───────────────────────────────────────────
  const handleAIVerify = async (file: File, requirement: any) => {
    setAiVerifying(true);
    setAiResult(null);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res((e.target?.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const isPdf = file.type === "application/pdf";
      const apiKey = (import.meta.env.VITE_ANTHROPIC_API_KEY || "");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [{
            role: "user",
            content: [
              ...(!isPdf ? [{
                type: "image",
                source: { type: "base64", media_type: file.type, data: base64 },
              }] : []),
              {
                type: "text",
                text: `You are verifying a South African workplace compliance document for the MARZ H&S system.
Required document: "${requirement.document_name}" — ${requirement.description || ""}

${isPdf ? "A PDF was uploaded (cannot be read visually)." : "Analyze this document image."}

Respond ONLY in JSON (no markdown):
{
  "document_type": "what type of document this appears to be",
  "company_name": "company name if visible",
  "issue_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "matches_requirement": true/false,
  "status": "valid" or "expired" or "cannot_verify",
  "confidence": "high" or "medium" or "low",
  "notes": "brief assessment — is this the right document? Any issues?"
}`,
              },
            ],
          }],
        }),
      });

      if (!response.ok) throw new Error("AI verification failed");
      const data = await response.json();
      const text = data.content?.[0]?.text || "{}";
      const cleaned = text.replace(/```json|```/g, "").trim();
      const result = JSON.parse(cleaned);
      setAiResult(result);

      if (result.expiry_date) setUploadForm(f => ({ ...f, expiry_date: result.expiry_date }));
      if (result.issue_date) setUploadForm(f => ({ ...f, issue_date: result.issue_date }));
      toast.success("AI verification complete");
    } catch (e) {
      toast.error("AI could not verify — please fill in dates manually");
      setAiResult({ status: "cannot_verify", notes: "Could not read document. Please enter details manually." });
    }
    setAiVerifying(false);
  };

  // ── Upload document ───────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile || !showUpload) { toast.error("Select a file"); return; }
    setUploading(true);

    const path = `hs/${showUpload.site_id}/${showUpload.req.id}/${Date.now()}_${uploadFile.name}`;
    const { error: upErr } = await supabase.storage.from("certificates").upload(path, uploadFile);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }

    const status = uploadForm.expiry_date
      ? (new Date(uploadForm.expiry_date) < new Date() ? "expired" : "valid")
      : "valid";

    const { error } = await supabase.from("hs_documents" as any).insert({
      site_id: showUpload.site_id,
      requirement_id: showUpload.req.id,
      file_url: path,
      issue_date: uploadForm.issue_date || null,
      expiry_date: uploadForm.expiry_date || null,
      uploaded_by: uploadForm.uploaded_by || null,
      notes: uploadForm.notes || null,
      ai_verified: !!aiResult && aiResult.status !== "cannot_verify",
      ai_status: aiResult?.status || null,
      ai_notes: aiResult?.notes || null,
      ai_extracted_expiry: aiResult?.expiry_date || null,
      ai_company_name: aiResult?.company_name || null,
      status,
    });

    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`✅ Document uploaded${aiResult?.ai_verified ? " + AI verified" : ""}`);
    setShowUpload(null);
    setUploadFile(null);
    setUploadForm({ issue_date: "", expiry_date: "", uploaded_by: "", notes: "" });
    setAiResult(null);
    refetchDocs();
  };

  // ── PDF Report ────────────────────────────────────────────────
  const generateReport = () => {
    if (!selectedSite) return;
    const site = (sites || []).find(s => s.id === selectedSite);
    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("MARZ — SHEQ FILE COMPLIANCE REPORT", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Site: ${site?.name || "Unknown"} | Date: ${new Date().toLocaleDateString("en-ZA")} | Responsible: ${site?.responsible_person || "—"}`, 14, 20);

    doc.setTextColor(0);
    const scoreColor = passed ? [21, 128, 61] : [153, 27, 27];
    doc.setFillColor(...scoreColor as [number, number, number]);
    doc.rect(14, 32, 182, 16, "F");
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`COMPLIANCE SCORE: ${score}% — ${passed ? "PASSED" : "FAILED"} (${validCount}/${total} documents compliant)`, 105, 43, { align: "center" });

    doc.setTextColor(0);
    const rows: any[] = [];
    Object.entries(sections).forEach(([secNum, sec]) => {
      sec.reqs.forEach(r => {
        const d = docMap.get(r.id);
        const s = getDocStatus(d, r);
        const days = d?.expiry_date ? Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / 86400000) : null;
        rows.push([
          `${secNum}. ${sec.name}`,
          r.document_name,
          s === "valid" ? "✓ Valid" : s === "expired" ? "✗ Expired" : s === "expiring" ? "⚠ Expiring" : "✗ Missing",
          d?.expiry_date || (r.has_expiry ? "Not set" : "N/A"),
          days !== null ? `${days}d` : "—",
          d?.uploaded_by || "—",
        ]);
      });
    });

    autoTable(doc, {
      startY: 54,
      head: [["Section", "Document", "Status", "Expiry", "Days Left", "Uploaded By"]],
      body: rows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 55 }, 2: { cellWidth: 22 } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const val = data.cell.text[0];
          if (val.includes("Valid")) data.cell.styles.textColor = [21, 128, 61];
          else if (val.includes("Expired") || val.includes("Missing")) data.cell.styles.textColor = [153, 27, 27];
          else data.cell.styles.textColor = [161, 98, 7];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("MARZ Technologies (Pty) Ltd | Powered by MARZ Compliance Platform", 14, doc.internal.pageSize.height - 6);
    doc.save(`SHEQ_Report_${site?.name?.replace(/ /g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Report downloaded");
  };

  const toggleSection = (n: number) => setExpandedSections(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  const currentSite = (sites || []).find(s => s.id === selectedSite);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> H&S File
          </h1>
          <p className="text-sm text-muted-foreground">Digital SHEQ file — 44 required documents, OHS Act compliant</p>
        </div>
        <div className="flex gap-2">
          {selectedSite && (
            <button onClick={generateReport} className="flex items-center gap-2 bg-success/20 text-success border border-success/30 px-3 py-2 rounded-lg text-sm hover:opacity-80">
              <Download className="w-4 h-4" /> Report
            </button>
          )}
          <button onClick={() => setShowNewSite(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Site
          </button>
        </div>
      </div>

      {/* Site selector */}
      {sitesLoading
        ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        : (sites || []).length === 0
          ? (
            <div className="glass-card p-8 text-center space-y-3">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">No H&S sites yet</p>
              <p className="text-xs text-muted-foreground">Add your first site to start building your digital SHEQ file</p>
              <button onClick={() => setShowNewSite(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm mx-auto hover:opacity-90">
                <Plus className="w-4 h-4" /> Add First Site
              </button>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {(sites || []).map(s => (
                <button key={s.id} onClick={() => setSelectedSite(s.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${selectedSite === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border hover:border-primary/40"}`}>
                  <Building2 className="w-3.5 h-3.5 inline mr-1.5" />{s.name}
                </button>
              ))}
            </div>
          )
      }

      {/* Score card */}
      {selectedSite && (
        <div className={`glass-card p-5 border-2 ${passed ? "border-success/40" : score >= 50 ? "border-warning/40" : "border-destructive/40"}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">SHEQ Compliance Score — {currentSite?.name}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className={`text-5xl font-bold ${passed ? "text-success" : score >= 50 ? "text-warning" : "text-destructive"}`}>{score}%</span>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${passed ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                  {passed ? "✓ COMPLIANT" : "✗ NON-COMPLIANT"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{validCount} of {total} documents valid · 75% threshold</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-destructive/10 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Missing</p>
                <p className="text-xl font-bold text-destructive">{missingCount}</p>
              </div>
              <div className="bg-destructive/10 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Expired</p>
                <p className="text-xl font-bold text-destructive">{expiredCount}</p>
              </div>
              <div className="bg-warning/10 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Expiring</p>
                <p className="text-xl font-bold text-warning">{expiringCount}</p>
              </div>
              <div className="bg-success/10 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Valid</p>
                <p className="text-xl font-bold text-success">{validCount}</p>
              </div>
            </div>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
            <div className={`h-full rounded-full transition-all ${passed ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${score}%` }} />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-foreground/30" style={{ left: "75%" }}>
              <span className="absolute -top-5 left-1 text-xs text-muted-foreground">75%</span>
            </div>
          </div>
        </div>
      )}

      {/* 12 Sections */}
      {selectedSite && Object.entries(sections).map(([secNumStr, sec]) => {
        const secNum = parseInt(secNumStr);
        const isOpen = expandedSections.includes(secNum);
        const secDocs = sec.reqs.map(r => ({ req: r, doc: docMap.get(r.id), status: getDocStatus(docMap.get(r.id), r) }));
        const secValid = secDocs.filter(d => d.status === "valid" || d.status === "pending").length;
        const secTotal = secDocs.length;
        const secPct = Math.round((secValid / secTotal) * 100);
        const hasIssues = secDocs.some(d => d.status === "expired" || d.status === "missing");

        return (
          <div key={secNum} className={`glass-card overflow-hidden border ${hasIssues ? "border-destructive/20" : "border-border"}`}>
            <button onClick={() => toggleSection(secNum)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/20 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">{SECTION_ICONS[secNum]}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{secNum}. {sec.name}</p>
                  <p className="text-xs text-muted-foreground">{secTotal} documents required</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-sm font-bold ${secPct === 100 ? "text-success" : secPct >= 75 ? "text-warning" : "text-destructive"}`}>{secPct}%</p>
                  <p className="text-xs text-muted-foreground">{secValid}/{secTotal}</p>
                </div>
                {hasIssues && <AlertTriangle className="w-4 h-4 text-destructive" />}
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                {secDocs.map(({ req, doc, status }) => {
                  const style = STATUS_STYLE[status];
                  const days = doc?.expiry_date ? Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / 86400000) : null;

                  return (
                    <div key={req.id} className={`flex items-center justify-between p-3 rounded-xl border ${style.bg} transition-all`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${style.text}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{req.document_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>{style.label}</span>
                            {req.has_expiry && req.frequency && <span className="text-xs text-muted-foreground">{req.frequency}</span>}
                            {days !== null && <span className={`text-xs font-mono ${days < 0 ? "text-destructive" : days <= 30 ? "text-warning" : "text-muted-foreground"}`}>{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}</span>}
                            {doc?.ai_verified && <span className="text-xs text-primary flex items-center gap-0.5"><Sparkles className="w-3 h-3" /> AI verified</span>}
                          </div>
                          {doc?.ai_notes && <p className="text-xs text-muted-foreground mt-1 italic">{doc.ai_notes}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-3 flex-shrink-0">
                        {doc?.file_url && (
                          <button onClick={async () => {
                            const { data } = await supabase.storage.from("certificates").getPublicUrl(doc.file_url);
                            window.open(data.publicUrl, "_blank");
                          }} className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        )}
                        <button onClick={() => { setShowUpload({ req, site_id: selectedSite }); setAiResult(null); setUploadFile(null); setUploadForm({ issue_date: "", expiry_date: "", uploaded_by: "", notes: "" }); }}
                          className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2.5 py-1.5 rounded-lg hover:opacity-90">
                          <Upload className="w-3 h-3" /> {doc ? "Update" : "Upload"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!selectedSite && (sites || []).length > 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">
          Select a site above to view its H&S file
        </div>
      )}

      {/* Upload Panel */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setShowUpload(null)} />
          <div className="w-full max-w-md bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{showUpload.req.document_name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{showUpload.req.section_name} · {showUpload.req.description}</p>
              </div>
              <button onClick={() => setShowUpload(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* File select */}
              <div>
                <label className={labelCls}>Upload Document *</label>
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors">
                  {uploadFile
                    ? <p className="text-sm text-foreground font-medium">{uploadFile.name}</p>
                    : <><Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" /><p className="text-sm text-muted-foreground">Click to select PDF or image</p></>
                  }
                </button>
                <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setUploadFile(f); setAiResult(null); }
                }} />
              </div>

              {/* AI Verify */}
              {uploadFile && (
                <button onClick={() => handleAIVerify(uploadFile, showUpload.req)} disabled={aiVerifying}
                  className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/30 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/20 disabled:opacity-50">
                  {aiVerifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <><Sparkles className="w-4 h-4" /> AI Verify Document</>}
                </button>
              )}

              {/* AI Result */}
              {aiResult && (
                <div className={`rounded-xl p-3 border text-sm space-y-1 ${aiResult.status === "valid" ? "bg-success/10 border-success/30" : aiResult.status === "cannot_verify" ? "bg-muted border-border" : "bg-destructive/10 border-destructive/30"}`}>
                  <p className="font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    AI Assessment: <span className="capitalize">{aiResult.status?.replace(/_/g, " ")}</span>
                  </p>
                  {aiResult.company_name && <p className="text-xs text-muted-foreground">Company: {aiResult.company_name}</p>}
                  {aiResult.document_type && <p className="text-xs text-muted-foreground">Type: {aiResult.document_type}</p>}
                  <p className="text-xs text-foreground">{aiResult.notes}</p>
                  {aiResult.confidence && <p className="text-xs text-muted-foreground">Confidence: {aiResult.confidence}</p>}
                </div>
              )}

              {/* Dates */}
              {showUpload.req.has_expiry && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Issue Date</label>
                    <input type="date" value={uploadForm.issue_date} onChange={e => setUploadForm({ ...uploadForm, issue_date: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Expiry Date</label>
                    <input type="date" value={uploadForm.expiry_date} onChange={e => setUploadForm({ ...uploadForm, expiry_date: e.target.value })} className={inputCls} />
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Uploaded By</label>
                <input value={uploadForm.uploaded_by} onChange={e => setUploadForm({ ...uploadForm, uploaded_by: e.target.value })} placeholder="Your name" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={uploadForm.notes} onChange={e => setUploadForm({ ...uploadForm, notes: e.target.value })} rows={2} className={inputCls} />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={handleUpload} disabled={uploading || !uploadFile}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading..." : "Save Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Site Form */}
      {showNewSite && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setShowNewSite(false)} />
          <div className="w-full max-w-md bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <h2 className="text-base font-bold text-foreground">Add H&S Site</h2>
              <button onClick={() => setShowNewSite(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div><label className={labelCls}>Site Name *</label><input value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="e.g. Vector Logistics — Midrand" className={inputCls} /></div>
              <div><label className={labelCls}>Address</label><input value={siteForm.address} onChange={e => setSiteForm({ ...siteForm, address: e.target.value })} placeholder="Site address" className={inputCls} /></div>
              <div><label className={labelCls}>Responsible Person</label><input value={siteForm.responsible_person} onChange={e => setSiteForm({ ...siteForm, responsible_person: e.target.value })} placeholder="Site H&S responsible person" className={inputCls} /></div>
              <div><label className={labelCls}>Contact Number</label><input value={siteForm.contact_number} onChange={e => setSiteForm({ ...siteForm, contact_number: e.target.value })} placeholder="Contact number" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Industry</label>
                <select value={siteForm.industry} onChange={e => setSiteForm({ ...siteForm, industry: e.target.value })} className={inputCls}>
                  <option value="transport">Transport / Fleet</option>
                  <option value="construction">Construction</option>
                  <option value="healthcare">Healthcare / Medical</option>
                  <option value="retail">Retail</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="food">Food & Hospitality</option>
                  <option value="general">General Business</option>
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={handleCreateSite} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />} Create Site
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
