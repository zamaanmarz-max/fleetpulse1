import { Search, Filter, Plus, Download, Upload, Truck } from "lucide-react";
import { useState } from "react";

const mockVehicles = [
  { id: "1", fleetNo: "FP-001", regNo: "GP 123-456", make: "Toyota", model: "Hilux", branch: "Johannesburg", kmUntilService: 2500, riskScore: 15, status: "COMPLIANT" },
  { id: "2", fleetNo: "FP-002", regNo: "GP 234-567", make: "Isuzu", model: "NPR", branch: "Johannesburg", kmUntilService: 800, riskScore: 45, status: "WARNING" },
  { id: "3", fleetNo: "FP-003", regNo: "CA 345-678", make: "Hino", model: "500", branch: "Cape Town", kmUntilService: -200, riskScore: 72, status: "CRITICAL" },
  { id: "4", fleetNo: "FP-004", regNo: "GP 456-789", make: "Mercedes", model: "Actros", branch: "Johannesburg", kmUntilService: -1500, riskScore: 90, status: "EXPIRED" },
  { id: "5", fleetNo: "FP-005", regNo: "KZN 567-890", make: "Volvo", model: "FH16", branch: "Durban", kmUntilService: 5000, riskScore: 5, status: "COMPLIANT" },
  { id: "6", fleetNo: "FP-006", regNo: "CA 678-901", make: "Scania", model: "R450", branch: "Cape Town", kmUntilService: 1200, riskScore: 25, status: "COMPLIANT" },
];

const statusStyles: Record<string, string> = {
  COMPLIANT: "bg-success/20 text-success",
  WARNING: "bg-warning/20 text-warning",
  CRITICAL: "bg-destructive/20 text-destructive",
  EXPIRED: "bg-destructive/30 text-destructive",
};

function riskColor(score: number) {
  if (score <= 25) return "text-success";
  if (score <= 50) return "text-warning";
  if (score <= 75) return "text-destructive";
  return "text-destructive font-bold";
}

export default function Vehicles() {
  const [search, setSearch] = useState("");

  const filtered = mockVehicles.filter(
    (v) =>
      v.regNo.toLowerCase().includes(search.toLowerCase()) ||
      v.fleetNo.toLowerCase().includes(search.toLowerCase()) ||
      v.make.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vehicles</h1>
          <p className="text-sm text-muted-foreground">{mockVehicles.length} vehicles in fleet</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Download className="w-4 h-4" /> Export
          </button>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reg, fleet no, or make..."
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button className="flex items-center gap-2 bg-secondary text-muted-foreground px-4 py-2.5 rounded-lg text-sm border border-border hover:text-foreground">
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fleet No</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reg No</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Make & Model</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Branch</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">KM Until Service</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Score</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm font-mono text-foreground">{v.fleetNo}</td>
                <td className="px-4 py-3 text-sm font-semibold text-foreground">{v.regNo}</td>
                <td className="px-4 py-3 text-sm text-foreground">{v.make} {v.model}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{v.branch}</td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${v.kmUntilService < 0 ? "text-destructive" : v.kmUntilService < 1000 ? "text-warning" : "text-foreground"}`}>
                  {v.kmUntilService.toLocaleString()} km
                </td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${riskColor(v.riskScore)}`}>{v.riskScore}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[v.status]}`}>
                    {v.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
