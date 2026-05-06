import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Truck, Users, Bell, Menu,
  FileCheck, Receipt, BarChart3, Settings, Shield,
  Sparkles, Warehouse, Upload, UserCog, LogOut, X, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";

const primary = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/vehicles", icon: Truck, label: "Vehicles" },
  { to: "/drivers", icon: Users, label: "Drivers" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
];

type MoreItem = { to?: string; icon: any; label: string; action?: "ai" | "signout" };

export function MobileNav({ onOpenAI }: { onOpenAI?: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "superadmin";

  const moreItems: MoreItem[] = [
    { to: "/maintenance", icon: Wrench, label: "Maintenance" },
    { to: "/compliance", icon: Shield, label: "Compliance" },
    { to: "/certificates", icon: FileCheck, label: "Certificates" },
    { to: "/fines", icon: Receipt, label: "Fines & AARTO" },
    { to: "/reports", icon: BarChart3, label: "Reports" },
    { to: "/fleet-availability", icon: Warehouse, label: "Availability" },
    { to: "/import", icon: Upload, label: "Import" },
    { to: "/settings", icon: Settings, label: "Settings" },
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
