import {
  Truck, ShieldCheck, FileWarning, AlertTriangle,
  Sparkles, RefreshCw, Loader2, Users, X, ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStats, useUpcomingExpiries, useRecentInspections, useRecentAlerts, useDrivers, useCertificates, useVehicles } from "@/hooks/useOrgData";
import { useFleetInsights } from "@/hooks/useFleetAI";
import ReactMarkdown from "react-markdown";

const conditionColors: Record<string, string> = {
  good: "bg-success/20 text-success",
  fair: "bg-warning/20 text-warning",
  poor: "bg-destructive/20 text-destructive",
  unroadworthy: "bg-destructive/30 text-destructive",
};

type PanelType = "critical" | "drivers" | "fleet" | "expiring" | null;

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: expiries } = useUpcomingExpiries();
  const { data: inspections } = useRecentInspections();
  const { data: alerts } = useRecentAlerts();
  const { data: drivers } = useDrivers();
  const { data: vehicles } = useVehicles();
  const { data: certificates } = useCertificates();
  const { insights, loading: aiLoading, fetchInsights } = useFleetInsights();
  const [activePanel, setActivePanel] = useState<PanelType>(null);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const now = new Date();
  const totalDrivers = (drivers || []).length;
  const driversWithExpired = (drivers || []).filter(d => {
    const licExpired = d.licence_expiry && new Date(d.licence_expiry) < now;
    const prdpExpired = d.prdp_expiry && new Date(d.prdp_expiry) < now;
    return licExpired || prdpExpired;
  }).length;
  const driverCompliance = totalDrivers > 0 ? Math.round(((totalDrivers - driversWithExpired) / totalDrivers) * 100) : 100;

  const vehicleScore = stats?.complianceScore ?? 0;
  const combinedScore = totalDrivers > 0 ? Math.round((vehicleScore + driverCompliance) / 2) : vehicleScore;

  // Build critical items list
  const criticalItems: { type: string; label: string; detail: string; link: string; severity: number }[] = [];

  (certificates || []).forEach(c => {
    if (!c.expiry_date) return;
    const days = Math.ceil((new Date(c.expiry_date).getTime() - now.getTime()) / 86400000);
    if (days <= 0) {
      criticalItems.push({
        type: "certificate", label: "Expired Certificate",
        detail: `${c.certificate_type} for ${(c as any).vehicles?.registration_number || "Unknown"} — ${Math.abs(days)}d overdue`,
        link: `/vehicles`, severity: Math.abs(days),
      });
    }
  });

  (vehicles || []).forEach(v => {
    const kmUntil = (v.next_service_due_km ?? 0) - (v.current_odometer_km ?? 0);
    if (kmUntil < 0) {
      criticalItems.push({
        type: "vehicle", label: "Service Overdue",
        detail: `${v.registration_number} — ${Math.abs(kmUntil).toLocaleString()} km overdue`,
        link: `/vehicles/${v.id}`, severity: Math.abs(kmUntil),
      });
    }
  });

  (drivers || []).forEach(d => {
    const licDays = d.licence_expiry ? Math.ceil((new Date(d.licence_expiry).getTime() - now.getTime()) / 86400000) : null;
    const prdpDays = d.prdp_expiry ? Math.ceil((new Date(d.prdp_expiry).getTime() - now.getTime()) / 86400000) : null;
    if (licDays !== null && licDays <= 0) {
      criticalItems.push({ type: "driver", label: "Expired Licence", detail: `${d.full_name} — ${Math.abs(licDays)}d overdue`, link: `/drivers/${d.id}`, severity: Math.abs(licDays) });
    }
    if (prdpDays !== null && prdpDays <= 0) {
      criticalItems.push({ type: "driver", label: "Expired PrDP", detail: `${d.full_name} — ${Math.abs(prdpDays)}d overdue`, link: `/drivers/${d.id}`, severity: Math.abs(prdpDays) });
    }
  });

  criticalItems.sort((a, b) => b.severity - a.severity);
  const trueAlertCount = criticalItems.length;

  const expiringCertsList = (certificates || []).filter(c => {
    if (!c.expiry_date) return false;
    const days = Math.ceil((new Date(c.expiry_date).getTime() - now.getTime()) / 86400000);
    return days > 0 && days <= 30;
  }).sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());

  const vehicleBreakdown = (vehicles || []).map(v => {
    const kmUntil = (v.next_service_due_km ?? 0) - (v.current_odometer_km ?? 0);
    let status = v.compliance_status || "compliant";
    if (kmUntil < 0) status = "critical";
    else if (kmUntil < 500) status = "warning";
    return { ...v, effectiveStatus: status, kmUntil };
  }).filter(v => v.effectiveStatus !== "compliant").sort((a, b) => a.kmUntil - b.kmUntil);

  const driverBreakdown = (drivers || []).map(d => {
    const licDays = d.licence_expiry ? Math.ceil((new Date(d.licence_expiry).getTime() - now.getTime()) / 86400000) : null;
    const prdpDays = d.prdp_expiry ? Math.ceil((new Date(d.prdp_expiry).getTime() - now.getTime()) / 86400000) : null;
    const issues: string[] = [];
    let status = "compliant";
    if (licDays !== null && licDays <= 0) { issues.push(`Licence expired ${Math.abs(licDays)}d ago`); status = "critical"; }
    else if (licDays !== null && licDays <= 30) { issues.push(`Licence expiring in ${licDays}d`); if (status !== "critical") status = "warning"; }
    if (prdpDays !== null && prdpDays <= 0) { issues.push(`PrDP expired ${Math.abs(prdpDays)}d ago`); status = "critical"; }
    else if (prdpDays !== null && prdpDays <= 30) { issues.push(`PrDP expiring in ${prdpDays}d`); if (status !== "critical") status = "warning"; }
    return { ...d, issues, driverStatus: status, licDays, prdpDays };
  });

  const handleCardClick = (panel: PanelType) => setActivePanel(prev => prev === panel ? null : panel);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Command Centre</h1>
        <p className="text-muted-foreground text-sm">Real-time fleet compliance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Truck} label="Active Vehicles" value={statsLoading ? "..." : stats?.totalVehicles ?? 0} color="text-primary" />
        <StatCard icon={ShieldCheck} label="Fleet Score" value={statsLoading ? "..." : `${combinedScore}%`} color="text-primary" onClick={() => handleCardClick("fleet")} active={activePanel === "fleet"} />
        <StatCard icon={Users} label="Driver Compliance" value={statsLoading ? "..." : `${driverCompliance}%`} color={driversWithExpired > 0 ? "text-destructive" : "text-primary"} highlight={driversWithExpired > 0} onClick={() => handleCardClick("drivers")} active={activePanel === "drivers"} />
        <StatCard icon={FileWarning} label="Expiring This Month" value={statsLoading ? "..." : expiringCertsList.length} color="text-warning" onClick={() => handleCardClick("expiring")} active={activePanel === "expiring"} />
        <StatCard icon={AlertTriangle} label="Critical Alerts" value={statsLoading ? "..." : trueAlertCount} color="text-destructive" highlight={trueAlertCount > 0} onClick={() => handleCardClick("critical")} active={activePanel === "critical"} />
      </div>

      {activePanel && (
        <div className="stat-card border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              {activePanel === "critical" && `Critical Issues (${criticalItems.length})`}
              {activePanel === "drivers" && `Driver Compliance Overview`}
              {activePanel === "fleet" && `Fleet Score Breakdown`}
              {activePanel === "expiring" && `Certificates Expiring This Month (${expiringCertsList.length})`}
            </h3>
            <button onClick={() => setActivePanel(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>

          {activePanel === "critical" && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {criticalItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No critical issues — your fleet is in good shape! 🎉</p>
              ) : criticalItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-destructive/5 rounded-lg border border-destructive/20">
                  <div>
                    <span className="text-xs font-semibold text-destructive uppercase">{item.label}</span>
                    <p className="text-sm text-foreground">{item.detail}</p>
                  </div>
                  <button onClick={() => navigate(item.link)} className="text-xs text-primary hover:underline flex items-center gap-1">View <ChevronRight className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}

          {activePanel === "drivers" && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {driverBreakdown.map(d => (
                <div key={d.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.full_name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {d.issues.length > 0 ? d.issues.map((iss, j) => (
                        <span key={j} className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">{iss}</span>
                      )) : (
                        <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded">All documents valid</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full uppercase ${d.driverStatus === "critical" ? "bg-destructive/20 text-destructive" : d.driverStatus === "warning" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>{d.driverStatus}</span>
                    <button onClick={() => navigate(`/drivers/${d.id}`)} className="text-xs text-primary hover:underline">View</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activePanel === "fleet" && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {vehicleBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">All vehicles are compliant! 🎉</p>
              ) : vehicleBreakdown.map(v => (
                <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">{v.registration_number}</p>
                    <p className="text-xs text-muted-foreground">{v.kmUntil < 0 ? `Service overdue by ${Math.abs(v.kmUntil).toLocaleString()} km` : `${v.kmUntil.toLocaleString()} km until service`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full uppercase ${v.effectiveStatus === "critical" ? "bg-destructive/20 text-destructive" : v.effectiveStatus === "warning" ? "bg-warning/20 text-warning" : "bg-muted/20 text-muted-foreground"}`}>{v.effectiveStatus}</span>
                    <button onClick={() => navigate(`/vehicles/${v.id}`)} className="text-xs text-primary hover:underline">View</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activePanel === "expiring" && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {expiringCertsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No certificates expiring this month.</p>
              ) : expiringCertsList.map(c => {
                const days = Math.ceil((new Date(c.expiry_date!).getTime() - now.getTime()) / 86400000);
                return (
                  <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-warning/5 border border-warning/20">
                    <div>
                      <p className="text-sm font-medium text-foreground">{(c as any).vehicles?.registration_number || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{c.certificate_type}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${days <= 7 ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>{days}d left</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${days <= 7 ? "bg-destructive/20 text-destructive" : days <= 30 ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary"}`}>{days}d</span>
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
                  <span className={`text-xs font-medium px-2 py-1 rounded capitalize ${conditionColors[item.overall_condition || "good"]}`}>{item.overall_condition}</span>
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

function StatCard({ icon: Icon, label, value, color, highlight, onClick, active }: {
  icon: React.ElementType; label: string; value: string | number; color: string; highlight?: boolean; onClick?: () => void; active?: boolean;
}) {
  return (
    <div className={`stat-card transition-all ${highlight ? "border-destructive/50" : ""} ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/50" : ""} ${active ? "ring-2 ring-primary" : ""}`} onClick={onClick}>
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
