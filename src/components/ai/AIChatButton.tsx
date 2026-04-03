import { useState } from "react";
import { Sparkles, X, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFleetChat } from "@/hooks/useFleetAI";
import ReactMarkdown from "react-markdown";

export function AIChatButton() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, loading, send, clear } = useFleetChat();

  const handleSend = () => {
    if (!input.trim()) return;
    send(input);
    setInput("");
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
              <span className="font-semibold text-foreground">FleetPulse AI</span>
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
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-8">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-primary opacity-50" />
                <p>Ask me anything about your fleet.</p>
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
                    <div className="prose prose-sm prose-invert max-w-none">
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
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask your fleet anything..."
                className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button onClick={handleSend} className="bg-primary text-primary-foreground p-2 rounded-md hover:opacity-90">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
