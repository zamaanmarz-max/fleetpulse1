import { Search, Filter, Plus, Download, ClipboardCheck } from "lucide-react";

const mockInspections = [
  { id: "1", vehicleReg: "GP 123-456", date: "2026-03-28", inspector: "Thabo M.", condition: "good", items: 2, newDamage: 0, status: "submitted" },
  { id: "2", vehicleReg: "CA 345-678", date: "2026-03-27", inspector: "Sipho N.", condition: "fair", items: 5, newDamage: 2, status: "submitted" },
  { id: "3", vehicleReg: "GP 234-567", date: "2026-03-26", inspector: "Johan vdM.", condition: "poor", items: 8, newDamage: 3, status: "reviewed" },
  { id: "4", vehicleReg: "KZN 567-890", date: "2026-03-25", inspector: "Mbali D.", condition: "good", items: 1, newDamage: 0, status: "submitted" },
  { id: "5", vehicleReg: "GP 456-789", date: "2026-03-24", inspector: "Pieter B.", condition: "unroadworthy", items: 12, newDamage: 5, status: "draft" },
];

const conditionStyles: Record<string, string> = {
  good: "bg-success/20 text-success",
  fair: "bg-warning/20 text-warning",
  poor: "bg-destructive/20 text-destructive",
  unroadworthy: "bg-destructive/30 text-destructive",
};

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/20 text-primary",
  reviewed: "bg-success/20 text-success",
};

export default function Inspections() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Damage Inspections</h1>
          <p className="text-sm text-muted-foreground">Vehicle condition and damage tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Download className="w-4 h-4" /> Export PDF
          </button>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90">
            <ClipboardCheck className="w-5 h-5" /> Start New Inspection
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vehicle</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inspector</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Condition</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Damage</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockInspections.map((ins) => (
              <tr key={ins.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-foreground">{ins.vehicleReg}</td>
                <td className="px-4 py-3 text-sm text-center text-foreground">{ins.date}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{ins.inspector}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${conditionStyles[ins.condition]}`}>{ins.condition}</span>
                </td>
                <td className="px-4 py-3 text-sm text-center font-mono text-foreground">{ins.items}</td>
                <td className="px-4 py-3 text-sm text-center font-mono">{ins.newDamage > 0 ? <span className="text-warning">{ins.newDamage}</span> : <span className="text-muted-foreground">0</span>}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[ins.status]}`}>{ins.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
