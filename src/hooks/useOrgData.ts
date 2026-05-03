import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useVehicles() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["vehicles", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function useDrivers() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["drivers", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });
}

export function useCertificates() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["certificates", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*, vehicles(registration_number)")
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });
}

export function useInspections() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["inspections", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_inspections")
        .select("*, vehicles(registration_number), inspector:users!damage_inspections_inspector_id_fkey(full_name)")
        .order("inspection_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });
}

export function useFines() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["fines", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select("*, vehicles(registration_number), drivers(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });
}

export function useAlerts() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["alerts", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts_log")
        .select("*")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });
}

export function useComplianceTemplates() {
  return useQuery({
    queryKey: ["compliance_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_templates")
        .select("*")
        .order("template_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useOrganisations() {
  return useQuery({
    queryKey: ["organisations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organisations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDashboardStats() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["dashboard_stats", profile?.organisation_id],
    queryFn: async () => {
      const [vehiclesRes, certsRes, alertsRes] = await Promise.all([
        supabase.from("vehicles").select("id, compliance_status, is_active, current_odometer_km, next_service_due_km, updated_at").eq("is_active", true),
        supabase.from("certificates").select("id, expiry_date, status"),
        supabase.from("alerts_log").select("id, resolved").eq("resolved", false),
      ]);

      const vehicles = vehiclesRes.data || [];
      const certs = certsRes.data || [];
      const alerts = alertsRes.data || [];

      const totalVehicles = vehicles.length;
      // Use stored compliance_status — calculated by recalculateAllVehicleCompliance
      // This ensures dashboard matches Vehicles page exactly
      const compliant = vehicles.filter((v) => (v.compliance_status || "compliant") === "compliant").length;
      const warning = vehicles.filter((v) => (v.compliance_status || "compliant") === "warning").length;
      const critical = vehicles.filter((v) => (v.compliance_status || "compliant") === "critical").length;
      const expired = vehicles.filter((v) => (v.compliance_status || "compliant") === "expired").length;
      const complianceScore = totalVehicles > 0 ? Math.round((compliant / totalVehicles) * 100) : 0;

      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiringCerts = certs.filter((c) => {
        if (!c.expiry_date) return false;
        const exp = new Date(c.expiry_date);
        return exp > now && exp <= thirtyDays;
      }).length;

      return {
        totalVehicles,
        complianceScore,
        expiringCerts,
        criticalAlerts: alerts.length,
        compliant,
        warning,
        critical,
        expired,
      };
    },
    enabled: !!profile?.organisation_id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function useUpcomingExpiries() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["upcoming_expiries", profile?.organisation_id],
    queryFn: async () => {
      const now = new Date().toISOString().split("T")[0];
      const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("certificates")
        .select("id, certificate_type, expiry_date, vehicles(registration_number)")
        .gte("expiry_date", now)
        .lte("expiry_date", future)
        .order("expiry_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });
}

export function useRecentInspections() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["recent_inspections", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_inspections")
        .select("id, inspection_date, overall_condition, total_damage_items, vehicles(registration_number)")
        .order("inspection_date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });
}

export function useRecentAlerts() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["recent_alerts", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });
}
