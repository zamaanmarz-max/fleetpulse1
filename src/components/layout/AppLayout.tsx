import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { AIChatButton } from "../ai/AIChatButton";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-60 min-h-screen">
        <Outlet />
      </main>
      <AIChatButton />
    </div>
  );
}
