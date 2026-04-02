import { Settings as SettingsIcon, Building2, GitBranch, Users, Bell, CreditCard } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "organisation", icon: Building2, label: "Organisation" },
  { id: "branches", icon: GitBranch, label: "Branches" },
  { id: "users", icon: Users, label: "Users" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "billing", icon: CreditCard, label: "Billing" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("organisation");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your organisation settings</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="stat-card">
        {activeTab === "organisation" && (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Company Name</label>
              <input defaultValue="Acme Transport (Pty) Ltd" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">BRN Number</label>
              <input defaultValue="BRN-2024-12345" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Primary Contact Email</label>
              <input defaultValue="admin@acmetransport.co.za" className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <button className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">Save Changes</button>
          </div>
        )}
        {activeTab === "branches" && <p className="text-muted-foreground text-sm">Branch management coming soon. Connect backend to enable.</p>}
        {activeTab === "users" && <p className="text-muted-foreground text-sm">User management coming soon. Connect backend to enable.</p>}
        {activeTab === "notifications" && <p className="text-muted-foreground text-sm">Notification settings coming soon. Connect backend to enable.</p>}
        {activeTab === "billing" && (
          <div>
            <p className="text-foreground font-medium mb-1">Current Plan: Standard</p>
            <p className="text-muted-foreground text-sm mb-4">Status: Active</p>
            <p className="text-muted-foreground text-sm">Contact FleetPulse to upgrade your plan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
