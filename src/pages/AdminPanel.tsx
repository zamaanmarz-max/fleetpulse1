import { Search, Filter, UserCog, Eye, Ban, Trash2, Plus } from "lucide-react";

const mockOrgs = [
  { id: "1", name: "Acme Transport", brn: "BRN-2024-12345", plan: "enterprise", status: "active", vehicles: 142, users: 28, lastLogin: "2026-04-01", created: "2024-06-15" },
  { id: "2", name: "Swift Logistics", brn: "BRN-2024-67890", plan: "standard", status: "active", vehicles: 56, users: 12, lastLogin: "2026-03-30", created: "2024-09-22" },
  { id: "3", name: "Cape Carriers", brn: "BRN-2025-11111", plan: "standard", status: "trial", vehicles: 18, users: 5, lastLogin: "2026-03-28", created: "2025-01-10" },
  { id: "4", name: "Durban Hauliers", brn: "BRN-2024-22222", plan: "enterprise", status: "paused", vehicles: 89, users: 20, lastLogin: "2026-02-15", created: "2024-03-05" },
];

const statusStyles: Record<string, string> = {
  active: "bg-success/20 text-success",
  trial: "bg-primary/20 text-primary",
  paused: "bg-warning/20 text-warning",
};

export default function AdminPanel() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage all organisations</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Organisation
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Clients</p><p className="text-2xl font-bold text-foreground mt-1">4</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Active</p><p className="text-2xl font-bold text-success mt-1">2</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Paused</p><p className="text-2xl font-bold text-warning mt-1">1</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Vehicles</p><p className="text-2xl font-bold text-primary mt-1">305</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisation</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">BRN</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vehicles</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Users</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockOrgs.map((org) => (
              <tr key={org.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-foreground">{org.name}</td>
                <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{org.brn}</td>
                <td className="px-4 py-3 text-sm text-center capitalize text-foreground">{org.plan}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[org.status]}`}>{org.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-center font-mono text-foreground">{org.vehicles}</td>
                <td className="px-4 py-3 text-sm text-center font-mono text-foreground">{org.users}</td>
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
      </div>
    </div>
  );
}
