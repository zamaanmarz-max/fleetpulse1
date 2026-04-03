import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, mode } = await req.json();

    // Fetch org data for context
    const { data: profile } = await supabase.from("users").select("organisation_id").eq("id", user.id).single();
    if (!profile?.organisation_id) throw new Error("No organisation found");

    const [vehiclesRes, certsRes, driversRes] = await Promise.all([
      supabase.from("vehicles").select("registration_number, fleet_number, make, model, compliance_status, km_until_service, risk_score").eq("is_active", true),
      supabase.from("certificates").select("certificate_type, expiry_date, status, vehicles(registration_number)").order("expiry_date"),
      supabase.from("drivers").select("full_name, licence_expiry, prdp_expiry, demerit_points, employment_status"),
    ]);

    const fleetData = JSON.stringify({
      vehicles: vehiclesRes.data || [],
      certificates: certsRes.data || [],
      drivers: driversRes.data || [],
    });

    let systemPrompt: string;
    if (mode === "insights") {
      systemPrompt = `You are FleetPulse AI for a South African fleet company. Analyse this fleet data and give exactly 3 bullet point insights about the most urgent compliance risks. Be specific - mention registration numbers and certificate types. Keep each bullet to one sentence. Format: bullet points only, no headers.\n\nFleet data:\n${fleetData}`;
    } else {
      systemPrompt = `You are FleetPulse AI, a fleet compliance assistant for South African businesses. You have access to the following fleet data:\n${fleetData}\n\nAnswer questions about this fleet accurately and concisely. Flag urgent compliance issues clearly. Keep responses brief and actionable. Use bullet points for lists. Understand South African context: AARTO, C-NATIS, PrDP, COF, operator permits, etc. If you cannot find the answer in the data provided, say so clearly.`;
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    if (mode === "insights") {
      aiMessages.push({ role: "user", content: "Analyse the fleet data and provide 3 bullet point insights." });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("fleet-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
