import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const FLEET_AI_URL = "https://cgqmyqveqnvrmytmpbfh.supabase.co/functions/v1/fleet-ai";

type Msg = { role: "user" | "assistant"; content: string };

async function getOrgIdFromProfile(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const { data } = await supabase
    .from("users")
    .select("organisation_id")
    .eq("id", session.user.id)
    .maybeSingle();
  return data?.organisation_id ?? null;
}

async function callFleetAI(params: {
  message?: string;
  organisationId: string;
  conversationHistory: Msg[];
  mode?: "chat" | "insights";
}): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "Please log in to use the AI assistant.";

  const requestBody = {
    message: params.message,
    organisationId: params.organisationId,
    conversationHistory: params.conversationHistory || [],
    mode: params.mode || "chat",
  };

  console.log("[FleetAI] POST", FLEET_AI_URL);
  console.log("[FleetAI] Body:", requestBody);

  try {
    const response = await fetch(FLEET_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[FleetAI] Status:", response.status);
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
  const { profile } = useAuth();
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setInsights("");
    try {
      const orgId = profile?.organisation_id ?? (await getOrgIdFromProfile());
      if (!orgId) {
        setInsights("Session error - please refresh and try again");
        return;
      }
      const reply = await callFleetAI({
        message:
          "Give me exactly 3 urgent compliance insights for this fleet today. Use specific vehicle registration numbers and exact dates. Format each as a bullet point starting with an emoji.",
        organisationId: orgId,
        conversationHistory: [],
        mode: "insights",
      });
      setInsights(reply);
    } finally {
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

    try {
      const orgId = profile?.organisation_id ?? (await getOrgIdFromProfile());
      if (!orgId) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Session error - please refresh and try again" }]);
        return;
      }
      const reply = await callFleetAI({
        message: input,
        organisationId: orgId,
        conversationHistory: previous,
        mode: "chat",
      });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => setMessages([]);

  return { messages, loading, send, clear };
}
