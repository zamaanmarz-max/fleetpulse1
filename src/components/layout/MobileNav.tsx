import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Truck, Users, Bell, Menu,
  FileCheck, Receipt, BarChart3, Settings, Shield,
  Sparkles, Warehouse, Upload, UserCog, LogOut, X, Wrench, HeartPulse, Radio, Thermometer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { getModuleTerms } from "@/lib/moduleTerms";

type MoreItem = { to?: string; icon: any; label: string; action?: "ai" | "signout"; modules?: string[] };

const ALL_MORE_ITEMS: MoreItem[] = [
  { to: "/control-tower",      icon: Radio,       label: "Control Tower",  modules: ["fleet_only","fleet_hs"] },
  { to: "/fridge-tracker",     icon: Thermometer, label: "Fridge Tracker", modules: ["fleet_only","fleet_hs","fridge_only"] },
  { to: "/maintenance",        icon: Wrench,      label: "Maintenance",    modules: ["fleet_only","fleet_hs"] },
  { to: "/hs-file",            icon: HeartPulse,  label: "H&S File",       modules: ["hs_only","fleet_hs"] },
  { to: "/compliance",         icon: Shield,      label: "Compliance",     modules: ["hs_only","fleet_hs"] },
  { to: "/certificates",       icon: FileCheck,   label: "Certificates",   modules: ["fleet_only","fleet_hs"] },
  { to: "/fines",              icon: Receipt,     label: "Fines & AARTO",  modules: ["fleet_only","fleet_hs"] },
  { to: "/reports",            icon: BarChart3,   label: "Reports",        modules: ["fleet_only","fleet_hs","hs_only"] },
  { to: "/fleet-availability", icon: Warehouse,   label: "Availability",   modules: ["fleet_only","fleet_hs"] },
  { to: "/import",             icon: Upload,      label: "Import",         modules: ["fleet_only","fleet_hs"] },
  { to: "/settings",           icon: Settings,    label: "Settings",       modules: ["all"] },
];

const ALL_PRIMARY: MoreItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard",  modules: ["all"] },
  { to: "/vehicles",  icon: Truck,           label: "Vehicles",   modules: ["fleet_only","fleet_hs","fridge_only"] },
  { to: "/drivers",   icon: Users,           label: "Drivers",    modules: ["fleet_only","fleet_hs"] },
  { to: "/alerts",    icon: Bell,            label: "Alerts",     modules: ["fleet_only","fleet_hs","hs_only"] },
];

export function MobileNav({ onOpenAI }: { onOpenAI?: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "superadmin";
  const moduleType = (profile as any)?.organisations?.module_type || "fleet_hs";
  const terms = getModuleTerms((profile as any)?.organisations?.industry);
  const relabel = (i: MoreItem): MoreItem => (i.to === "/fridge-tracker" && !terms.isRefrigeration) ? { ...i, label: terms.trackerLabel, icon: Wrench } : i;

  const primary = ALL_PRIMARY.filter(i => i.modules?.includes("all") || i.modules?.includes(moduleType));
  const moreItems: MoreItem[] = [
    ...ALL_MORE_ITEMS.filter(i => i.modules?.includes("all") || i.modules?.includes(moduleType)).map(relabel),
    ...(isAdmin ? [{ to: "/admin", icon: UserCog, label: "Admin Panel" }] : []),
    { icon: Sparkles, label: "AI Chat", action: "ai" as const },
    { icon: LogOut, label: "Sign Out", action: "signout" as const },
  ];

  const handleMoreClick = async (item: MoreItem) => {
    setMoreOpen(false);
    if (item.action === "ai") {
      // Defer slightly so the sheet can close before opening the AI panel
      setTimeout(() => onOpenAI?.(), 200);
    } else if (item.action === "signout") {
      await signOut();
      navigate("/login");
    } else if (item.to) {
      navigate(item.to);
    }
  };

  const linkCls = (isActive: boolean) =>
    cn(
      "flex flex-col items-center justify-center gap-1 flex-1 h-full text-[10px] font-medium transition-colors",
      isActive ? "text-primary" : "text-muted-foreground"
    );

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-sidebar border-t border-sidebar-border flex items-stretch pb-[env(safe-area-inset-bottom)]"
        aria-label="Mobile navigation"
      >
        {primary.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => linkCls(isActive)}>
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button className={linkCls(moreOpen)} aria-label="Open more menu">
              <Menu className="w-5 h-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="h-[80vh] rounded-t-2xl p-0 flex flex-col bg-sidebar border-sidebar-border"
          >
            <SheetHeader className="p-4 border-b border-sidebar-border text-left">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-foreground">Menu</SheetTitle>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {profile && (
                <p className="text-xs text-muted-foreground truncate">
                  {profile.full_name || profile.email}
                </p>
              )}
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-3">
              {moreItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleMoreClick(item)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  <item.icon
                    className={cn(
                      "w-6 h-6",
                      item.action === "signout" ? "text-destructive" : "text-primary"
                    )}
                  />
                  <span className="text-xs font-medium text-foreground text-center leading-tight">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-sidebar-border text-center">
              <a href="/privacy" className="text-[10px] text-primary/60 hover:text-primary">
                Privacy Policy
              </a>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                © 2026 MARZ Technologies (Pty) Ltd.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}
