import {
  Truck, ShieldCheck, FileWarning, AlertTriangle,
  Sparkles, RefreshCw, ChevronRight, Loader2,
} from "lucide-react";
import { useState } from "react";

const mockStats = {
  totalVehicles: 142,
  complianceScore: 87,
  expiringCerts: 12,
  criticalAlerts: 3,
};

const trafficLight = {
  compliant: 98,
  warning: 26,
  critical: 11,
  expired: 7,
};

const mockInsights = [
  "🔴 Vehicle **GP 234-567** has 3 expired certificates including COF — requires immediate attention.",
  "⚠️ 8 vehicles across Johannesburg branch have services due within the next 500km.",
  "📊 Overall fleet compliance improved by 4% since last month, driven by Durban branch certificate renewals.",
];

const upcomingExpiries = [
  { vehicle: "GP 123-456", cert: "COF Certificate", days: 5 },
  { vehicle: "GP 789-012", cert: "Licence Disc", days: 12 },
  { vehicle: "CA 345-678", cert: "Operator Permit", days: 18 },
  { vehicle: "GP 901-234", cert: "Fire Extinguisher", days: 22 },
];

const recentInspections = [
  { vehicle: "GP 567-890", date: "28 Mar 2026", condition: "good", items: 2 },
  { vehicle: "CA 123-456", date: "27 Mar 2026", condition: "fair", items: 5 },
  { vehicle: "GP 234-567", date: "26 Mar 2026", condition: "poor", items: 8 },
  { vehicle: "KZN 456-789", date: "25 Mar 2026", condition: "good", items: 1 },
];

const recentAlerts = [
  { type: "certificate_expiry", message: "COF expired for GP 234-567", time: "2 hours ago" },
  { type: "service_due", message: "Service overdue for CA 345-678", time: "5 hours ago" },
  { type: "inspection_critical", message: "Critical damage found on GP 567-890", time: "1 day ago" },
];

const conditionColors: Record<string, string> = {
  good: "bg-success/20 text-success",
  fair: "bg-warning/20 text-warning",
  poor: "bg-destructive/20 text-destructive",
  unroadworthy: "bg-destructive/30 text-destructive",
};

export default function Dashboard() {
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiQuery = () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setTimeout(() => {
      setAiResponse(
        "Based on your fleet data, there are currently 3 vehicles with critical compliance issues. The most urgent is GP 234-567 with an expired COF certificate. I recommend prioritizing certificate renewals for the Johannesburg branch this week."
      );
      setAiLoading(false);
    }, 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Command Centre</h1>
        <p className="text-muted-foreground text-sm">Real-time fleet compliance overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Truck} label="Active Vehicles" value={mockStats.totalVehicles} color="text-primary" />
        <StatCard icon={ShieldCheck} label="Compliance Score" value={`${mockStats.complianceScore}%`} color="text-primary" />
        <StatCard icon={FileWarning} label="Expiring This Month" value={mockStats.expiringCerts} color="text-warning" />
        <StatCard
          icon={AlertTriangle}
          label="Critical Alerts"
          value={mockStats.criticalAlerts}
          color="text-destructive"
          highlight
        />
      </div>

      {/* Middle section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Traffic light panel */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Fleet Status Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            <TrafficItem label="Compliant" count={trafficLight.compliant} color="bg-success" />
            <TrafficItem label="Warning" count={trafficLight.warning} color="bg-warning" />
            <TrafficItem label="Critical" count={trafficLight.critical} color="bg-destructive" />
            <TrafficItem label="Expired" count={trafficLight.expired} color="bg-muted-foreground" />
          </div>
        </div>

        {/* AI Insights panel */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">AI Fleet Intelligence</h3>
            </div>
            <button className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-3 mb-4">
            {mockInsights.map((insight, i) => (
              <li key={i} className="text-sm text-muted-foreground leading-relaxed">{insight}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiQuery()}
              placeholder="Ask your fleet anything..."
              className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleAiQuery}
              disabled={aiLoading}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask"}
            </button>
          </div>
          {aiResponse && (
            <div className="mt-3 p-3 bg-secondary rounded-md text-sm text-foreground">{aiResponse}</div>
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming expiries */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Upcoming Expiries</h3>
          <div className="space-y-2">
            {upcomingExpiries.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.vehicle}</p>
                  <p className="text-xs text-muted-foreground">{item.cert}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${item.days <= 7 ? "bg-destructive/20 text-destructive" : item.days <= 30 ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary"}`}>
                  {item.days}d
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent inspections */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Inspections</h3>
          <div className="space-y-2">
            {recentInspections.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.vehicle}</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded capitalize ${conditionColors[item.condition]}`}>
                    {item.condition}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.items} items</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent alerts */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Alerts</h3>
          <div className="space-y-2">
            {recentAlerts.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">{item.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, highlight }: {
  icon: React.ElementType; label: string; value: string | number; color: string; highlight?: boolean;
}) {
  return (
    <div className={`stat-card ${highlight ? "border-destructive/50" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TrafficItem({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
      <div className={`w-4 h-4 rounded-full ${color}`} />
      <div>
        <p className="text-lg font-bold text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
