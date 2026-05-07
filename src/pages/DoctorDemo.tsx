import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, FileText, AlertTriangle, CheckCircle, Clock,
  Building2, ChevronDown, ChevronUp, Bell, BarChart2,
  Users, Phone, Heart, Flame, Package, ClipboardList,
  ArrowRight, Lock, Star,
} from "lucide-react";

// ── Demo data for a medical practice ─────────────────────────
const DEMO_SITE = {
  name: "Sandton Medical Centre",
  address: "123 Rivonia Road, Sandton, 2196",
  responsible: "Dr. Sarah Nkosi",
  industry: "Healthcare",
  score: 68,
};

const DEMO_SECTIONS = [
  {
    num: 1, icon: "🏢", label: "Company Documents",
    docs: [
      { name: "Company Registration", status: "valid", expiry: null },
      { name: "VAT Certificate", status: "valid", expiry: null },
      { name: "Tax Clearance Certificate", status: "expiring", expiry: "2026-06-15", days: 38 },
      { name: "Public Liability Insurance", status: "valid", expiry: "2027-01-20" },
      { name: "Organogram", status: "missing", expiry: null },
    ],
  },
  {
    num: 2, icon: "📋", label: "Policy Statements",
    docs: [
      { name: "SHE Policy", status: "valid", expiry: "2027-02-01" },
      { name: "Smoking Policy", status: "valid", expiry: "2027-02-01" },
      { name: "Environmental Policy", status: "missing", expiry: null },
    ],
  },
  {
    num: 5, icon: "👤", label: "Appointments",
    docs: [
      { name: "Legal Appointments", status: "valid", expiry: "2027-01-01" },
      { name: "Medical Certificate of Fitness", status: "expired", expiry: "2025-12-01", days: -156 },
      { name: "Training Certificates", status: "valid", expiry: "2027-06-01" },
    ],
  },
  {
    num: 6, icon: "🚨", label: "Emergency Plan",
    docs: [
      { name: "Emergency Evacuation Plan", status: "valid", expiry: "2027-01-01" },
      { name: "Emergency Contact Numbers", status: "valid", expiry: null },
    ],
  },
  {
    num: 7, icon: "📝", label: "Registers & SOPs",
    docs: [
      { name: "First Aid Register", status: "valid", expiry: null },
      { name: "Fire Equipment Register", status: "expiring", expiry: "2026-05-31", days: 24 },
      { name: "Visitor Register", status: "valid", expiry: null },
      { name: "PPE Issue Register", status: "missing", expiry: null },
    ],
  },
  {
    num: 8, icon: "🔍", label: "Job Risk Assessment",
    docs: [
      { name: "Job Risk Assessment", status: "valid", expiry: "2027-01-01" },
    ],
  },
];

const STATUS_CONFIG = {
  valid:    { bg: "bg-success/10 border-success/30",    text: "text-success",          badge: "bg-success/20 text-success",         label: "✓ Valid" },
  expiring: { bg: "bg-warning/10 border-warning/30",    text: "text-warning",          badge: "bg-warning/20 text-warning",         label: "⚠ Expiring" },
  expired:  { bg: "bg-destructive/10 border-destructive/30", text: "text-destructive", badge: "bg-destructive/20 text-destructive",  label: "✗ Expired" },
  missing:  { bg: "bg-muted/30 border-border",          text: "text-muted-foreground", badge: "bg-muted text-muted-foreground",      label: "Missing" },
};

const ALERTS = [
  { type: "expired",  icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", text: "Medical Certificate of Fitness — EXPIRED (156 days overdue)" },
  { type: "expiring", icon: Clock,         color: "text-warning",     bg: "bg-warning/10 border-warning/20",         text: "Tax Clearance Certificate — expires in 38 days" },
  { type: "expiring", icon: Clock,         color: "text-warning",     bg: "bg-warning/10 border-warning/20",         text: "Fire Equipment Register — expires in 24 days" },
  { type: "missing",  icon: FileText,      color: "text-muted-foreground", bg: "bg-muted/20 border-border",           text: "Environmental Policy — not uploaded" },
  { type: "missing",  icon: FileText,      color: "text-muted-foreground", bg: "bg-muted/20 border-border",           text: "PPE Issue Register — not uploaded" },
  { type: "missing",  icon: FileText,      color: "text-muted-foreground", bg: "bg-muted/20 border-border",           text: "Organogram — not uploaded" },
];

export default function DoctorDemo() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number[]>([1, 5]);
  const [showCallout, setShowCallout] = useState(true);

  const toggle = (n: number) => setExpanded(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]);

  const score = DEMO_SITE.score;
  const passed = score >= 75;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Top bar */}
      <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold text-foreground">MARZ</span>
            <span className="text-xs text-muted-foreground ml-2">H&S Compliance Platform</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-semibold">Healthcare Module</span>
          <button onClick={() => navigate("/login")}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
            <Lock className="w-3.5 h-3.5" /> Get Access
          </button>
        </div>
      </div>

      {/* Demo callout */}
      {showCallout && (
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-semibold text-primary">Demo Mode</span> — This is a preview of what your practice's H&S compliance file looks like on MARZ. All data is for demonstration only.
            </p>
          </div>
          <button onClick={() => setShowCallout(false)} className="text-muted-foreground hover:text-foreground text-xs">Dismiss</button>
        </div>
      )}

      <div className="flex">

        {/* Sidebar — H&S only, no fleet items */}
        <div className="w-56 min-h-screen bg-card border-r border-border p-4 space-y-1 flex-shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-3">Navigation</p>
          {[
            { icon: BarChart2,    label: "Dashboard",        active: false },
            { icon: Shield,       label: "H&S File",         active: true  },
            { icon: ClipboardList,label: "Compliance",       active: false },
            { icon: Bell,         label: "Alerts",           active: false },
          ].map(item => (
            <div key={item.label}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${item.active ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </div>
          ))}
          <div className="pt-4 mt-4 border-t border-border">
            <p className="text-xs text-muted-foreground px-2 mb-2">Not included</p>
            {[
              { label: "Vehicles" },
              { label: "Drivers" },
              { label: "Fleet Availability" },
              { label: "Maintenance" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground/40 cursor-not-allowed">
                <Lock className="w-3 h-3" /> {item.label}
              </div>
            ))}
          </div>
          <div className="pt-4 mt-4 border-t border-border">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center space-y-2">
              <p className="text-xs font-semibold text-primary">H&S Only Plan</p>
              <p className="text-xl font-bold text-foreground">R999<span className="text-xs text-muted-foreground">/month</span></p>
              <p className="text-xs text-muted-foreground">Per site</p>
              <button onClick={() => navigate("/login")} className="w-full bg-primary text-primary-foreground text-xs py-1.5 rounded-lg font-semibold hover:opacity-90">
                Get Started
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">

          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> H&S File
              </h1>
              <p className="text-sm text-muted-foreground">Digital SHEQ file — 44 required OHS Act documents</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full">Healthcare Module</span>
            </div>
          </div>

          {/* Site pill */}
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
              <Building2 className="w-3.5 h-3.5" /> {DEMO_SITE.name}
            </div>
          </div>

          {/* Score card */}
          <div className={`glass-card p-5 border-2 ${passed ? "border-success/40" : "border-warning/40"}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">SHEQ Compliance Score</p>
                <p className="text-xs text-muted-foreground">{DEMO_SITE.name} · {DEMO_SITE.address}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className={`text-5xl font-bold ${passed ? "text-success" : "text-warning"}`}>{score}%</span>
                  <div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full block mb-1 ${passed ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                      {passed ? "✓ COMPLIANT" : "⚠ NEEDS ATTENTION"}
                    </span>
                    <p className="text-xs text-muted-foreground">6 items need attention · 75% threshold</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-destructive/10 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Expired</p>
                  <p className="text-xl font-bold text-destructive">1</p>
                </div>
                <div className="bg-warning/10 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Expiring</p>
                  <p className="text-xl font-bold text-warning">2</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Missing</p>
                  <p className="text-xl font-bold text-muted-foreground">3</p>
                </div>
                <div className="bg-success/10 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Valid</p>
                  <p className="text-xl font-bold text-success">15</p>
                </div>
              </div>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
              <div className="h-full bg-warning rounded-full" style={{ width: `${score}%` }} />
              <div className="absolute top-0 h-full border-l-2 border-dashed border-foreground/30" style={{ left: "75%" }}>
                <span className="absolute -top-5 left-1 text-xs text-muted-foreground">75%</span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="glass-card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-warning" /> Action Required ({ALERTS.length})
            </h3>
            {ALERTS.map((a, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm ${a.bg}`}>
                <a.icon className={`w-4 h-4 flex-shrink-0 ${a.color}`} />
                <span className="text-foreground">{a.text}</span>
                <button className="ml-auto text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                  Fix <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Document sections */}
          <div className="space-y-3">
            {DEMO_SECTIONS.map(sec => {
              const isOpen = expanded.includes(sec.num);
              const valid = sec.docs.filter(d => d.status === "valid").length;
              const hasIssues = sec.docs.some(d => d.status !== "valid");
              return (
                <div key={sec.num} className={`glass-card overflow-hidden border ${hasIssues ? "border-destructive/20" : "border-border"}`}>
                  <button onClick={() => toggle(sec.num)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{sec.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{sec.num}. {sec.label}</p>
                        <p className="text-xs text-muted-foreground">{sec.docs.length} documents required</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-sm font-bold ${valid === sec.docs.length ? "text-success" : "text-warning"}`}>
                          {Math.round((valid / sec.docs.length) * 100)}%
                        </p>
                        <p className="text-xs text-muted-foreground">{valid}/{sec.docs.length}</p>
                      </div>
                      {hasIssues && <AlertTriangle className="w-4 h-4 text-warning" />}
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                      {sec.docs.map((doc, i) => {
                        const style = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG];
                        return (
                          <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${style.bg}`}>
                            <div className="flex items-center gap-3">
                              <FileText className={`w-4 h-4 flex-shrink-0 ${style.text}`} />
                              <div>
                                <p className="text-sm font-medium text-foreground">{doc.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>{style.label}</span>
                                  {doc.expiry && <span className="text-xs text-muted-foreground">Expires: {doc.expiry}</span>}
                                  {doc.days !== undefined && doc.days < 0 && <span className="text-xs font-semibold text-destructive">{Math.abs(doc.days)}d overdue</span>}
                                  {doc.days !== undefined && doc.days > 0 && doc.days <= 60 && <span className="text-xs font-semibold text-warning">{doc.days}d left</span>}
                                </div>
                              </div>
                            </div>
                            <button className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:opacity-80 font-semibold flex-shrink-0">
                              {doc.status === "missing" ? "Upload" : "Update"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="glass-card p-6 text-center space-y-4 border-2 border-primary/30">
            <Shield className="w-10 h-10 text-primary mx-auto" />
            <h3 className="text-lg font-bold text-foreground">This is your practice's digital H&S file</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Upload your documents once. MARZ tracks expiry dates, alerts you when something is due, 
              and generates your compliance report automatically. No H&S consultant needed.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-success" /> R999/month per site</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-success" /> Cancel anytime</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-success" /> Setup in 30 minutes</span>
            </div>
            <button onClick={() => navigate("/login")}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-xl text-sm font-bold hover:opacity-90 flex items-center gap-2 mx-auto">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
