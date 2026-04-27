import { ShieldCheck } from "lucide-react";
import { ComplianceBreakdownItem } from "@/lib/compliance";

interface Props {
  score: number;
  status: "compliant" | "warning" | "critical";
  breakdown: ComplianceBreakdownItem[];
  onIssueClick?: (item: ComplianceBreakdownItem) => void;
}

export function ComplianceScoreCard({ score, status, breakdown, onIssueClick }: Props) {
  const colors =
    status === "compliant"
      ? { ring: "text-success", bg: "bg-success/15", text: "text-success", label: "Compliant" }
      : status === "warning"
      ? { ring: "text-warning", bg: "bg-warning/15", text: "text-warning", label: "Warning" }
      : { ring: "text-destructive", bg: "bg-destructive/15", text: "text-destructive", label: "Critical" };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Compliance Score
        </h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${colors.bg} ${colors.text}`}>{colors.label}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className={`relative w-20 h-20 rounded-full flex items-center justify-center ${colors.bg}`}>
          <span className={`text-2xl font-bold ${colors.text}`}>{score}<span className="text-sm font-normal opacity-70">%</span></span>
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Out of 100</p>
          {breakdown.length === 0 ? (
            <p className="text-xs text-success mt-1">No issues — fleet is in good shape</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">{breakdown.length} factor{breakdown.length === 1 ? "" : "s"} affecting score</p>
          )}
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="mt-4 space-y-1.5 max-h-48 overflow-y-auto pr-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Score breakdown</p>
          {breakdown.map((b, i) => (
            <button key={i} type="button" onClick={() => onIssueClick?.(b)} className="w-full flex items-center justify-between py-1.5 px-2 rounded bg-secondary/30 hover:bg-secondary/60 text-xs text-left">
              <span className={b.severity === "critical" ? "text-destructive" : b.severity === "warning" ? "text-warning" : "text-foreground"}>{b.label}</span>
              <span className="font-mono font-semibold text-destructive">−{b.deduction}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
