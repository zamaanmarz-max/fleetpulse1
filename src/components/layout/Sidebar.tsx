import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import {
  LayoutDashboard, Truck, Users, FileCheck, Shield,
  BarChart3, Settings, ChevronLeft, ChevronRight,
  Receipt, Bell, UserCog, LogOut, Upload, Warehouse, Wrench, HeartPulse
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/dashboard",         icon: LayoutDashboard, label: "Dashboard" },
  { to: "/vehicles",          icon: Truck,           label: "Vehicles" },
  { to: "/drivers",           icon: Users,           label: "Drivers" },
  { to: "/maintenance",       icon: Wrench,          label: "Maintenance" },
  { to: "/hs-file",           icon: HeartPulse,      label: "H&S File" },
  { to: "/compliance",        icon: Shield,          label: "Compliance" },
  { to: "/certificates",      icon: FileCheck,       label: "Certificates" },
  { to: "/fines",             icon: Receipt,         label: "Fines & AARTO" },
  { to: "/reports",           icon: BarChart3,       label: "Reports" },
  { to: "/alerts",            icon: Bell,            label: "Alerts" },
  { to: "/fleet-availability",icon: Warehouse,       label: "Availability" },
  { to: "/import",            icon: Upload,          label: "Import" },
  { to: "/settings",          icon: Settings,        label: "Settings" },
];

const adminItems = [
  { to: "/admin", icon: UserCog, label: "Admin Panel" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "superadmin";

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
