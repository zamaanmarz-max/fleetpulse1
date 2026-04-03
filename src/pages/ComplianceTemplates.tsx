import { Shield, Plus, Copy, Edit, Loader2 } from "lucide-react";
import { useComplianceTemplates } from "@/hooks/useOrgData";

export default function ComplianceTemplates() {
  const { data: templates, isLoading } = useComplianceTemplates();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance Templates</h1>
          <p className="text-sm text-muted-foreground">Define required certificates per vehicle type</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> Create Template
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (templates || []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No templates found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(templates || []).map((t) => {
            const certs = Array.isArray(t.required_certificates) ? t.required_certificates : [];
            return (
              <div key={t.id} className="stat-card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{t.template_name}</h3>
                    {t.is_custom && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Custom</span>}
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1.5 text-muted-foreground hover:text-foreground rounded"><Edit className="w-4 h-4" /></button>
                    <button className="p-1.5 text-muted-foreground hover:text-foreground rounded"><Copy className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {certs.map((cert: any, i: number) => (
                    <span key={i} className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">
                      {typeof cert === "string" ? cert : cert.name || "Unknown"}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
