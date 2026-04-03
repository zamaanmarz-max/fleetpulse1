import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fleet-ai`;

type Msg = { role: "user" | "assistant"; content: string };

async function streamChat({
  messages,
  mode,
  token,
  onDelta,
  onDone,
}: {
  messages: Msg[];
  mode: "chat" | "insights";
  token: string;
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages, mode }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Stream failed" }));
    throw new Error(err.error || "Stream failed");
  }

  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* partial json, ignore */ }
    }
  }
  onDone();
}

export function useFleetInsights() {
  const { session } = useAuth();
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setInsights("");
    let result = "";
    try {
      await streamChat({
        messages: [],
        mode: "insights",
        token: session.access_token,
        onDelta: (chunk) => { result += chunk; setInsights(result); },
        onDone: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
      setInsights("Unable to load AI insights. Please try again.");
      setLoading(false);
    }
  }, [session?.access_token]);

  return { insights, loading, fetchInsights };
}

export function useFleetChat() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  const send = async (input: string) => {
    if (!session?.access_token || !input.trim()) return;
    const userMsg: Msg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    let assistantText = "";
    const upsert = (chunk: string) => {
      assistantText += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantText } : m));
        }
        return [...prev, { role: "assistant", content: assistantText }];
      });
    };

    try {
      await streamChat({
        messages: newMessages,
        mode: "chat",
        token: session.access_token,
        onDelta: upsert,
        onDone: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
      setLoading(false);
    }
  };

  const clear = () => setMessages([]);

  return { messages, loading, send, clear };
}
