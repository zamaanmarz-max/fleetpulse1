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
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
    const { data: profile } = await supabase.from("users").select("organisation_id").eq("id", user.id).maybeSingle();
    if (!profile?.organisation_id) {
      return new Response(JSON.stringify({ error: "No organisation linked to your account. Please complete registration first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch comprehensive fleet data
    const [vehiclesRes, certsRes, driversRes, finesRes, inspectionsRes, damageRes] = await Promise.all([
      supabase.from("vehicles").select("registration_number, fleet_number, make, model, year, vin_number, colour, vehicle_type, compliance_status, km_until_service, current_odometer_km, next_service_due_km, last_service_km, risk_score, is_active"),
      supabase.from("certificates").select("certificate_type, certificate_number, expiry_date, status, issue_date, issuing_authority, vehicles(registration_number)").order("expiry_date"),
      supabase.from("drivers").select("full_name, licence_code, licence_expiry, prdp_expiry, prdp_category, demerit_points, employment_status, phone, email"),
      supabase.from("fines").select("fine_number, offence_date, offence_description, amount, payment_status, demerit_points_applied, issuing_authority, vehicles(registration_number), drivers(full_name)").order("offence_date", { ascending: false }),
      supabase.from("damage_inspections").select("inspection_date, overall_condition, total_damage_items, new_damage_items, has_critical_damage, status, vehicles(registration_number)").order("inspection_date", { ascending: false }).limit(20),
      supabase.from("damage_items").select("location, damage_type, severity, description, resolved, requires_immediate_action, vehicles(registration_number)").eq("resolved", false),
    ]);

    const fleetData = JSON.stringify({
      vehicles: vehiclesRes.data || [],
      certificates: certsRes.data || [],
      drivers: driversRes.data || [],
      fines: finesRes.data || [],
      recent_inspections: inspectionsRes.data || [],
      unresolved_damage: damageRes.data || [],
      today: new Date().toISOString().split("T")[0],
    });

    let systemPrompt: string;
    if (mode === "insights") {
      systemPrompt = `You are FleetPulse AI for a South African fleet management company. Today's date is ${new Date().toISOString().split("T")[0]}.

Analyse the fleet data below and provide exactly 3 bullet point insights about the MOST URGENT compliance risks. Rules:
- Be SPECIFIC: mention vehicle registration numbers, certificate types, exact expiry dates, exact KM readings
- Calculate days until expiry from today's date
- Flag any expired certificates, overdue services, high-risk vehicles, unpaid fines, unresolved critical damage
- Prioritise: expired/overdue items first, then items expiring within 7 days, then 30 days
- Keep each bullet to 1-2 sentences max
- Format as bullet points only, no headers
- If no issues found, say the fleet is compliant and suggest proactive checks

Fleet data:
${fleetData}`;
    } else {
      systemPrompt = `You are FleetPulse AI, an expert fleet compliance assistant for South African businesses. Today's date is ${new Date().toISOString().split("T")[0]}.

You have COMPLETE access to this organisation's fleet data:
${fleetData}

IMPORTANT INSTRUCTIONS:
- When asked about a specific vehicle (by registration number), provide ALL details: certificates with exact expiry dates, current KM and service status, any open fines with amounts, last inspection result and condition, any unresolved damage items
- Always be SPECIFIC: use exact dates, KM readings, amounts in ZAR, certificate names, registration numbers
- Never give generic answers. If data exists, quote it. If data is missing, say so clearly.
- Understand SA context: AARTO demerit system, C-NATIS, PrDP categories (D/G/P), COF validity, operator permits
- Calculate days until expiry or overdue from today's date
- Flag urgent items clearly with severity
- Use bullet points for lists, keep responses concise and actionable
- For compliance queries, reference the specific certificate types and their statuses`;
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    if (mode === "insights") {
      aiMessages.push({ role: "user", content: "Analyse the fleet data and provide 3 bullet point insights about the most urgent compliance risks." });
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
