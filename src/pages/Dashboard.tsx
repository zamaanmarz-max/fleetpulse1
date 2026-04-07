import {
  Truck, ShieldCheck, FileWarning, AlertTriangle,
  Sparkles, RefreshCw, Loader2, Users,
} from "lucide-react";
import { useEffect } from "react";
import { useDashboardStats, useUpcomingExpiries, useRecentInspections, useRecentAlerts, useDrivers } from "@/hooks/useOrgData";
import { useFleetInsights } from "@/hooks/useFleetAI";
import ReactMarkdown from "react-markdown";

const conditionColors: Record<string, string> = {
  good: "bg-success/20 text-success",
  fair: "bg-warning/20 text-warning",
  poor: "bg-destructive/20 text-destructive",
  unroadworthy: "bg-destructive/30 text-destructive",
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: expiries } = useUpcomingExpiries();
  const { data: inspections } = useRecentInspections();
  const { data: alerts } = useRecentAlerts();
  const { data: drivers } = useDrivers();
  const { insights, loading: aiLoading, fetchInsights } = useFleetInsights();

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Driver compliance calculation
  const now = new Date();
  const totalDrivers = (drivers || []).length;
  const driversWithExpired = (drivers || []).filter(d => {
    const licExpired = d.licence_expiry && new Date(d.licence_expiry) < now;
    const prdpExpired = d.prdp_expiry && new Date(d.prdp_expiry) < now;
    return licExpired || prdpExpired;
  }).length;
  const driverCompliance = totalDrivers > 0 ? Math.round(((totalDrivers - driversWithExpired) / totalDrivers) * 100) : 100;

  // Combined compliance
  const vehicleScore = stats?.complianceScore ?? 0;
  const combinedScore = totalDrivers > 0 ? Math.round((vehicleScore + driverCompliance) / 2) : vehicleScore;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Command Centre</h1>
        <p className="text-muted-foreground text-sm">Real-time fleet compliance overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Truck} label="Active Vehicles" value={statsLoading ? "..." : stats?.totalVehicles ?? 0} color="text-primary" />
        <StatCard icon={ShieldCheck} label="Fleet Score" value={statsLoading ? "..." : `${combinedScore}%`} color="text-primary" />
        <StatCard icon={Users} label="Driver Compliance" value={statsLoading ? "..." : `${driverCompliance}%`} color={driversWithExpired > 0 ? "text-destructive" : "text-primary"} highlight={driversWithExpired > 0} />
        <StatCard icon={FileWarning} label="Expiring This Month" value={statsLoading ? "..." : stats?.expiringCerts ?? 0} color="text-warning" />
        <StatCard icon={AlertTriangle} label="Critical Alerts" value={statsLoading ? "..." : stats?.criticalAlerts ?? 0} color="text-destructive" highlight={(stats?.criticalAlerts ?? 0) > 0} />
      </div>

      {/* Middle section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Fleet Status Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            <TrafficItem label="Compliant" count={stats?.compliant ?? 0} color="bg-success" />
            <TrafficItem label="Warning" count={stats?.warning ?? 0} color="bg-warning" />
            <TrafficItem label="Critical" count={stats?.critical ?? 0} color="bg-destructive" />
            <TrafficItem label="Expired" count={stats?.expired ?? 0} color="bg-muted-foreground" />
          </div>
          {driversWithExpired > 0 && (
            <div className="mt-3 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive font-semibold">
              ⚠️ {driversWithExpired} driver(s) have expired licence or PrDP
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">AI Fleet Intelligence</h3>
            </div>
            <button onClick={fetchInsights} disabled={aiLoading} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className={`w-4 h-4 ${aiLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {aiLoading && !insights ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analysing fleet data...
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground leading-relaxed">
              <ReactMarkdown>{insights || "No insights available. Click refresh to generate."}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Upcoming Expiries</h3>
          <div className="space-y-2">
            {(expiries || []).map((item) => {
              const days = item.expiry_date ? Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / 86400000) : 0;
              return (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{(item as any).vehicles?.registration_number || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">{item.certificate_type}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${days <= 7 ? "bg-destructive/20 text-destructive" : days <= 30 ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary"}`}>
                    {days}d
                  </span>
                </div>
              );
            })}
            {(!expiries || expiries.length === 0) && <p className="text-sm text-muted-foreground">No upcoming expiries</p>}
          </div>
        </div>

        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Inspections</h3>
          <div className="space-y-2">
            {(inspections || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{(item as any).vehicles?.registration_number || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">{item.inspection_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded capitalize ${conditionColors[item.overall_condition || "good"]}`}>
                    {item.overall_condition}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.total_damage_items} items</span>
                </div>
              </div>
            ))}
            {(!inspections || inspections.length === 0) && <p className="text-sm text-muted-foreground">No recent inspections</p>}
          </div>
        </div>

        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Alerts</h3>
          <div className="space-y-2">
            {(alerts || []).map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">{item.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.sent_at ? new Date(item.sent_at).toLocaleDateString() : ""}</p>
                </div>
              </div>
            ))}
            {(!alerts || alerts.length === 0) && <p className="text-sm text-muted-foreground">No recent alerts</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, highlight }: {
  icon: React.ElementType; label: string; value: string | number; color: string; highlight?: boolean;
}) {
  return (
    <div className={`stat-card ${highlight ? "border-destructive/50" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TrafficItem({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
      <div className={`w-4 h-4 rounded-full ${color}`} />
      <div>
        <p className="text-lg font-bold text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
