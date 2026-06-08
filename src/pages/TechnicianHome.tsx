import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Plus, LogOut, Thermometer, Clock, Eye } from "lucide-react";

export default function TechnicianHome() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const { data: recentJobs } = useQuery({
    queryKey: ["tech_recent_jobs", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fridge_service_log" as any)
        .select("*, vehicles(registration_number)")
        .eq("organisation_id", profile?.organisation_id)
        .eq("logged_via", "tech_app")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!profile?.organisation_id,
  });

  const typeLabel: Record<string, string> = { scheduled: "Service", breakdown: "Breakdown", inspection: "Inspection", repair: "Repair", certificate: "Certificate" };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Thermometer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">MARZ Fleet</h1>
            <p className="text-xs text-muted-foreground">Technician</p>
          </div>
        </div>
        <button onClick={() => signOut()} className="text-muted-foreground p-2"><LogOut className="w-5 h-5" /></button>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-5">
        {/* Big new job card button */}
        <button onClick={() => navigate("/job-card/new")}
          className="w-full bg-primary text-primary-foreground rounded-2xl p-6 flex items-center gap-4 shadow-lg active:scale-[0.98] transition-transform">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Plus className="w-8 h-8" />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold">New Job Card</p>
            <p className="text-sm opacity-90">Start a job card on this unit</p>
          </div>
        </button>

        {/* Recent submissions */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-muted-foreground" /> Recent Job Cards
          </h2>
          {(!recentJobs || recentJobs.length === 0) ? (
            <div className="bg-secondary/40 rounded-xl p-6 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No job cards yet. Tap "New Job Card" to create your first one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentJobs.map((j) => (
                <div key={j.id} className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {j.vehicles?.registration_number || "Unit"}
                        {j.job_card_number ? ` · #${j.job_card_number}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {typeLabel[j.service_type] || j.service_type} · {j.service_date}{j.tech_name ? ` · ${j.tech_name}` : ""}
                      </p>
                    </div>
                    {j.pdf_url && (
                      <a href={j.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs bg-secondary text-foreground px-2.5 py-1.5 rounded-lg">
                        <Eye className="w-3.5 h-3.5" /> PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
