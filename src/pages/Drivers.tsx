import { Search, Plus, Loader2, X, IdCard, Stethoscope, BadgeCheck, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDrivers } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { checkDriverCompliance } from "@/lib/driverCompliance";
import { BranchFilter } from "@/components/filters/BranchFilter";

const complianceStyles: Record<string, string> = {
  compliant: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  critical: "bg-destructive/20 text-destructive",
};

export default function Drivers() {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { data: drivers, isLoading } = useDrivers();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: allDocuments } = useQuery({
    queryKey: ["all_driver_documents", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_documents").select("*").order("expiry_date");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: allToolboxTalks } = useQuery({
    queryKey: ["all_toolbox_talks", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("toolbox_talks").select("*").order("date_conducted", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const now = Date.now();

  const driversWithCompliance = (drivers || []).map(d => {
    const isDriver = (d.staff_type || "driver") === "driver";
    const docs = (allDocuments || []).filter(doc => doc.driver_id === d.id).map(doc => {
      const days = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date).getTime() - now) / 86400000) : 999;
      return { ...doc, calcStatus: days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid" };
    });
    const talks = (allToolboxTalks || []).filter(t => t.driver_id === d.id);
    const compliance = isDriver
      ? checkDriverCompliance(
          {
            licence_expiry: d.licence_expiry,
            prdp_expiry: d.prdp_expiry,
            licence_number: d.licence_number,
            prdp_number: d.prdp_number,
          },
          docs,
          talks
        )
      : { isCompliant: true, status: "compliant" as const, score: 100, issues: [], breakdown: [] };
    return { ...d, isDriver, compliance };
  });

  const filtered = driversWithCompliance.filter(
    (d) =>
      (d.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.id_number || "").includes(search) ||
      (d.licence_code || "").toLowerCase().includes(search.toLowerCase())) &&
      (!branchFilter || d.branch_id === branchFilter)
  );

  const [form, setForm] = useState({
    full_name: "", id_number: "", licence_number: "", licence_expiry: "",
    licence_code: "EC", prdp_number: "", prdp_expiry: "", prdp_category: "G",
    phone: "", email: "", staff_type: "driver", branch_id: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.full_name || !profile?.organisation_id) {
      toast.error("Full name is required");
      return;
    }
    const isDriver = form.staff_type === "driver";
    setSaving(true);
    const { error } = await supabase.from("drivers").insert({
      organisation_id: profile.organisation_id,
      full_name: form.full_name,
      id_number: form.id_number || null,
      staff_type: form.staff_type || "driver",
      branch_id: form.branch_id || null,
      licence_number: isDriver ? (form.licence_number || null) : null,
      licence_expiry: isDriver ? (form.licence_expiry || null) : null,
      licence_code: isDriver ? (form.licence_code || null) : null,
      prdp_number: isDriver ? (form.prdp_number || null) : null,
      prdp_expiry: isDriver ? (form.prdp_expiry || null) : null,
      prdp_category: isDriver ? (form.prdp_category || null) : null,
      phone: form.phone || null,
      email: form.email || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success(`${isDriver ? "Driver" : "Staff member"} added`);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Drivers</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} drivers registered</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or licence..." className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <BranchFilter value={branchFilter} onChange={setBranchFilter} />
      </div>

      {isLoading ? (
        <div className="glass-card flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-card text-center py-12 text-muted-foreground text-sm">No drivers found.</div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filtered.map((d) => {
              const issueFields = new Set(d.compliance.issues.filter(i => i.status !== "expiring").map(i => i.field));
              const licenceIssue = issueFields.has("Driver's Licence");
              const prdpIssue = issueFields.has("PrDP");
              const medicalIssue = issueFields.has("Medical Certificate");
              const toolboxIssue = issueFields.has("Toolbox Talk");
              return (
                <div key={d.id} onClick={() => navigate(`/drivers/${d.id}`)} className="glass-card p-4 active:bg-secondary/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-foreground truncate">{d.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{d.id_number || "-"}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase whitespace-nowrap ${complianceStyles[d.compliance.status]}`}>
                      {d.compliance.status === "compliant" ? "Compliant" : d.compliance.status === "warning" ? "Warning" : "Non-Compliant"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs my-3">
                    <div>
                      <p className="text-muted-foreground">Licence</p>
                      <p className="font-semibold text-foreground">{d.licence_code || "-"}</p>
                      <p className="text-[10px] text-muted-foreground">{d.licence_expiry || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Demerits</p>
                      <p className={`font-mono font-semibold ${(d.demerit_points ?? 0) >= 9 ? "text-destructive" : (d.demerit_points ?? 0) >= 5 ? "text-warning" : "text-foreground"}`}>
                        {d.demerit_points ?? 0}/12
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Score</p>
                      <p className={`font-bold ${d.compliance.score >= 80 ? "text-success" : d.compliance.score >= 50 ? "text-warning" : "text-destructive"}`}>
                        {d.compliance.score}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground uppercase mr-1">Issues:</span>
                    <IdCard className={`w-4 h-4 ${licenceIssue ? "text-destructive" : "text-muted-foreground/30"}`} />
                    <BadgeCheck className={`w-4 h-4 ${prdpIssue ? "text-destructive" : "text-muted-foreground/30"}`} />
                    <Stethoscope className={`w-4 h-4 ${medicalIssue ? "text-destructive" : "text-muted-foreground/30"}`} />
                    <MessageSquare className={`w-4 h-4 ${toolboxIssue ? "text-destructive" : "text-muted-foreground/30"}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID Number</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Licence Code</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Licence Expiry</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">PrDP Expiry</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Demerits</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issues</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const issueFields = new Set(d.compliance.issues.filter(i => i.status !== "expiring").map(i => i.field));
                  const licenceIssue = issueFields.has("Driver's Licence");
                  const prdpIssue = issueFields.has("PrDP");
                  const medicalIssue = issueFields.has("Medical Certificate");
                  const toolboxIssue = issueFields.has("Toolbox Talk");
                  return (
                  <tr key={d.id} onClick={() => navigate(`/drivers/${d.id}`)} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{d.full_name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{d.id_number || "-"}</td>
                    <td className="px-4 py-3 text-sm text-center font-semibold text-foreground">{d.licence_code || "-"}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{d.licence_expiry || "-"}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{d.prdp_expiry || "-"}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`font-mono ${(d.demerit_points ?? 0) >= 9 ? "text-destructive font-bold" : (d.demerit_points ?? 0) >= 5 ? "text-warning" : "text-foreground"}`}>
                        {d.demerit_points ?? 0}/12
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <IdCard className={`w-4 h-4 ${licenceIssue ? "text-destructive" : "text-muted-foreground/30"}`} aria-label={licenceIssue ? "Licence issue" : "Licence OK"} />
                        <BadgeCheck className={`w-4 h-4 ${prdpIssue ? "text-destructive" : "text-muted-foreground/30"}`} aria-label={prdpIssue ? "PrDP issue" : "PrDP OK"} />
                        <Stethoscope className={`w-4 h-4 ${medicalIssue ? "text-destructive" : "text-muted-foreground/30"}`} aria-label={medicalIssue ? "Medical issue" : "Medical OK"} />
                        <MessageSquare className={`w-4 h-4 ${toolboxIssue ? "text-destructive" : "text-muted-foreground/30"}`} aria-label={toolboxIssue ? "Toolbox overdue" : "Toolbox OK"} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${d.compliance.score >= 80 ? "text-success" : d.compliance.score >= 50 ? "text-warning" : "text-destructive"}`}>
                        {d.compliance.score}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${complianceStyles[d.compliance.status]}`}>
                        {d.compliance.status === "compliant" ? "Compliant" : d.compliance.status === "warning" ? "Warning" : "Non-Compliant"}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="hidden md:block flex-1 bg-background/50" onClick={() => setShowForm(false)} />
          <div className="w-full md:w-[450px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Add Driver</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {[
              { key: "full_name", label: "Full Name *", placeholder: "John Smith" },
              { key: "id_number", label: "ID Number", placeholder: "8501015800086" },
              { key: "licence_number", label: "Licence Number", placeholder: "" },
              { key: "licence_expiry", label: "Licence Expiry", placeholder: "", type: "date" },
              { key: "prdp_number", label: "PrDP Number", placeholder: "" },
              { key: "prdp_expiry", label: "PrDP Expiry", placeholder: "", type: "date" },
              { key: "phone", label: "Phone", placeholder: "+27..." },
              { key: "email", label: "Email", placeholder: "driver@company.co.za" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                <input type={f.type || "text"} value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
            <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Driver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
