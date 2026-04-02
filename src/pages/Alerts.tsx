import { Bell, Check, AlertTriangle, FileWarning, Truck, Users } from "lucide-react";

const mockAlerts = [
  { id: "1", type: "certificate_expiry", message: "COF Certificate for GP 234-567 has expired", time: "2 hours ago", resolved: false },
  { id: "2", type: "service_due", message: "Service overdue by 200km for CA 345-678", time: "5 hours ago", resolved: false },
  { id: "3", type: "inspection_critical", message: "Critical damage found during inspection of GP 567-890", time: "1 day ago", resolved: false },
  { id: "4", type: "driver_expiry", message: "PrDP expiring in 7 days for Johan van der Merwe", time: "1 day ago", resolved: false },
  { id: "5", type: "fine_added", message: "New fine R2,500 added for GP 234-567", time: "2 days ago", resolved: true },
  { id: "6", type: "certificate_expiry", message: "Licence Disc expiring in 30 days for KZN 567-890", time: "3 days ago", resolved: true },
];

const typeIcons: Record<string, React.ElementType> = {
  certificate_expiry: FileWarning,
  service_due: Truck,
  inspection_critical: AlertTriangle,
  driver_expiry: Users,
  fine_added: AlertTriangle,
};

export default function Alerts() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground">{mockAlerts.filter((a) => !a.resolved).length} unresolved alerts</p>
        </div>
        <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm hover:bg-secondary/80">
          <Check className="w-4 h-4" /> Bulk Resolve
        </button>
      </div>

      <div className="space-y-2">
        {mockAlerts.map((alert) => {
          const Icon = typeIcons[alert.type] || Bell;
          return (
            <div key={alert.id} className={`stat-card flex items-start gap-3 ${alert.resolved ? "opacity-50" : ""}`}>
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${alert.resolved ? "text-muted-foreground" : "text-warning"}`} />
              <div className="flex-1">
                <p className={`text-sm ${alert.resolved ? "text-muted-foreground line-through" : "text-foreground"}`}>{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
              </div>
              {!alert.resolved && (
                <button className="text-xs bg-secondary text-muted-foreground px-3 py-1.5 rounded hover:text-foreground">
                  Resolve
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
