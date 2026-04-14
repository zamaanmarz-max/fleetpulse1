import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fleet-ai`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Msg = { role: "user" | "assistant"; content: string };

async function streamChat({
  message,
  organisationId,
  conversationHistory,
  mode,
  onDelta,
  onDone,
}: {
  message?: string;
  organisationId: string;
  conversationHistory: Msg[];
  mode: "chat" | "insights";
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      message: message || undefined,
      organisationId,
      conversationHistory,
      mode,
    }),
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
  const { profile } = useAuth();
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    const orgId = profile?.organisation_id;
    if (!orgId) return;
    setLoading(true);
    setInsights("");
    let result = "";
    try {
      await streamChat({
        organisationId: orgId,
        conversationHistory: [],
        mode: "insights",
        onDelta: (chunk) => { result += chunk; setInsights(result); },
        onDone: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
      setInsights("Unable to load AI insights. Please try again.");
      setLoading(false);
    }
  }, [profile?.organisation_id]);

  return { insights, loading, fetchInsights };
}

export function useFleetChat() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  const send = async (input: string) => {
    const orgId = profile?.organisation_id;
    if (!orgId || !input.trim()) return;
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
        message: input,
        organisationId: orgId,
        conversationHistory: messages, // previous messages (before this one)
        mode: "chat",
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
