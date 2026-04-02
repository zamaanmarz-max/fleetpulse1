import { Search, Filter, Plus, Download, FileCheck, Calendar } from "lucide-react";
import { useState } from "react";

const mockCerts = [
  { id: "1", vehicleReg: "GP 123-456", type: "COF Certificate", number: "COF-2024-001", expiryDate: "2026-05-15", daysRemaining: 43, status: "valid", uploadedBy: "Thabo M." },
  { id: "2", vehicleReg: "GP 234-567", type: "Licence Disc", number: "LD-2024-002", expiryDate: "2026-04-08", daysRemaining: 6, status: "expiring", uploadedBy: "Sipho N." },
  { id: "3", vehicleReg: "CA 345-678", type: "Operator Permit", number: "OP-2024-003", expiryDate: "2026-03-28", daysRemaining: -5, status: "expired", uploadedBy: "Johan vdM." },
  { id: "4", vehicleReg: "GP 456-789", type: "Fire Extinguisher", number: "FE-2024-004", expiryDate: "2026-07-20", daysRemaining: 109, status: "valid", uploadedBy: "Mbali D." },
  { id: "5", vehicleReg: "KZN 567-890", type: "Dangerous Goods Permit", number: "DG-2024-005", expiryDate: "2026-04-25", daysRemaining: 23, status: "expiring", uploadedBy: "Pieter B." },
];

const statusStyles: Record<string, string> = {
  valid: "bg-success/20 text-success",
  expiring: "bg-warning/20 text-warning",
  expired: "bg-destructive/20 text-destructive",
};

export default function Certificates() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "calendar">("table");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Certificates</h1>
          <p className="text-sm text-muted-foreground">Manage vehicle compliance certificates</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Download className="w-4 h-4" /> Export
          </button>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Upload Certificate
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search certificates..."
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button className="flex items-center gap-2 bg-secondary text-muted-foreground px-4 py-2.5 rounded-lg text-sm border border-border hover:text-foreground">
          <Filter className="w-4 h-4" /> Filters
        </button>
        <div className="flex bg-secondary rounded-lg border border-border overflow-hidden">
          <button onClick={() => setView("table")} className={`px-3 py-2 text-sm ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <FileCheck className="w-4 h-4" />
          </button>
          <button onClick={() => setView("calendar")} className={`px-3 py-2 text-sm ${view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vehicle</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days Left</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uploaded By</th>
            </tr>
          </thead>
          <tbody>
            {mockCerts.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-foreground">{c.vehicleReg}</td>
                <td className="px-4 py-3 text-sm text-foreground">{c.type}</td>
                <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{c.number}</td>
                <td className="px-4 py-3 text-sm text-center text-foreground">{c.expiryDate}</td>
                <td className={`px-4 py-3 text-sm text-center font-mono ${c.daysRemaining <= 0 ? "text-destructive font-bold" : c.daysRemaining <= 30 ? "text-warning" : "text-foreground"}`}>
                  {c.daysRemaining <= 0 ? `${Math.abs(c.daysRemaining)}d overdue` : `${c.daysRemaining}d`}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[c.status]}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{c.uploadedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
