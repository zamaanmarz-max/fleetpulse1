import {
  Truck, ShieldCheck, FileWarning, AlertTriangle,
  Sparkles, RefreshCw, Loader2, Users, X, ChevronRight,
  Wrench, CheckCircle, Upload, Gauge, ArrowRightLeft, Warehouse,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDashboardStats, useUpcomingExpiries, useRecentAlerts, useDrivers, useCertificates, useVehicles } from "@/hooks/useOrgData";
import { useFleetInsights } from "@/hooks/useFleetAI";
import { recalculateAllVehicleCompliance } from "@/lib/compliance";
import { checkDriverCompliance } from "@/lib/driverCompliance";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { ActionRequired } from "@/components/dashboard/ActionRequired";
import { HSScoreCard } from "@/components/dashboard/HSScoreCard";

function RecentDamages() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["recent_damages_dash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damages")
        .select("id, description, severity, urgency, status, created_at, vehicles(registration_number, id), drivers(full_name)")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    staleTime: 0, refetchOnMount: "always",
  });

  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No damages logged yet</p>;

  return (
    <div className="space-y-2">
      {data.map(d => {
        const vid = (d as any).vehicles?.id;
        const reg = (d as any).vehicles?.registration_number || "Unknown";
        const driver = (d as any).drivers?.full_name;
        const sev = (d as any).severity || "minor";
        return (
          <button key={d.id} onClick={() => vid && navigate(`/vehicles/${vid}`)}
            className="w-full flex items-center justify-between py-2 border-b border-border last:border-0 hover:opacity-80 text-left">
            <div>
              <p className="text-sm font-medium text-foreground">{reg}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[160px]">{(d.description || "").substring(0, 45)}</p>
              {driver && <p className="text-xs text-primary">Driver: {driver}</p>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                sev === "critical" ? "bg-destructive/20 text-destructive" :
                sev === "major"    ? "bg-orange-500/20 text-orange-400" :
                "bg-yellow-500/20 text-yellow-400"}`}>{sev}</span>
              <span className="text-xs text-muted-foreground">{new Date(d.created_at!).toLocaleDateString("en-ZA")}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const conditionColors: Record<string, string> = {
  good: "bg-success/20 text-success",
  fair: "bg-warning/20 text-warning",
  poor: "bg-destructive/20 text-destructive",
  unroadworthy: "bg-destructive/30 text-destructive",
};

type PanelType = "critical" | "drivers" | "fleet" | "expiring" | null;

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: expiries } = useUpcomingExpiries();
  const { data: alerts } = useRecentAlerts();
  const { data: drivers } = useDrivers();
  const { data: vehicles } = useVehicles();
  const { data: certificates } = useCertificates();
  const { insights, loading: aiLoading, fetchInsights } = useFleetInsights();
  const queryClient = useQueryClient();
  const [activePanel, setActivePanel] = useState<PanelType>(null);

  const { data: vehicleStatuses } = useQuery({
    queryKey: ["vehicle_statuses", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_status").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: allDriverDocs } = useQuery({
    queryKey: ["all_driver_documents", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_documents").select("driver_id, document_type, expiry_date, status, document_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: allToolboxTalks } = useQuery({
    queryKey: ["all_toolbox_talks", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("toolbox_talks").select("driver_id, date_conducted");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: organisation } = useQuery({
    queryKey: ["organisation_compliance_settings", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("organisations").select("compliance_settings").eq("id", profile!.organisation_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });


  useEffect(() => {
    recalculateAllVehicleCompliance().then(() => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
      queryClient.invalidateQueries({ queryKey: ["action_required"] });
    });
  }, []);

  // Real-time subscriptions: refresh dashboard whenever vehicles, certificates,
  // drivers, or driver_documents change anywhere in the app.
  useEffect(() => {
    if (!profile?.organisation_id) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
      queryClient.invalidateQueries({ queryKey: ["action_required"] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming_expiries"] });
      queryClient.invalidateQueries({ queryKey: ["hs_score"] });
    };
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_documents" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organisation_id, queryClient]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const now = new Date();
  const nowMs = now.getTime();
  const complianceSettings = (organisation as any)?.compliance_settings || {};

  // Only actual drivers count toward driver compliance %
  const actualDrivers = (drivers || []).filter(d => (d.staff_type || "driver") === "driver");
  const totalDrivers = actualDrivers.length;

  const driverComplianceResults = actualDrivers.map(d => {
    const docs = (allDriverDocs || []).filter(doc => doc.driver_id === d.id).map(doc => {
      const days = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date).getTime() - nowMs) / 86400000) : 999;
      return {
        document_type: doc.document_type,
        expiry_date: doc.expiry_date,
        calcStatus: doc.expiry_date ? (days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid") : "missing",
      };
    });
    const talks = (allToolboxTalks || []).filter(t => t.driver_id === d.id).map(t => ({ date_conducted: t.date_conducted as string }));
    return checkDriverCompliance(
      { licence_expiry: d.licence_expiry, prdp_expiry: d.prdp_expiry, licence_number: d.licence_number, prdp_number: d.prdp_number },
      docs,
      talks,
      complianceSettings
    );
  });

  const compliantDrivers = driverComplianceResults.filter(r => r.isCompliant).length;
  const nonCompliantDrivers = totalDrivers - compliantDrivers;
  const driverCompliance = totalDrivers > 0 ? Math.round((compliantDrivers / totalDrivers) * 100) : 0;

  // Keep `driversWithExpired` semantics for the existing alert banner — now means non-compliant drivers
  const driversWithExpired = nonCompliantDrivers;

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
    return { ...v, effectiveStatus: status, kmUntil };
  }).filter(v => v.effectiveStatus !== "compliant").sort((a, b) => a.kmUntil - b.kmUntil);

  const driverBreakdown = (drivers || []).map(d => {
    const isDriver = (d.staff_type || "driver") === "driver";
    const docs = (allDriverDocs || []).filter((doc: any) => doc.driver_id === d.id).map((doc: any) => {
      const days = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date).getTime() - now.getTime()) / 86400000) : 999;
      return { ...doc, calcStatus: days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid" };
    });
    const talks = (allToolboxTalks || []).filter((t: any) => t.driver_id === d.id).map((t: any) => ({ date_conducted: t.date_conducted as string }));
    const compliance = isDriver
      ? checkDriverCompliance({ licence_expiry: d.licence_expiry, prdp_expiry: d.prdp_expiry, licence_number: d.licence_number, prdp_number: d.prdp_number }, docs, talks, complianceSettings)
      : { isCompliant: true, status: "compliant" as const, score: 100, issues: [], breakdown: [] };
    const issues = compliance.issues.map(i => `${i.field} — ${i.status}`);
    return { ...d, issues, driverStatus: compliance.status, compliance };
  });

  const handleCardClick = (panel: PanelType) => setActivePanel(prev => prev === panel ? null : panel);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Command Centre</h1>
        <p className="text-muted-foreground text-xs md:text-sm">Real-time fleet compliance overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard icon={Truck} label="Active Vehicles" value={statsLoading ? "..." : stats?.totalVehicles ?? 0} color="text-primary" onClick={() => navigate("/vehicles")} />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><ActionRequired /></div>
        <HSScoreCard />
      </div>

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
          <details className="md:hidden" open>
            <summary className="flex items-center justify-between mb-4 cursor-pointer list-none">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">MARZ Fleet AI</h3>
              </div>
              <button onClick={(e) => { e.preventDefault(); fetchInsights(); }} disabled={aiLoading} className="text-muted-foreground hover:text-foreground">
                <RefreshCw className={`w-4 h-4 ${aiLoading ? "animate-spin" : ""}`} />
              </button>
            </summary>
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
          </details>
          <div className="hidden md:block">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">MARZ Fleet AI</h3>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Upcoming Expiries</h3>
          <div className="space-y-2">
            {(expiries || []).map((item) => {
              const days = item.expiry_date ? Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / 86400000) : 0;
              const vid = (item as any).vehicles?.id;
              return (
                <button key={item.id} onClick={() => vid && navigate(`/vehicles/${vid}`)}
                  className="w-full flex items-center justify-between py-2 border-b border-border last:border-0 hover:opacity-80 text-left">
                  <div>
                    <p className="text-sm font-medium text-foreground">{(item as any).vehicles?.registration_number || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">{item.certificate_type}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${days <= 7 ? "bg-destructive/20 text-destructive" : days <= 30 ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary"}`}>{days}d</span>
                </button>
              );
            })}
            {(!expiries || expiries.length === 0) && <p className="text-sm text-muted-foreground">No upcoming expiries in 60 days</p>}
          </div>
        </div>

        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Damages</h3>
          <RecentDamages /></div>

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

      {/* Fleet Availability Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Warehouse className="w-4 h-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Fleet Availability</h3></div>
            <button onClick={() => navigate("/fleet-availability")} className="text-xs text-primary hover:underline">View Full Report</button>
          </div>
          {(() => {
            const statusMap = new Map<string, string>();
            (vehicleStatuses || []).forEach(s => { if (!statusMap.has(s.vehicle_id)) statusMap.set(s.vehicle_id, s.status); });
            const total = (vehicles || []).length;
            const repairList = (vehicles || []).filter(v => statusMap.get(v.id) === "out_for_repair");
            const available = total - repairList.length;
            const repairStatuses = (vehicleStatuses || []).filter(s => s.status === "out_for_repair");
            return (
              <div className="space-y-3">
                <div className="flex gap-2 h-4 rounded-full overflow-hidden bg-secondary">
                  {available > 0 && <div className="bg-success transition-all" style={{ width: `${(available / Math.max(total, 1)) * 100}%` }} />}
                  {repairList.length > 0 && <div className="bg-destructive transition-all" style={{ width: `${(repairList.length / Math.max(total, 1)) * 100}%` }} />}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success" /> Available: {available}</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Repair: {repairList.length}</span>
                </div>
                {repairList.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {repairList.map(v => {
                      const st = repairStatuses.find(s => s.vehicle_id === v.id);
                      const daysOut = st?.date_sent_for_repair ? Math.ceil((Date.now() - new Date(st.date_sent_for_repair).getTime()) / 86400000) : "-";
                      return (
                        <div key={v.id} className="flex items-center justify-between py-1.5 px-2 bg-destructive/5 rounded-lg text-sm">
                          <div><span className="font-mono font-medium text-foreground">{v.registration_number}</span><span className="text-xs text-muted-foreground ml-2">{st?.workshop_name || ""}</span></div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{daysOut}d out</span><span>{st?.estimated_return_date || "No ETA"}</span></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Quick Actions */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Mark Available", icon: CheckCircle, color: "text-success", action: () => navigate("/fleet-availability") },
              { label: "Send for Repair", icon: Wrench, color: "text-destructive", action: () => navigate("/fleet-availability") },
              { label: "Transfer Vehicle", icon: ArrowRightLeft, color: "text-primary", action: () => navigate("/vehicles") },
              { label: "Update Odometer", icon: Gauge, color: "text-warning", action: () => navigate("/vehicles") },
              { label: "Upload Certificate", icon: Upload, color: "text-primary", action: () => navigate("/certificates") },
              { label: "Import Data", icon: Upload, color: "text-muted-foreground", action: () => navigate("/import") },
            ].map(q => (
              <button key={q.label} onClick={q.action} className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors text-left">
                <q.icon className={`w-4 h-4 ${q.color}`} /> {q.label}
              </button>
            ))}
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
    <div className={`stat-card p-4 md:p-5 transition-all ${highlight ? "border-destructive/50" : ""} ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/50" : ""} ${active ? "ring-2 ring-primary" : ""}`} onClick={onClick}>
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{label}</span>
        <Icon className={`w-4 h-4 md:w-5 md:h-5 flex-shrink-0 ${color}`} />
      </div>
      <p className={`text-2xl md:text-3xl font-bold ${color}`}>{value}</p>
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
