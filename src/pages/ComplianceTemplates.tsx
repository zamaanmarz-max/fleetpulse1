import { Shield, Plus, Edit, Loader2, X, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { useComplianceTemplates, useVehicles } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const defaultCertTypes = [
  "Certificate of Fitness (COF)",
  "Operating Licence",
  "Cross-border Permit",
  "Dangerous Goods Permit",
  "Abnormal Load Permit",
  "Motor Vehicle Licence Disc",
  "Insurance Certificate",
  "Roadworthy Certificate",
];

export default function ComplianceTemplates() {
  const { data: templates, isLoading } = useComplianceTemplates();
  const { data: vehicles } = useVehicles();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [customCert, setCustomCert] = useState("");

  const toggleCert = (cert: string) => {
    setSelectedCerts(prev => prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]);
  };

  const addCustomCert = () => {
    if (customCert.trim() && !selectedCerts.includes(customCert.trim())) {
      setSelectedCerts(prev => [...prev, customCert.trim()]);
      setCustomCert("");
    }
  };

  const vehicleCountForTemplate = (templateId: string) => {
    return (vehicles || []).filter(v => v.compliance_template_id === templateId).length;
  };

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setTemplateName(t.template_name);
    const certs = Array.isArray(t.required_certificates) ? t.required_certificates.map((c: any) => typeof c === "string" ? c : c.name || "") : [];
    setSelectedCerts(certs);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!templateName.trim()) { toast.error("Template name is required"); return; }
    setSaving(true);

    if (editingId) {
      const { error } = await supabase.from("compliance_templates").update({
        template_name: templateName,
        required_certificates: selectedCerts,
      }).eq("id", editingId);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Template updated");
    } else {
      const { error } = await supabase.from("compliance_templates").insert({
        organisation_id: profile?.organisation_id || null,
        template_name: templateName,
        required_certificates: selectedCerts,
        is_custom: true,
        created_by: user?.id || null,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Template created");
    }

    setShowCreate(false);
    setEditingId(null);
    setTemplateName("");
    setSelectedCerts([]);
    queryClient.invalidateQueries({ queryKey: ["compliance_templates"] });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance Templates</h1>
          <p className="text-sm text-muted-foreground">Define which certificates are required for each vehicle type</p>
        </div>
        <button onClick={() => { setShowCreate(true); setEditingId(null); setTemplateName(""); setSelectedCerts([]); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> Create Custom Template
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (templates || []).length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">No templates found. Create your first compliance template.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(templates || []).map((t) => {
            const certs = Array.isArray(t.required_certificates) ? t.required_certificates : [];
            const vCount = vehicleCountForTemplate(t.id);
            return (
              <div key={t.id} className="stat-card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-foreground">{t.template_name}</h3>
                      <p className="text-xs text-muted-foreground">{vCount} vehicle{vCount !== 1 ? "s" : ""} using this template</p>
                    </div>
                    {t.is_custom && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Custom</span>}
                  </div>
                  <button onClick={() => startEdit(t)} className="p-1.5 text-muted-foreground hover:text-foreground rounded"><Edit className="w-4 h-4" /></button>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Required Certificates ({certs.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {certs.map((cert: any, i: number) => (
                      <span key={i} className="text-xs bg-secondary text-foreground px-2.5 py-1 rounded flex items-center gap-1">
                        <Check className="w-3 h-3 text-success" />
                        {typeof cert === "string" ? cert : cert.name || "Unknown"}
                      </span>
                    ))}
                    {certs.length === 0 && <span className="text-xs text-muted-foreground">No certificates defined</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Panel */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/50" onClick={() => setShowCreate(false)} />
          <div className="w-[480px] bg-card border-l border-border p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{editingId ? "Edit Template" : "Create Custom Template"}</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Template Name *</label>
              <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Food Transport, Long Haul" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Required Certificates</label>
              <div className="space-y-2">
                {defaultCertTypes.map(cert => (
                  <label key={cert} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                    <input type="checkbox" checked={selectedCerts.includes(cert)} onChange={() => toggleCert(cert)} className="rounded border-border" />
                    <span className="text-sm text-foreground">{cert}</span>
                  </label>
                ))}
                {selectedCerts.filter(c => !defaultCertTypes.includes(c)).map(cert => (
                  <div key={cert} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked onChange={() => toggleCert(cert)} className="rounded border-border" />
                      <span className="text-sm text-foreground">{cert}</span>
                    </label>
                    <button onClick={() => toggleCert(cert)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input type="text" value={customCert} onChange={(e) => setCustomCert(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomCert()} placeholder="Add custom certificate type..." className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={addCustomCert} className="bg-secondary text-foreground px-3 py-2 rounded-lg text-sm hover:bg-secondary/80">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-3">Selected: {selectedCerts.length} certificate{selectedCerts.length !== 1 ? "s" : ""}</p>
              <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingId ? "Update Template" : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
