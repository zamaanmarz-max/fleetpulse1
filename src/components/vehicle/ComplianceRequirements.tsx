import { CheckCircle, AlertTriangle, XCircle, MinusCircle } from "lucide-react";
import { getEquipmentComplianceStatus } from "@/lib/vehicleEquipment";

interface Props {
  equipment: string[];
  certificates: { certificate_type: string; expiry_date: string | null; status: string | null }[];
  onRequirementClick?: (certificateType: string) => void;
}

const icons = {
  valid: <CheckCircle className="w-4 h-4 text-success" />,
  expiring: <AlertTriangle className="w-4 h-4 text-warning" />,
  expired: <XCircle className="w-4 h-4 text-destructive" />,
  missing: <MinusCircle className="w-4 h-4 text-destructive" />,
};

const badges: Record<string, string> = {
  valid: "bg-success/20 text-success",
  expiring: "bg-warning/20 text-warning",
  expired: "bg-destructive/20 text-destructive",
  missing: "bg-destructive/20 text-destructive",
};

const labels: Record<string, string> = {
  valid: "Valid",
  expiring: "Expiring Soon",
  expired: "Expired",
  missing: "Missing",
};

export function ComplianceRequirements({ equipment, certificates, onRequirementClick }: Props) {
  if (!equipment || equipment.length === 0) {
    // Still show default requirements
  }
  const { required, status } = getEquipmentComplianceStatus(equipment || [], certificates);

  const allValid = Object.values(status).every(s => s === "valid");

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Compliance Requirements</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${allValid ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
          {allValid ? "COMPLIANT" : "NON-COMPLIANT"}
        </span>
      </div>

      {equipment && equipment.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">Equipment:</p>
          <div className="flex flex-wrap gap-1">
            {equipment.map(eq => (
              <span key={eq} className="text-xs bg-secondary px-2 py-0.5 rounded text-foreground">{eq}</span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {required.map(certType => {
          const s = status[certType];
          return (
            <button key={certType} type="button" onClick={() => onRequirementClick?.(certType)} className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg bg-secondary/30 hover:bg-secondary/60 text-left">
              <div className="flex items-center gap-2">
                {icons[s]}
                <span className="text-sm text-foreground">{certType}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badges[s]}`}>{labels[s]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
