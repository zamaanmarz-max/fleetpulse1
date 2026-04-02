import { Shield, Plus, Copy, Edit } from "lucide-react";

const mockTemplates = [
  { id: "1", name: "General", vehicleCount: 45, isCustom: false, certs: ["COF Certificate", "Licence Disc", "Operator Permit", "Fire Extinguisher Certificate"] },
  { id: "2", name: "Food Transport", vehicleCount: 18, isCustom: false, certs: ["COF Certificate", "Licence Disc", "Operator Permit", "Refrigeration Certificate", "Temperature Log Compliance", "Fumigation Certificate"] },
  { id: "3", name: "Hazmat", vehicleCount: 12, isCustom: false, certs: ["COF Certificate", "Licence Disc", "Operator Permit", "Dangerous Goods Permit", "Fire Extinguisher Certificate", "Fuel Certificate"] },
  { id: "4", name: "Construction", vehicleCount: 8, isCustom: true, certs: ["COF Certificate", "Licence Disc", "Crane and Lifting Certificate", "Abnormal Load Permit"] },
];

export default function ComplianceTemplates() {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockTemplates.map((t) => (
          <div key={t.id} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{t.name}</h3>
                {t.isCustom && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Custom</span>}
              </div>
              <div className="flex gap-1">
                <button className="p-1.5 text-muted-foreground hover:text-foreground rounded"><Edit className="w-4 h-4" /></button>
                <button className="p-1.5 text-muted-foreground hover:text-foreground rounded"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{t.vehicleCount} vehicles using this template</p>
            <div className="flex flex-wrap gap-1.5">
              {t.certs.map((cert) => (
                <span key={cert} className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">{cert}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
