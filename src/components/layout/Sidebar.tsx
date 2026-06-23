import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import {
  LayoutDashboard, Truck, Users, FileCheck, Shield,
  BarChart3, Settings, ChevronLeft, ChevronRight,
  Receipt, Bell, UserCog, LogOut, Upload, Warehouse, Wrench, HeartPulse, Radio, Thermometer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getModuleTerms } from "@/lib/moduleTerms";

const ALL_NAV_ITEMS = [
  { to: "/dashboard",          icon: LayoutDashboard, label: "Dashboard",        modules: ["all"] },
  { to: "/control-tower",      icon: Radio,           label: "Control Tower",    modules: ["fleet_only","fleet_hs"] },
  { to: "/vehicles",           icon: Truck,           label: "Vehicles",         modules: ["fleet_only","fleet_hs","fridge_only"] },
  { to: "/drivers",            icon: Users,           label: "Drivers",          modules: ["fleet_only","fleet_hs"] },
  { to: "/maintenance",        icon: Wrench,          label: "Maintenance",      modules: ["fleet_only","fleet_hs"] },
  { to: "/fridge-tracker",     icon: Thermometer,     label: "Fridge Tracker",   modules: ["fleet_only","fleet_hs","fridge_only"] },
  { to: "/hs-file",            icon: HeartPulse,      label: "H&S File",         modules: ["hs_only","fleet_hs"] },
  { to: "/compliance",         icon: Shield,          label: "Compliance",       modules: ["hs_only","fleet_hs"] },
  { to: "/certificates",       icon: FileCheck,       label: "Certificates",     modules: ["fleet_only","fleet_hs"] },
  { to: "/fines",              icon: Receipt,         label: "Fines & AARTO",    modules: ["fleet_only","fleet_hs"] },
  { to: "/reports",            icon: BarChart3,       label: "Reports",          modules: ["fleet_only","fleet_hs","hs_only"] },
  { to: "/alerts",             icon: Bell,            label: "Alerts",           modules: ["fleet_only","fleet_hs","hs_only"] },
  { to: "/fleet-availability", icon: Warehouse,       label: "Availability",     modules: ["fleet_only","fleet_hs"] },
  { to: "/import",             icon: Upload,          label: "Import",           modules: ["fleet_only","fleet_hs"] },
  { to: "/settings",           icon: Settings,        label: "Settings",         modules: ["all"] },
];

const adminItems = [
  { to: "/admin", icon: UserCog, label: "Admin Panel" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "superadmin";

  // Filter nav based on org module type
  const moduleType = (profile as any)?.organisations?.module_type || "fleet_hs";
  const terms = getModuleTerms((profile as any)?.organisations?.industry);
  const navItems = ALL_NAV_ITEMS.filter(item =>
    item.modules.includes("all") || item.modules.includes(moduleType)
  ).map(item => (item.to === "/fridge-tracker" && !terms.isRefrigeration) ? { ...item, label: terms.trackerLabel, icon: Wrench } : item);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Truck className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-foreground whitespace-nowrap">
              MARZ <span className="text-primary">Fleet</span>
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-sidebar-border">
            {!collapsed && (
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
            )}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        {!collapsed && profile && (
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">
            {profile.full_name || profile.email}
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        {!collapsed && (
          <div className="px-3 py-2">
            <a href="/privacy" className="text-[10px] text-primary/60 hover:text-primary">Privacy Policy</a>
            <p className="text-[10px] text-muted-foreground/60 leading-tight mt-1">
              © 2026 MARZ Technologies (Pty) Ltd.<br />All rights reserved.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
