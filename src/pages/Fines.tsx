import { Search, Filter, Plus, Download, Receipt } from "lucide-react";

const mockFines = [
  { id: "1", fineNo: "JHB-2026-001", vehicleReg: "GP 234-567", driver: "Thabo Mokoena", authority: "JMPD", amount: 2500, offenceDate: "2026-03-15", demerits: 2, status: "unpaid" },
  { id: "2", fineNo: "CPT-2026-002", vehicleReg: "CA 345-678", driver: "Sipho Ndlovu", authority: "City of Cape Town", amount: 1500, offenceDate: "2026-03-10", demerits: 1, status: "paid" },
  { id: "3", fineNo: "DUR-2026-003", vehicleReg: "KZN 567-890", driver: "Johan van der Merwe", authority: "eThekwini Metro", amount: 5000, offenceDate: "2026-02-28", demerits: 4, status: "disputed" },
];

const statusStyles: Record<string, string> = {
  unpaid: "bg-destructive/20 text-destructive",
  paid: "bg-success/20 text-success",
  disputed: "bg-warning/20 text-warning",
};

export default function Fines() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fines & AARTO</h1>
          <p className="text-sm text-muted-foreground">Traffic fine and demerit point management</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm hover:bg-secondary/80">
            <Download className="w-4 h-4" /> Export
          </button>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Fine
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Fines</p><p className="text-2xl font-bold text-foreground mt-1">3</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding</p><p className="text-2xl font-bold text-destructive mt-1">R 2,500</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Demerits</p><p className="text-2xl font-bold text-warning mt-1">7</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground uppercase tracking-wider">BRN Risk</p><p className="text-2xl font-bold text-success mt-1">Low</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fine No</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vehicle</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Authority</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Demerits</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockFines.map((f) => (
              <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm font-mono text-foreground">{f.fineNo}</td>
                <td className="px-4 py-3 text-sm text-foreground">{f.vehicleReg}</td>
                <td className="px-4 py-3 text-sm text-foreground">{f.driver}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{f.authority}</td>
                <td className="px-4 py-3 text-sm text-right font-mono text-foreground">R {f.amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-center font-mono text-warning">{f.demerits}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[f.status]}`}>{f.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
