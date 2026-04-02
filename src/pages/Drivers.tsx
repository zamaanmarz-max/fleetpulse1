import { Search, Filter, Plus, Upload, Users } from "lucide-react";
import { useState } from "react";

const mockDrivers = [
  { id: "1", name: "Thabo Mokoena", idNo: "8501015800086", licenceCode: "EC", licenceExpiry: "2026-08-15", prdpExpiry: "2026-06-20", demerits: 2, status: "GREEN" },
  { id: "2", name: "Sipho Ndlovu", idNo: "9003125800087", licenceCode: "C1", licenceExpiry: "2026-04-22", prdpExpiry: "2026-05-10", demerits: 5, status: "AMBER" },
  { id: "3", name: "Johan van der Merwe", idNo: "8712015800088", licenceCode: "EC1", licenceExpiry: "2026-04-08", prdpExpiry: "2026-04-05", demerits: 9, status: "RED" },
  { id: "4", name: "Mbali Dlamini", idNo: "9205015800089", licenceCode: "C", licenceExpiry: "2027-01-15", prdpExpiry: "2027-02-28", demerits: 0, status: "GREEN" },
  { id: "5", name: "Pieter Botha", idNo: "8808015800090", licenceCode: "EC", licenceExpiry: "2026-12-30", prdpExpiry: "2026-11-15", demerits: 3, status: "GREEN" },
];

const statusStyles: Record<string, string> = {
  GREEN: "bg-success/20 text-success",
  AMBER: "bg-warning/20 text-warning",
  RED: "bg-destructive/20 text-destructive",
};

export default function Drivers() {
  const [search, setSearch] = useState("");

  const filtered = mockDrivers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.idNo.includes(search) ||
      d.licenceCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Drivers</h1>
          <p className="text-sm text-muted-foreground">{mockDrivers.length} drivers registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Driver
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or licence..."
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button className="flex items-center gap-2 bg-secondary text-muted-foreground px-4 py-2.5 rounded-lg text-sm border border-border hover:text-foreground">
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      <div className="glass-card overflow-hidden">
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
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{d.name}</td>
                <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{d.idNo}</td>
                <td className="px-4 py-3 text-sm text-center font-semibold text-foreground">{d.licenceCode}</td>
                <td className="px-4 py-3 text-sm text-center text-foreground">{d.licenceExpiry}</td>
                <td className="px-4 py-3 text-sm text-center text-foreground">{d.prdpExpiry}</td>
                <td className="px-4 py-3 text-sm text-center">
                  <span className={`font-mono ${d.demerits >= 9 ? "text-destructive font-bold" : d.demerits >= 5 ? "text-warning" : "text-foreground"}`}>
                    {d.demerits}/12
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[d.status]}`}>
                    {d.status === "GREEN" ? "Valid" : d.status === "AMBER" ? "Expiring" : "Critical"}
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
