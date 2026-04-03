import { Bell, Check, AlertTriangle, FileWarning, Truck, Users, Loader2 } from "lucide-react";
import { useAlerts } from "@/hooks/useOrgData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const typeIcons: Record<string, React.ElementType> = {
  certificate_expiry: FileWarning,
  service_due: Truck,
  inspection_critical: AlertTriangle,
  driver_expiry: Users,
  fine_added: AlertTriangle,
};

export default function Alerts() {
  const { data: alerts, isLoading } = useAlerts();
  const queryClient = useQueryClient();

  const handleResolve = async (id: string) => {
    const { error } = await supabase.from("alerts_log").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Alert resolved"); queryClient.invalidateQueries({ queryKey: ["alerts"] }); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground">{(alerts || []).filter((a) => !a.resolved).length} unresolved alerts</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (alerts || []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No alerts.</div>
      ) : (
        <div className="space-y-2">
          {(alerts || []).map((alert) => {
            const Icon = typeIcons[alert.alert_type || ""] || Bell;
            return (
              <div key={alert.id} className={`stat-card flex items-start gap-3 ${alert.resolved ? "opacity-50" : ""}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${alert.resolved ? "text-muted-foreground" : "text-warning"}`} />
                <div className="flex-1">
                  <p className={`text-sm ${alert.resolved ? "text-muted-foreground line-through" : "text-foreground"}`}>{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.sent_at ? new Date(alert.sent_at).toLocaleString() : ""}</p>
                </div>
                {!alert.resolved && (
                  <button onClick={() => handleResolve(alert.id)} className="text-xs bg-secondary text-muted-foreground px-3 py-1.5 rounded hover:text-foreground">
                    Resolve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
