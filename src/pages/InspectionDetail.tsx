import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Eye, X, Download } from "lucide-react";
import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const conditionColors: Record<string, string> = {
  good: "bg-success/20 text-success",
  fair: "bg-warning/20 text-warning",
  poor: "bg-destructive/20 text-destructive",
  unroadworthy: "bg-destructive/30 text-destructive",
};

const severityColors: Record<string, string> = {
  minor: "bg-success/20 text-success",
  moderate: "bg-warning/20 text-warning",
  severe: "bg-destructive/20 text-destructive",
  critical: "bg-destructive/30 text-destructive",
};

export default function InspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const { data: inspection, isLoading } = useQuery({
    queryKey: ["inspection_detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_inspections")
        .select("*, vehicles(registration_number, make, model, year, fleet_number), inspector:users!damage_inspections_inspector_id_fkey(full_name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: damageItems } = useQuery({
    queryKey: ["inspection_damage_items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_items")
        .select("*")
        .eq("inspection_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const itemsWithUrls = await Promise.all(
        (data || []).map(async (item) => {
          const urls: string[] = [];
          const photoUrls = (item.photo_urls as string[]) || [];
          for (const path of photoUrls) {
            const { data: signedData } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
            if (signedData?.signedUrl) urls.push(signedData.signedUrl);
          }
          return { ...item, signedPhotoUrls: urls };
        })
      );
      return itemsWithUrls;
    },
    enabled: !!id,
  });

  const generatePDF = () => {
    if (!inspection) return;
    const doc = new jsPDF();
    const v = inspection as any;

    doc.setFontSize(18);
    doc.text("Damage Inspection Report", 14, 22);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("FleetPulse by MARZ Technologies", 14, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);
    doc.setTextColor(0);

    doc.setFontSize(11);
    doc.text("Vehicle Details", 14, 48);
    doc.setFontSize(10);
    doc.text(`Registration: ${v.vehicles?.registration_number || "N/A"}`, 14, 56);
    doc.text(`Make/Model: ${v.vehicles?.make || ""} ${v.vehicles?.model || ""}`, 14, 62);
    doc.text(`Fleet No: ${v.vehicles?.fleet_number || "-"}`, 14, 68);
    doc.text(`Inspection Date: ${inspection.inspection_date || "-"}`, 14, 78);
    doc.text(`Inspector: ${v.inspector?.full_name || "-"}`, 14, 84);
    doc.text(`Overall Condition: ${(inspection.overall_condition || "-").toUpperCase()}`, 14, 90);
    doc.text(`Odometer: ${inspection.odometer_at_inspection?.toLocaleString() || "-"} km`, 14, 96);

    if ((damageItems || []).length > 0) {
      doc.setFontSize(11);
      doc.text("Damage Items", 14, 110);

      autoTable(doc, {
        startY: 116,
        head: [["#", "Location", "Type", "Severity", "Immediate?", "Resolved?", "Description"]],
        body: (damageItems || []).map((item, i) => [
          String(i + 1),
          item.location || "-",
          item.damage_type || "-",
          (item.severity || "-").toUpperCase(),
          item.requires_immediate_action ? "Yes" : "No",
          item.resolved ? "Yes" : "No",
          (item.description || "-").substring(0, 60),
        ]),
        theme: "striped",
        headStyles: { fillColor: [41, 128, 185] },
        didParseCell: (data: any) => {
          if (data.column.index === 3 && data.section === "body" && ["SEVERE", "CRITICAL"].includes(data.cell.raw)) {
            data.cell.styles.textColor = [220, 50, 50];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("© 2026 MARZ Technologies (Pty) Ltd. All rights reserved.", 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`inspection_${inspection.inspection_date || "report"}.pdf`);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!inspection) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-muted-foreground">Inspection not found.</p>
      </div>
    );
  }

  const v = inspection as any;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Inspection — {v.vehicles?.registration_number || "N/A"}</h1>
          <p className="text-sm text-muted-foreground">{inspection.inspection_date} · Inspector: {v.inspector?.full_name || "N/A"}</p>
        </div>
        <button onClick={generatePDF} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
          <Download className="w-4 h-4" /> Generate PDF
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Condition</p>
          <span className={`text-sm font-bold px-3 py-1 rounded-full capitalize ${conditionColors[inspection.overall_condition || "good"]}`}>{inspection.overall_condition}</span>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Odometer</p>
          <p className="text-lg font-bold text-foreground">{inspection.odometer_at_inspection?.toLocaleString() || "-"} km</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Damage Items</p>
          <p className="text-lg font-bold text-foreground">{inspection.total_damage_items ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Critical Damage</p>
          <p className={`text-lg font-bold ${inspection.has_critical_damage ? "text-destructive" : "text-success"}`}>{inspection.has_critical_damage ? "Yes" : "No"}</p>
        </div>
      </div>

      {inspection.notes && (
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-foreground">{inspection.notes}</p>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Damage Items ({(damageItems || []).length})</h3>
        {(damageItems || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No damage items recorded.</p>
        ) : (
          <div className="space-y-3">
            {(damageItems || []).map((item: any, idx: number) => (
              <div key={item.id} className="stat-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">#{idx + 1} — {item.location || "Unknown location"}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${severityColors[item.severity || "minor"]}`}>{item.severity}</span>
                    {item.resolved ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-success/20 text-success">Resolved</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-destructive/20 text-destructive">Open</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground font-medium">{item.damage_type || "-"}</span></div>
                  <div><span className="text-muted-foreground">Immediate:</span> <span className={`font-medium ${item.requires_immediate_action ? "text-destructive" : "text-foreground"}`}>{item.requires_immediate_action ? "Yes" : "No"}</span></div>
                  <div><span className="text-muted-foreground">New:</span> <span className="text-foreground font-medium">{item.is_new_damage ? "Yes" : "No"}</span></div>
                  <div><span className="text-muted-foreground">Repair:</span> <span className={`font-medium ${item.resolved ? "text-success" : "text-warning"}`}>{item.resolved ? "Repaired" : "Pending"}</span></div>
                </div>

                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}

                {item.signedPhotoUrls && item.signedPhotoUrls.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {item.signedPhotoUrls.map((url: string, pi: number) => (
                      <div key={pi} className="relative group">
                        <img src={url} alt={`Damage ${idx + 1} photo ${pi + 1}`} className="w-20 h-20 object-cover rounded-lg border border-border" />
                        <button onClick={() => setViewingPhoto(url)} className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity">
                          <Eye className="w-5 h-5 text-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80" onClick={() => setViewingPhoto(null)}>
          <button onClick={() => setViewingPhoto(null)} className="absolute top-4 right-4 text-foreground bg-secondary rounded-full p-2">
            <X className="w-6 h-6" />
          </button>
          <img src={viewingPhoto} alt="Full size" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
