import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye } from "lucide-react";

interface Props {
  vehicleId: string;
  reg: string;
}

export function FridgeCertsTab({ vehicleId, reg }: Props) {
  const { data: certs, isLoading } = useQuery({
    queryKey: ["vehicle_fridge_certs", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fridge_certificates" as any)
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("expiry_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const list = certs || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Calibration Certificates ({list.length})</h3>
        <span className="text-xs text-muted-foreground">Managed in Fridge Tracker → Certificates</span>
      </div>
      {list.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No calibration certificates for {reg} yet. Add one from the Fridge Tracker → Certificates tab.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            const days = Math.round((new Date(c.expiry_date).getTime() - new Date().getTime()) / 86400000);
            const status = days < 0
              ? { label: "EXPIRED", cls: "bg-destructive/20 text-destructive" }
              : days <= 30
              ? { label: "EXPIRING SOON", cls: "bg-warning/20 text-warning" }
              : { label: "VALID", cls: "bg-success/20 text-success" };
            return (
              <div key={c.id} className={`glass-card p-4 ${days < 0 ? "border-destructive/30" : days <= 30 ? "border-warning/30" : ""}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{c.certificate_number ? `Cert #${c.certificate_number}` : "Calibration Certificate"}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.issue_date ? `Done ${c.issue_date} · ` : ""}Expires {c.expiry_date}
                      {days < 0 ? ` (${Math.abs(days)} days overdue)` : ` (${days} days left)`}
                    </p>
                    {c.temperature_range && <p className="text-xs text-muted-foreground mt-0.5">Range: {c.temperature_range}</p>}
                    {c.calibrated_by && <p className="text-xs text-muted-foreground mt-0.5">By: {c.calibrated_by}</p>}
                  </div>
                  {c.certificate_url && (
                    <a href={c.certificate_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90">
                      <Eye className="w-3.5 h-3.5" /> View
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
