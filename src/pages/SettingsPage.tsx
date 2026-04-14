import { Building2, GitBranch, Users, Bell, CreditCard, Plus, Loader2, X, Trash2, Pencil, Save, UserPlus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const tabs = [
  { id: "organisation", icon: Building2, label: "Organisation" },
  { id: "branches", icon: GitBranch, label: "Branches" },
  { id: "users", icon: Users, label: "Users" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "billing", icon: CreditCard, label: "Billing" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("organisation");
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your organisation settings</p>
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap", activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      <div className="stat-card">
        {activeTab === "organisation" && <OrganisationTab />}
        {activeTab === "branches" && <BranchesTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "notifications" && <p className="text-muted-foreground text-sm">Notification settings coming soon.</p>}
        {activeTab === "billing" && (
          <div>
            <p className="text-foreground font-medium mb-1">Current Plan: Standard</p>
            <p className="text-muted-foreground text-sm mb-4">Status: Active</p>
            <p className="text-muted-foreground text-sm">Contact MARZ Fleet to upgrade your plan.</p>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-muted-foreground pt-4">
        <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        <span className="mx-2">·</span>
        © 2026 MARZ Technologies (Pty) Ltd. All rights reserved.
      </div>
    </div>
  );
}

function OrganisationTab() {
  const { profile } = useAuth();
  const { data: org } = useQuery({
    queryKey: ["my_organisation", profile?.organisation_id],
    queryFn: async () => {
      const { data } = await supabase.from("organisations").select("*").eq("id", profile!.organisation_id!).maybeSingle();
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const startEdit = () => {
    if (!org) return;
    setForm({ name: org.name || "", registration_number: org.registration_number || "", primary_contact_email: org.primary_contact_email || "", primary_contact_name: org.primary_contact_name || "", primary_contact_phone: org.primary_contact_phone || "" });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!org) return;
    setSaving(true);
    const { error } = await supabase.from("organisations").update({
      name: form.name, registration_number: form.registration_number || null,
      primary_contact_email: form.primary_contact_email || null,
      primary_contact_name: form.primary_contact_name || null,
      primary_contact_phone: form.primary_contact_phone || null,
    }).eq("id", org.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Organisation updated"); setEditing(false); queryClient.invalidateQueries({ queryKey: ["my_organisation"] }); }
  };

  if (!org) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return editing ? (
    <div className="space-y-4 max-w-lg">
      {[
        { key: "name", label: "Company Name" },
        { key: "registration_number", label: "BRN Number" },
        { key: "primary_contact_name", label: "Contact Name" },
        { key: "primary_contact_email", label: "Contact Email" },
        { key: "primary_contact_phone", label: "Contact Phone" },
      ].map(f => (
        <div key={f.key}>
          <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
          <input value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground px-4 py-2 border border-border rounded-lg">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
      </div>
    </div>
  ) : (
    <div className="space-y-3 max-w-lg">
      <div className="flex justify-end"><button onClick={startEdit} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90"><Pencil className="w-3.5 h-3.5" /> Edit</button></div>
      {[
        { label: "Company Name", value: org.name },
        { label: "BRN", value: org.registration_number || "-" },
        { label: "Contact", value: org.primary_contact_name || "-" },
        { label: "Email", value: org.primary_contact_email || "-" },
        { label: "Phone", value: org.primary_contact_phone || "-" },
      ].map(r => (
        <div key={r.label} className="flex items-center justify-between py-2 border-b border-border/50">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{r.label}</span>
          <span className="text-sm font-medium text-foreground">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function BranchesTab() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", city: "", address: "", manager_name: "", manager_phone: "", manager_email: "" });

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const resetForm = () => {
    setForm({ name: "", city: "", address: "", manager_name: "", manager_phone: "", manager_email: "" });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (b: any) => {
    setForm({ name: b.name, city: b.city || "", address: b.address || "", manager_name: b.manager_name || "", manager_phone: b.manager_phone || "", manager_email: b.manager_email || "" });
    setEditId(b.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !profile?.organisation_id) { toast.error("Branch name is required"); return; }
    setSaving(true);
    const payload = { ...form, organisation_id: profile.organisation_id };
    const { error } = editId
      ? await supabase.from("branches").update(payload).eq("id", editId)
      : await supabase.from("branches").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(editId ? "Branch updated" : "Branch added"); resetForm(); queryClient.invalidateQueries({ queryKey: ["branches"] }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this branch?")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Branch deleted"); queryClient.invalidateQueries({ queryKey: ["branches"] }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90"><Plus className="w-4 h-4" /> Add Branch</button>
      </div>
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /> : (branches || []).length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">No branches created yet.</p>
      ) : (
        <div className="space-y-2">
          {(branches || []).map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-foreground">{b.name}</p>
                <p className="text-xs text-muted-foreground">{[b.city, b.manager_name].filter(Boolean).join(" · ") || "No details"}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(b)} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(b.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="bg-card border border-border rounded-lg p-6 w-[420px] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-foreground">{editId ? "Edit Branch" : "Add Branch"}</h3><button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button></div>
            {[
              { key: "name", label: "Branch Name *", placeholder: "Johannesburg HQ" },
              { key: "city", label: "City", placeholder: "Johannesburg" },
              { key: "address", label: "Address", placeholder: "123 Fleet Street" },
              { key: "manager_name", label: "Manager Name", placeholder: "John Smith" },
              { key: "manager_phone", label: "Manager Phone", placeholder: "+27..." },
              { key: "manager_email", label: "Manager Email", placeholder: "manager@company.co.za" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
            <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} {editId ? "Update" : "Add"} Branch</button>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", role: "fleetcontroller", branch_id: "" });

  const { data: users, isLoading } = useQuery({
    queryKey: ["org_users", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*, branches(name)").eq("organisation_id", profile!.organisation_id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  const roleLabels: Record<string, string> = {
    superadmin: "Super Admin",
    clientadmin: "Client Admin",
    branchmanager: "Branch Manager",
    fleetcontroller: "Fleet Controller",
    inspector: "Inspector",
    driver: "Driver (View Only)",
  };

  const availableRoles = ["branchmanager", "fleetcontroller", "inspector", "driver"];

  const handleInvite = async () => {
    if (!form.full_name || !form.email || !profile?.organisation_id) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const tempPassword = `Fleet${Date.now().toString(36)}!`;
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: tempPassword,
        options: {
          data: {
            full_name: form.full_name,
            organisation_id: profile.organisation_id,
            role: form.role,
            branch_id: form.branch_id || undefined,
          },
        },
      });
      if (error) throw error;
      toast.success(`User invited. Temporary password: ${tempPassword}`);
      setShowInvite(false);
      setForm({ full_name: "", email: "", role: "fleetcontroller", branch_id: "" });
      queryClient.invalidateQueries({ queryKey: ["org_users"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to invite user");
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = profile?.role === "clientadmin" || profile?.role === "superadmin";

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90"><UserPlus className="w-4 h-4" /> Invite User</button>
        </div>
      )}
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /> : (users || []).length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">No users found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Email</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Role</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Branch</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
            </tr></thead>
            <tbody>
              {(users || []).map(u => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{u.full_name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.email || "-"}</td>
                  <td className="px-4 py-3 text-sm text-center"><span className="text-xs bg-secondary px-2 py-1 rounded-full">{roleLabels[u.role || "fleetcontroller"] || u.role}</span></td>
                  <td className="px-4 py-3 text-sm text-center text-muted-foreground">{(u as any).branches?.name || "-"}</td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${u.is_active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="bg-card border border-border rounded-lg p-6 w-[420px] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-foreground">Invite User</h3><button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button></div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Full Name *</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="John Smith" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@company.co.za" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {availableRoles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Branch (optional)</label>
              <select value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">All Branches</option>
                {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <button onClick={handleInvite} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Send Invite</button>
          </div>
        </div>
      )}
    </div>
  );
}
