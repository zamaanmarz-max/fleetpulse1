import { Search, Filter, Plus, Eye, Ban, Trash2, Loader2 } from "lucide-react";
import { useOrganisations } from "@/hooks/useOrgData";

export default function AdminPanel() {
  const { data: orgs, isLoading } = useOrganisations();

  const statusStyles: Record<string, string> = {
    active: "bg-success/20 text-success",
    trial: "bg-primary/20 text-primary",
    paused: "bg-warning/20 text-warning",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage all organisations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Clients</p><p className="text-2xl font-bold text-foreground mt-1">{(orgs || []).length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Active</p><p className="text-2xl font-bold text-success mt-1">{(orgs || []).filter(o => o.subscription_status === "active").length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Paused</p><p className="text-2xl font-bold text-warning mt-1">{(orgs || []).filter(o => o.subscription_status === "paused").length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Trial</p><p className="text-2xl font-bold text-primary mt-1">{(orgs || []).filter(o => o.subscription_status === "trial").length}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (orgs || []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No organisations found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">BRN</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(orgs || []).map((org) => (
                <tr key={org.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{org.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{org.registration_number || "-"}</td>
                  <td className="px-4 py-3 text-sm text-center capitalize text-foreground">{org.subscription_plan || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[org.subscription_status || "trial"]}`}>{org.subscription_status || "trial"}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 text-muted-foreground hover:text-foreground rounded"><Eye className="w-4 h-4" /></button>
                      <button className="p-1.5 text-muted-foreground hover:text-warning rounded"><Ban className="w-4 h-4" /></button>
                      <button className="p-1.5 text-muted-foreground hover:text-destructive rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
