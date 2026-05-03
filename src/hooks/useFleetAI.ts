import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const FLEET_AI_URL = "https://cgqmyqveqnvrmytmpbfh.supabase.co/functions/v1/fleet-ai";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Canonical fleet-ai caller.
 * ALWAYS resolves organisationId fresh from public.users using the live auth session.
 * Never hardcoded, never null.
 */
async function callFleetAI(
  userMessage: string,
  history: Msg[] = [],
  mode: "chat" | "insights" = "chat"
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "Please log in again.";

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("organisation_id")
    .eq("id", session.user.id)
    .single();

  if (profileError || !profile?.organisation_id) {
    console.error("[FleetAI] Missing organisation_id for user", session.user.id, profileError);
    return "Your account is not linked to a fleet organisation yet. Please contact your administrator or log in with your main account.";
  }

  const requestBody = {
    message: userMessage,
    organisationId: profile.organisation_id,
    conversationHistory: history,
    mode,
  };

  console.log("[FleetAI] POST", FLEET_AI_URL, { mode, orgId: profile.organisation_id });

  try {
    const response = await fetch(FLEET_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const text = await response.text();
    if (!text) return "Hey, I got an empty response. Try again!";

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[FleetAI] Non-JSON response:", text);
      return "Hey, I got a malformed response. Try again!";
    }

    if (!response.ok) {
      console.error("[FleetAI] Error response:", data);
      return data?.error || "Hey, the fleet AI hit an error. Try again in a moment!";
    }

    return data.message || "Hey, something went wrong. Try again!";
  } catch (error) {
    console.error("[FleetAI] Network error:", error);
    return "Hey, I had a small hiccup. Try again in a moment!";
  }
}

export function useFleetInsights() {
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setInsights("");
    try {
      const reply = await callFleetAI(
        "Give me exactly 3 urgent compliance insights for this fleet today. Use specific vehicle registration numbers and exact dates. Format each as a bullet point starting with an emoji.",
        [],
        "insights"
      );
      setInsights(reply);
    } finally {
      setLoading(false);
    }
  }, []);

  return { insights, loading, fetchInsights };
}

export function useFleetChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  const send = async (input: string) => {
    if (!input.trim()) return;
    const userMsg: Msg = { role: "user", content: input };
    const previous = messages;
    setMessages([...previous, userMsg]);
    setLoading(true);

    try {
      const reply = await callFleetAI(input, previous, "chat");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => setMessages([]);

  return { messages, loading, send, clear };
}
