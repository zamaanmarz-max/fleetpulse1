import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { AIChatButton } from "../ai/AIChatButton";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout() {
  const { profile } = useAuth();

  // Technicians only get the stripped-down tech screen, never the office app
  if ((profile as any)?.role === "technician") {
    return <Navigate to="/tech" replace />;
  }

  const handleOpenAI = () => {
    window.dispatchEvent(new CustomEvent("marz:open-ai-chat"));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content: left margin only on desktop, bottom padding on mobile for the nav bar */}
      <main className="md:ml-60 min-h-screen pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <MobileNav onOpenAI={handleOpenAI} />

      {/* Floating AI Chat button — lifted above mobile nav */}
      <AIChatButton />
    </div>
  );
}
