import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fleet-ai`;

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
  // Get current session token (required by edge function auth)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("You are not signed in. Please log in again.");
  }

  const payload = {
    message: message || undefined,
    organisationId,
    conversationHistory,
    mode,
  };

  // Debug logs so we can see exactly what's being sent
  console.log("[FleetAI] POST", CHAT_URL);
  console.log("[FleetAI] Authorization: Bearer <session.access_token>");
  console.log("[FleetAI] Body:", payload);

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  console.log("[FleetAI] Response status:", resp.status);

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    let errMsg = "Request failed";
    try {
      const parsed = JSON.parse(text);
      errMsg = parsed.error || parsed.message || errMsg;
    } catch {
      errMsg = text || errMsg;
    }
    console.error("[FleetAI] Error response:", resp.status, errMsg);
    throw new Error(errMsg);
  }

  const contentType = resp.headers.get("content-type") || "";

  // Non-streaming JSON fallback (e.g. { message: "..." })
  if (!contentType.includes("text/event-stream")) {
    const data = await resp.json().catch(() => null);
    console.log("[FleetAI] JSON response:", data);
    const text = data?.message || data?.content || "";
    if (text) onDelta(text);
    onDone();
    return;
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

async function getOrgIdFromProfile(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const { data: userProfile, error } = await supabase
    .from("users")
    .select("organisation_id")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) {
    console.error("[FleetAI] Failed to load user profile:", error);
    return null;
  }
  return userProfile?.organisation_id ?? null;
}

export function useFleetInsights() {
  const { profile } = useAuth();
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setInsights("");
    let result = "";
    try {
      const orgId = profile?.organisation_id ?? (await getOrgIdFromProfile());
      if (!orgId) throw new Error("No organisation linked to your account.");
      await streamChat({
        organisationId: orgId,
        conversationHistory: [],
        mode: "insights",
        onDelta: (chunk) => { result += chunk; setInsights(result); },
        onDone: () => setLoading(false),
      });
    } catch (e: any) {
      console.error("[FleetAI] Insights error:", e);
      setInsights(`Unable to load AI insights: ${e?.message || "please try again."}`);
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
    if (!input.trim()) return;
    const userMsg: Msg = { role: "user", content: input };
    const previous = messages;
    setMessages([...previous, userMsg]);
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
      const orgId = profile?.organisation_id ?? (await getOrgIdFromProfile());
      if (!orgId) throw new Error("No organisation linked to your account.");

      await streamChat({
        message: input,
        organisationId: orgId,
        conversationHistory: previous,
        mode: "chat",
        onDelta: upsert,
        onDone: () => setLoading(false),
      });
    } catch (e: any) {
      console.error("[FleetAI] Chat error:", e);
      const friendly = e?.message?.includes("sign")
        ? e.message
        : "Sorry, I couldn't reach the fleet AI right now. Please try again in a moment.";
      setMessages((prev) => [...prev, { role: "assistant", content: friendly }]);
      setLoading(false);
    }
  };

  const clear = () => setMessages([]);

  return { messages, loading, send, clear };
}
