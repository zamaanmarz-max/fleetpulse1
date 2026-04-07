import { Search, Plus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDrivers } from "@/hooks/useOrgData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const statusStyles: Record<string, string> = {
  GREEN: "bg-success/20 text-success",
  AMBER: "bg-warning/20 text-warning",
  RED: "bg-destructive/20 text-destructive",
};

function calcStatus(licenceExpiry: string | null, prdpExpiry: string | null): string {
  const now = Date.now();
  const check = (d: string | null) => {
    if (!d) return "GREEN";
    const diff = (new Date(d).getTime() - now) / 86400000;
    if (diff <= 7) return "RED";
    if (diff <= 30) return "AMBER";
    return "GREEN";
  };
  const l = check(licenceExpiry);
  const p = check(prdpExpiry);
  if (l === "RED" || p === "RED") return "RED";
  if (l === "AMBER" || p === "AMBER") return "AMBER";
  return "GREEN";
}

export default function Drivers() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { data: drivers, isLoading } = useDrivers();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const filtered = (drivers || []).filter(
    (d) =>
      d.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.id_number || "").includes(search) ||
      (d.licence_code || "").toLowerCase().includes(search.toLowerCase())
  );

  const [form, setForm] = useState({
    full_name: "", id_number: "", licence_number: "", licence_expiry: "",
    licence_code: "EC", prdp_number: "", prdp_expiry: "", prdp_category: "G",
    phone: "", email: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.full_name || !profile?.organisation_id) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("drivers").insert({
      organisation_id: profile.organisation_id,
      full_name: form.full_name,
      id_number: form.id_number || null,
      licence_number: form.licence_number || null,
      licence_expiry: form.licence_expiry || null,
      licence_code: form.licence_code || null,
      prdp_number: form.prdp_number || null,
      prdp_expiry: form.prdp_expiry || null,
      prdp_category: form.prdp_category || null,
      phone: form.phone || null,
      email: form.email || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Driver added");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Drivers</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} drivers registered</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or licence..." className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No drivers found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID Number</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Licence Code</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Licence Expiry</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">PrDP Expiry</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Demerits</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const status = calcStatus(d.licence_expiry, d.prdp_expiry);
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
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[status]}`}>
                        {status === "GREEN" ? "Valid" : status === "AMBER" ? "Expiring" : "Critical"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/50" onClick={() => setShowForm(false)} />
          <div className="w-[450px] bg-card border-l border-border p-6 overflow-y-auto space-y-4">
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