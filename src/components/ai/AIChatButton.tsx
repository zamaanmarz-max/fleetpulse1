import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFleetChat } from "@/hooks/useFleetAI";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

const QUICK_ACTIONS = [
  "Today's Briefing",
  "Expiring Certificates",
  "Non-Compliant Drivers",
  "Maintenance Costs",
  "Fleet Status",
];

const DAILY_PROMPT = "Give me the 3 most urgent compliance issues for this fleet today. Be specific with vehicle registrations and dates.";

export function AIChatButton() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, loading, send, clear } = useFleetChat();
  const queryClient = useQueryClient();
  const hasSentDaily = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Daily auto-prompt on first open each day
  useEffect(() => {
    if (!open || hasSentDaily.current || messages.length > 0) return;
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem("marz_daily_prompt_date");
    if (lastDate !== today) {
      hasSentDaily.current = true;
      localStorage.setItem("marz_daily_prompt_date", today);
      send(DAILY_PROMPT);
    }
  }, [open]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim()) return;
    send(input).then(() => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle_statuses"] });
      queryClient.invalidateQueries({ queryKey: ["toolbox_talks"] });
    });
    setInput("");
  };

  const handleQuickAction = (topic: string) => {
    send(topic).then(() => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg transition-transform hover:scale-110 glow-green",
          open && "hidden"
        )}
      >
        <Sparkles className="w-6 h-6 text-primary-foreground" />
      </button>

      {open && (
        <div className="fixed right-0 top-0 z-50 h-screen w-96 bg-card border-l border-border flex flex-col animate-slide-in-right shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">MARZ Fleet AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clear} className="p-2 text-muted-foreground hover:text-foreground rounded-md">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setOpen(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.length === 0 && !loading && (
              <div className="text-center text-muted-foreground text-sm mt-8">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-primary opacity-50" />
                <p>Hey! Ask me anything about your fleet.</p>
                <p className="mt-1 text-xs">I understand AARTO, COF, PrDP, and SA compliance.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn("text-sm", msg.role === "user" ? "text-right" : "text-left")}>
                <div
                  className={cn(
                    "inline-block px-3 py-2 rounded-lg max-w-[85%]",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-1 px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:0.4s]" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Action Buttons */}
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => handleQuickAction(action)}
                disabled={loading}
                className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                {action}
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
                placeholder="Ask your fleet anything..."
                className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={loading}
              />
              <button onClick={handleSend} disabled={loading} className="bg-primary text-primary-foreground p-2 rounded-md hover:opacity-90 disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
