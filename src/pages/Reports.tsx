import { BarChart3, FileDown } from "lucide-react";

const reportTypes = [
  { id: "fleet", name: "Full Fleet Compliance Report", desc: "Complete overview of all vehicles and their compliance status" },
  { id: "certs", name: "Certificate Expiry Report", desc: "All certificates with expiry dates and status" },
  { id: "service", name: "KM Service Schedule Report", desc: "Service due/overdue vehicles by kilometre readings" },
  { id: "damage", name: "Damage Inspection Report", desc: "Inspection history and outstanding damage items" },
  { id: "driver", name: "Driver Compliance Report", desc: "Driver licence, PrDP, and demerit point status" },
  { id: "fines", name: "AARTO and Fines Report", desc: "Traffic fines and demerit summary" },
  { id: "branch", name: "Branch Comparison Report", desc: "Side-by-side branch compliance metrics" },
];

export default function Reports() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate and export compliance reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <div key={report.id} className="stat-card flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">{report.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{report.desc}</p>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-xs hover:bg-secondary/80">
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-xs hover:bg-secondary/80">
                <FileDown className="w-3.5 h-3.5" /> Excel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
