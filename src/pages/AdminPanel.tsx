import { Search, Plus, Eye, Ban, Trash2, Loader2, X, CheckCircle, UserPlus } from "lucide-react";
import { useState } from "react";
import { useOrganisations } from "@/hooks/useOrgData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function AdminPanel() {
  const { data: orgs, isLoading } = useOrganisations();
  const queryClient = useQueryClient();
  const [showAddClient, setShowAddClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    company_name: "", brn: "", contact_name: "", contact_email: "",
    contact_phone: "",
  });

  const statusStyles: Record<string, string> = {
    active: "bg-success/20 text-success",
    suspended: "bg-destructive/20 text-destructive",
  };

  const filtered = (orgs || []).filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.registration_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAddClient = async () => {
    if (!form.company_name || !form.contact_email) {
      toast.error("Company name and email are required");
      return;
    }
    setSaving(true);
    try {
      // Create organisation
      const { data: org, error: orgErr } = await supabase.from("organisations").insert({
        name: form.company_name,
        registration_number: form.brn || null,
        primary_contact_name: form.contact_name || null,
        primary_contact_email: form.contact_email,
        primary_contact_phone: form.contact_phone || null,
        subscription_status: "active",
      }).select().single();
      if (orgErr) throw orgErr;

      // Create admin user via auth signup
      const tempPassword = `Marz${Date.now().toString(36)}!`;
      const { error: authErr } = await supabase.auth.signUp({
        email: form.contact_email,
        password: tempPassword,
        options: {
          data: {
            full_name: form.contact_name || form.contact_email,
            organisation_id: org.id,
            role: "clientadmin",
          },
        },
      });
      if (authErr) throw authErr;

      toast.success(`Client "${form.company_name}" created. Temp password: ${tempPassword}`);
      setShowAddClient(false);
      setForm({ company_name: "", brn: "", contact_name: "", contact_email: "", contact_phone: "" });
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (orgId: string, currentStatus: string) => {
    const newStatus = currentStatus === "suspended" ? "active" : "suspended";
    const { error } = await supabase.from("organisations").update({ subscription_status: newStatus }).eq("id", orgId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Organisation ${newStatus === "suspended" ? "suspended" : "activated"}`);
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
    }
  };

  const handleDelete = async (orgId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("organisations").delete().eq("id", orgId);
    if (error) toast.error(error.message);
    else {
      toast.success("Organisation deleted");
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage all organisations</p>
        </div>
        <button onClick={() => setShowAddClient(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> Add New Client
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Clients</p><p className="text-2xl font-bold text-foreground mt-1">{(orgs || []).length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Active</p><p className="text-2xl font-bold text-success mt-1">{(orgs || []).filter(o => o.subscription_status === "active").length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Suspended</p><p className="text-2xl font-bold text-destructive mt-1">{(orgs || []).filter(o => o.subscription_status === "suspended").length}</p></div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No organisations found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">BRN</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => (
                <tr key={org.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{org.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{org.registration_number || "-"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{org.primary_contact_email || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[org.subscription_status || "active"] || statusStyles.active}`}>{org.subscription_status === "suspended" ? "Suspended" : "Active"}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleSuspend(org.id, org.subscription_status || "active")} className="p-1.5 text-muted-foreground hover:text-warning rounded" title={org.subscription_status === "suspended" ? "Activate" : "Suspend"}>
                        {org.subscription_status === "suspended" ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(org.id, org.name)} className="p-1.5 text-muted-foreground hover:text-destructive rounded" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Client Form */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row">
          <div className="flex-1 bg-background/50" onClick={() => setShowAddClient(false)} />
          <div className="w-full md:w-[450px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen md:max-h-full">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Add New Client</h2>
              <button onClick={() => setShowAddClient(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {[
              { key: "company_name", label: "Company Name *", placeholder: "Acme Transport (Pty) Ltd" },
              { key: "brn", label: "BRN Number", placeholder: "2026/123456/07" },
              { key: "contact_name", label: "Contact Name", placeholder: "John Smith" },
              { key: "contact_email", label: "Contact Email *", placeholder: "admin@company.co.za" },
              { key: "contact_phone", label: "Contact Phone", placeholder: "+27..." },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
            <button onClick={handleAddClient} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Create Client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
