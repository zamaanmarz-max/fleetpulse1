import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, ChevronRight } from "lucide-react";

interface Item {
  type: string;
  label: string;
  detail: string;
  link: string;
  severity: number;
}

export function ActionRequired() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data } = useQuery({
    queryKey: ["action_required", profile?.organisation_id],
    enabled: !!profile?.organisation_id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [v, c, t, j, i, st] = await Promise.all([
        supabase.from("vehicles").select("id, registration_number, updated_at").eq("is_active", true),
        supabase.from("certificates").select("id, certificate_type, expiry_date, vehicles(registration_number, id)"),
        supabase.from("toolbox_talks").select("driver_id, date_conducted").order("date_conducted", { ascending: false }),
        supabase.from("job_cards").select("id, vehicle_id, status, work_date, vehicles(registration_number)").in("status", ["open", "in_progress"]),
        supabase.from("damage_inspections").select("vehicle_id, inspection_date, vehicles(registration_number)").order("inspection_date", { ascending: false }),
        supabase.from("vehicle_service_trackers" as any).select("vehicle_id, tracker_name, tracking_type, next_due_value, next_due_date, vehicles:vehicle_id(registration_number)"),
      ]);
      return {
        vehicles: v.data || [],
        certs: c.data || [],
        talks: t.data || [],
        jobs: j.data || [],
        inspections: i.data || [],
        trackers: (st.data || []) as any[],
      };
    },
  });

  const now = Date.now();
  const items: Item[] = [];

  // KM not updated 7+ days (or never updated)
  for (const v of data?.vehicles || []) {
    if (!v.updated_at) {
      items.push({ type: "km", label: "KM Never Updated", detail: `${v.registration_number} — never updated`, link: `/vehicles/${v.id}`, severity: 9999 });
      continue;
    }
    const days = Math.floor((now - new Date(v.updated_at).getTime()) / 86400000);
    if (days >= 7) {
      items.push({ type: "km", label: "KM Not Updated", detail: `${v.registration_number} — last updated ${days}d ago`, link: `/vehicles/${v.id}`, severity: days });
    }
  }

  // Certs expiring 30 days
  for (const c of data?.certs || []) {
    if (!c.expiry_date) continue;
    const days = Math.ceil((new Date(c.expiry_date).getTime() - now) / 86400000);
    if (days > 0 && days <= 30) {
      const reg = (c as any).vehicles?.registration_number || "Unknown";
      const vid = (c as any).vehicles?.id;
      items.push({ type: "cert", label: "Cert Expiring", detail: `${c.certificate_type} for ${reg} — ${days}d left`, link: vid ? `/vehicles/${vid}` : "/certificates", severity: 31 - days });
    }
  }

  // Open job cards >14 days
  for (const j of data?.jobs || []) {
    if (!j.work_date) continue;
    const days = Math.floor((now - new Date(j.work_date).getTime()) / 86400000);
    if (days > 14) {
      const reg = (j as any).vehicles?.registration_number || "Unknown";
      items.push({ type: "job", label: "Open Job Card", detail: `${reg} — open ${days}d`, link: `/vehicles/${j.vehicle_id}`, severity: days });
    }
  }

  // Inspections >90 days (per vehicle)
  const lastInspByV = new Map<string, string>();
  for (const i of data?.inspections || []) {
    if (i.vehicle_id && i.inspection_date && !lastInspByV.has(i.vehicle_id)) lastInspByV.set(i.vehicle_id, i.inspection_date);
  }
  for (const v of data?.vehicles || []) {
    const last = lastInspByV.get(v.id);
    if (!last) continue;
    const days = Math.floor((now - new Date(last).getTime()) / 86400000);
    if (days > 90) {
      items.push({ type: "insp", label: "Inspection Overdue", detail: `${v.registration_number} — last inspection ${days}d ago`, link: `/vehicles/${v.id}`, severity: days });
    }
  }

  // Trackers due/overdue
  for (const t of data?.trackers || []) {
    let isDue = false;
    if (t.tracking_type === "days" && t.next_due_date) {
      isDue = new Date(t.next_due_date).getTime() <= now;
    }
    if (isDue) {
      const reg = t.vehicles?.registration_number || "Unknown";
      items.push({ type: "tracker", label: "Tracker Overdue", detail: `${t.tracker_name} for ${reg}`, link: `/vehicles/${t.vehicle_id}`, severity: 1000 });
    }
  }

  // Toolbox talks overdue (driver-level): no toolbox in 30 days
  const driverLast = new Map<string, string>();
  for (const t of data?.talks || []) {
    if (!driverLast.has(t.driver_id) && t.date_conducted) driverLast.set(t.driver_id, t.date_conducted);
  }
  driverLast.forEach((d, driverId) => {
    const days = Math.floor((now - new Date(d).getTime()) / 86400000);
    if (days > 30) {
      items.push({ type: "talk", label: "Toolbox Overdue", detail: `Driver — last talk ${days}d ago`, link: `/drivers/${driverId}`, severity: days });
    }
  });

  items.sort((a, b) => b.severity - a.severity);
  const top = items.slice(0, 12);

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4 text-warning" /> Action Required ({items.length})
        </h3>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">All caught up — nothing needs attention right now.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {top.map((it, i) => (
            <button key={i} onClick={() => navigate(it.link)} className="w-full flex items-center justify-between py-2 px-3 bg-secondary/30 hover:bg-secondary/60 rounded-lg text-left transition-colors">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-warning uppercase">{it.label}</span>
                <p className="text-sm text-foreground truncate">{it.detail}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
