import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDrivers } from "@/hooks/useOrgData";
import { Bell, ChevronRight, Loader2, AlertTriangle, Zap, FileWarning, Wrench, User, Activity } from "lucide-react";

interface Item {
  type: "damage" | "breakdown" | "cert" | "driver" | "job" | "tracker" | "talk";
  label: string;
  detail: string;
  link: string;
  severity: number;
}

const typeIcon: Record<string, React.ElementType> = {
  damage: AlertTriangle, breakdown: Zap, cert: FileWarning,
  driver: User, job: Wrench, tracker: Activity, talk: User,
};
const typeColor: Record<string, string> = {
  damage: "text-orange-400", breakdown: "text-destructive", cert: "text-warning",
  driver: "text-destructive", job: "text-primary", tracker: "text-warning", talk: "text-muted-foreground",
};
const typeBg: Record<string, string> = {
  damage: "bg-orange-500/10 border-orange-500/20", breakdown: "bg-destructive/10 border-destructive/20",
  cert: "bg-warning/10 border-warning/20", driver: "bg-destructive/10 border-destructive/20",
  job: "bg-primary/10 border-primary/20", tracker: "bg-warning/10 border-warning/20",
  talk: "bg-secondary/40 border-border",
};

export function ActionRequired() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: drivers } = useDrivers();

  const { data, isLoading } = useQuery({
    queryKey: ["action_required_v2", profile?.organisation_id],
    enabled: !!profile?.organisation_id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const now30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      const [vehicles, certs, driverDocs, openDamages, activeBreakdowns, openJobs, trackers, talks] = await Promise.all([
        supabase.from("vehicles").select("id, registration_number, current_odometer_km, next_service_due_km").eq("is_active", true),
        supabase.from("certificates").select("id, certificate_type, expiry_date, vehicles(registration_number, id)").lte("expiry_date", now30),
        supabase.from("driver_documents").select("driver_id, document_type, expiry_date").lte("expiry_date", now30),
        supabase.from("damages").select("id, vehicle_id, description, severity, urgency, status, created_at, vehicles(registration_number, id)").neq("status", "Resolved"),
        supabase.from("breakdowns").select("id, vehicle_id, breakdown_type, location, vehicles(registration_number, id)").eq("resolved", false),
        supabase.from("job_cards").select("id, vehicle_id, status, work_date, job_card_number, vehicles(registration_number)").in("status", ["open", "in_progress"]),
        supabase.from("vehicle_service_trackers" as any).select("vehicle_id, tracker_name, next_due_date, vehicles:vehicle_id(registration_number)"),
        supabase.from("toolbox_talks").select("driver_id, date_conducted").order("date_conducted", { ascending: false }),
        supabase.from("hs_documents" as any).select("requirement_id, expiry_date, site_id, hs_document_requirements!inner(document_name, section_name), hs_sites!inner(name)").lte("expiry_date", now30).not("expiry_date", "is", null),
      ]);
      return {
        vehicles: vehicles.data || [],
        certs: certs.data || [],
        driverDocs: driverDocs.data || [],
        damages: openDamages.data || [],
        breakdowns: activeBreakdowns.data || [],
        jobs: openJobs.data || [],
        trackers: (trackers.data || []) as any[],
        talks: talks.data || [],
        hsExpiring: (hsExpiring.data || []) as any[],
      };
    },
  });

  const now = Date.now();
  const items: Item[] = [];

  // Breakdowns — top priority
  for (const b of data?.breakdowns || []) {
    const reg = (b as any).vehicles?.registration_number || "Unknown";
    const vid = (b as any).vehicles?.id || b.vehicle_id;
    items.push({ type: "breakdown", label: "Active Breakdown", detail: `${reg} — ${b.breakdown_type} at ${b.location}`, link: `/vehicles/${vid}`, severity: 10000 });
  }

  // Critical/urgent damages
  for (const d of data?.damages || []) {
    const reg = (d as any).vehicles?.registration_number || "Unknown";
    const vid = (d as any).vehicles?.id || d.vehicle_id;
    const isCrit = d.urgency === "critical" || (d as any).severity === "critical";
    const daysAgo = Math.floor((now - new Date(d.created_at!).getTime()) / 86400000);
    items.push({
      type: "damage",
      label: isCrit ? "CRITICAL Damage" : (d as any).severity === "major" ? "Major Damage" : "Open Damage",
      detail: `${reg} — ${(d.description || "").substring(0, 55)}${daysAgo > 0 ? ` (${daysAgo}d ago)` : ""}`,
      link: `/vehicles/${vid}`,
      severity: isCrit ? 9000 : (d as any).severity === "major" ? 2000 : 500,
    });
  }

  // Expired/expiring certificates
  for (const c of data?.certs || []) {
    if (!c.expiry_date) continue;
    const days = Math.ceil((new Date(c.expiry_date).getTime() - now) / 86400000);
    const reg = (c as any).vehicles?.registration_number || "Unknown";
    const vid = (c as any).vehicles?.id;
    items.push({
      type: "cert",
      label: days <= 0 ? "Expired Certificate" : "Certificate Expiring",
      detail: `${c.certificate_type} — ${reg} — ${days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}`,
      link: vid ? `/vehicles/${vid}` : "/certificates",
      severity: days <= 0 ? 8000 + Math.abs(days) : 200 + (30 - days),
    });
  }

  // Driver documents expiring
  const driverMap = new Map((drivers || []).map(d => [d.id, d]));
  for (const doc of data?.driverDocs || []) {
    if (!doc.expiry_date) continue;
    const days = Math.ceil((new Date(doc.expiry_date).getTime() - now) / 86400000);
    const driver = driverMap.get(doc.driver_id);
    if (!driver) continue;
    items.push({
      type: "driver",
      label: days <= 0 ? "Expired Driver Doc" : "Driver Doc Expiring",
      detail: `${driver.full_name} — ${doc.document_type} — ${days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}`,
      link: `/drivers/${doc.driver_id}`,
      severity: days <= 0 ? 7500 + Math.abs(days) : 150 + (30 - days),
    });
  }

  // Driver licence/PrDP
  for (const d of drivers || []) {
    const licDays = d.licence_expiry ? Math.ceil((new Date(d.licence_expiry).getTime() - now) / 86400000) : null;
    const prdpDays = d.prdp_expiry ? Math.ceil((new Date(d.prdp_expiry).getTime() - now) / 86400000) : null;
    if (licDays !== null && licDays <= 30)
      items.push({ type: "driver", label: licDays <= 0 ? "Expired Licence" : "Licence Expiring", detail: `${d.full_name} — ${licDays <= 0 ? `${Math.abs(licDays)}d overdue` : `${licDays}d left`}`, link: `/drivers/${d.id}`, severity: licDays <= 0 ? 7000 : 100 });
    if (prdpDays !== null && prdpDays <= 30)
      items.push({ type: "driver", label: prdpDays <= 0 ? "Expired PrDP" : "PrDP Expiring", detail: `${d.full_name} — ${prdpDays <= 0 ? `${Math.abs(prdpDays)}d overdue` : `${prdpDays}d left`}`, link: `/drivers/${d.id}`, severity: prdpDays <= 0 ? 7000 : 100 });
  }

  // Open job cards > 7 days
  for (const j of data?.jobs || []) {
    if (!j.work_date) continue;
    const days = Math.floor((now - new Date(j.work_date).getTime()) / 86400000);
    if (days > 7) {
      const reg = (j as any).vehicles?.registration_number || "Unknown";
      items.push({ type: "job", label: "Job Card Stale", detail: `${j.job_card_number || "JC"} — ${reg} — open ${days}d`, link: `/maintenance`, severity: 50 + days });
    }
  }

  // Service trackers overdue
  for (const t of data?.trackers || []) {
    if (t.next_due_date && new Date(t.next_due_date).getTime() <= now)
      items.push({ type: "tracker", label: "Service Tracker Due", detail: `${t.tracker_name} — ${t.vehicles?.registration_number || "Unknown"}`, link: `/vehicles/${t.vehicle_id}`, severity: 300 });
  }

  // Vehicle km service overdue
  for (const v of data?.vehicles || []) {
    const km = (v.next_service_due_km ?? 0) - (v.current_odometer_km ?? 0);
    if (km < 0)
      items.push({ type: "tracker", label: "Service Overdue", detail: `${v.registration_number} — ${Math.abs(km).toLocaleString()} km overdue`, link: `/vehicles/${v.id}`, severity: 400 });
  }

  // H&S document expiry alerts
  for (const doc of data?.hsExpiring || []) {
    if (!doc.expiry_date) continue;
    const days = Math.ceil((new Date(doc.expiry_date).getTime() - now) / 86400000);
    const docName = (doc as any).hs_document_requirements?.document_name || "H&S Document";
    const siteName = (doc as any).hs_sites?.name || "Site";
    items.push({
      type: "cert",
      label: days <= 0 ? "H&S Doc Expired" : "H&S Doc Expiring",
      detail: `${docName} — ${siteName} — ${days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}`,
      link: `/hs-file`,
      severity: days <= 0 ? 8500 + Math.abs(days) : 180 + (30 - days),
    });
  }

  // Toolbox talks not done this week
  const driverLast = new Map<string, string>();
  for (const t of data?.talks || []) {
    if (!driverLast.has(t.driver_id) && t.date_conducted) driverLast.set(t.driver_id, t.date_conducted);
  }
  const thisMonth = new Date().toISOString().substring(0, 7);
  for (const d of drivers || []) {
    if ((d.staff_type || "driver") !== "driver") continue;
    const last = driverLast.get(d.id);
    if (!last || !last.startsWith(thisMonth)) {
      const daysAgo = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : 999;
      items.push({ type: "talk", label: "Toolbox Talk Due", detail: `${d.full_name} — ${last ? `last done ${daysAgo}d ago` : "never done"}`, link: `/drivers/${d.id}`, severity: daysAgo });
    }
  }

  items.sort((a, b) => b.severity - a.severity);

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4 text-warning" /> Action Required ({items.length})
        </h3>
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {items.length === 0 && !isLoading
        ? <p className="text-sm text-muted-foreground">All caught up — nothing needs attention. 🎉</p>
        : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {items.map((it, i) => {
            const Icon = typeIcon[it.type] || Activity;
            return (
              <button key={i} onClick={() => navigate(it.link)}
                className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg border text-left transition-colors hover:opacity-80 ${typeBg[it.type] || typeBg.talk}`}>
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${typeColor[it.type] || "text-muted-foreground"}`} />
                <div className="min-w-0 flex-1">
                  <span className={`text-xs font-bold uppercase ${typeColor[it.type] || "text-muted-foreground"}`}>{it.label}</span>
                  <p className="text-xs text-foreground truncate mt-0.5">{it.detail}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
