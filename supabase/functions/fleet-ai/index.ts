import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tools = [
  {
    type: "function",
    function: {
      name: "update_vehicle_odometer",
      description: "Update a vehicle's current odometer reading in km. Also recalculates km_until_service.",
      parameters: {
        type: "object",
        properties: {
          registration_number: { type: "string", description: "Vehicle registration number" },
          current_odometer_km: { type: "number", description: "New odometer reading in km" },
        },
        required: ["registration_number", "current_odometer_km"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_vehicle_service",
      description: "Update a vehicle's last service KM and next service due KM.",
      parameters: {
        type: "object",
        properties: {
          registration_number: { type: "string", description: "Vehicle registration number" },
          last_service_km: { type: "number", description: "KM at which last service was done" },
          next_service_due_km: { type: "number", description: "KM at which next service is due" },
        },
        required: ["registration_number", "last_service_km", "next_service_due_km"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_certificate",
      description: "Add a new certificate for a vehicle.",
      parameters: {
        type: "object",
        properties: {
          registration_number: { type: "string", description: "Vehicle registration number" },
          certificate_type: { type: "string", description: "Type of certificate e.g. COF, Operating Licence, Cross Border Permit" },
          certificate_number: { type: "string", description: "Certificate number" },
          expiry_date: { type: "string", description: "Expiry date in YYYY-MM-DD format" },
          issue_date: { type: "string", description: "Issue date in YYYY-MM-DD format (optional)" },
          issuing_authority: { type: "string", description: "Authority that issued the certificate (optional)" },
        },
        required: ["registration_number", "certificate_type", "expiry_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "renew_certificate",
      description: "Update an existing certificate's expiry date (renewal).",
      parameters: {
        type: "object",
        properties: {
          registration_number: { type: "string", description: "Vehicle registration number" },
          certificate_type: { type: "string", description: "Type of certificate to renew" },
          new_expiry_date: { type: "string", description: "New expiry date in YYYY-MM-DD format" },
        },
        required: ["registration_number", "certificate_type", "new_expiry_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_damage_repaired",
      description: "Mark a damage item as repaired.",
      parameters: {
        type: "object",
        properties: {
          registration_number: { type: "string", description: "Vehicle registration number" },
          damage_location: { type: "string", description: "Location of the damage on the vehicle e.g. bumper, door, windscreen" },
          repair_cost: { type: "number", description: "Cost of repair in ZAR (optional)" },
          repaired_by: { type: "string", description: "Who repaired it (optional)" },
          repair_date: { type: "string", description: "Date of repair in YYYY-MM-DD (optional, defaults to today)" },
        },
        required: ["registration_number", "damage_location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_driver_licence_expiry",
      description: "Update a driver's licence expiry date.",
      parameters: {
        type: "object",
        properties: {
          driver_name: { type: "string", description: "Driver's full name" },
          licence_expiry: { type: "string", description: "New licence expiry date in YYYY-MM-DD format" },
        },
        required: ["driver_name", "licence_expiry"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_driver_prdp_expiry",
      description: "Update a driver's PrDP expiry date.",
      parameters: {
        type: "object",
        properties: {
          driver_name: { type: "string", description: "Driver's full name" },
          prdp_expiry: { type: "string", description: "New PrDP expiry date in YYYY-MM-DD format" },
        },
        required: ["driver_name", "prdp_expiry"],
      },
    },
  },
];

async function executeTool(supabase: any, toolName: string, args: any): Promise<string> {
  switch (toolName) {
    case "update_vehicle_odometer": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id, next_service_due_km")
        .ilike("registration_number", args.registration_number)
        .maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const kmUntil = (vehicle.next_service_due_km ?? 0) - args.current_odometer_km;
      const { error } = await supabase.from("vehicles").update({
        current_odometer_km: args.current_odometer_km,
        km_until_service: kmUntil,
      }).eq("id", vehicle.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `Odometer updated to ${args.current_odometer_km.toLocaleString()} km. KM until service: ${kmUntil.toLocaleString()} km.` });
    }
    case "update_vehicle_service": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id, current_odometer_km")
        .ilike("registration_number", args.registration_number)
        .maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const kmUntil = args.next_service_due_km - (vehicle.current_odometer_km ?? 0);
      const { error } = await supabase.from("vehicles").update({
        last_service_km: args.last_service_km,
        next_service_due_km: args.next_service_due_km,
        km_until_service: kmUntil,
      }).eq("id", vehicle.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `Service updated. Last: ${args.last_service_km.toLocaleString()} km, Next: ${args.next_service_due_km.toLocaleString()} km. KM until service: ${kmUntil.toLocaleString()} km.` });
    }
    case "add_certificate": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id, organisation_id")
        .ilike("registration_number", args.registration_number)
        .maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const days = Math.ceil((new Date(args.expiry_date).getTime() - Date.now()) / 86400000);
      const status = days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid";
      const { error } = await supabase.from("certificates").insert({
        vehicle_id: vehicle.id,
        organisation_id: vehicle.organisation_id,
        certificate_type: args.certificate_type,
        certificate_number: args.certificate_number || null,
        expiry_date: args.expiry_date,
        issue_date: args.issue_date || null,
        issuing_authority: args.issuing_authority || null,
        status,
        days_until_expiry: days,
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `${args.certificate_type} certificate added for ${args.registration_number}, expiring ${args.expiry_date}.` });
    }
    case "renew_certificate": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id")
        .ilike("registration_number", args.registration_number)
        .maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const { data: cert } = await supabase.from("certificates")
        .select("id")
        .eq("vehicle_id", vehicle.id)
        .ilike("certificate_type", args.certificate_type)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cert) return JSON.stringify({ error: `No ${args.certificate_type} certificate found for ${args.registration_number}` });
      const days = Math.ceil((new Date(args.new_expiry_date).getTime() - Date.now()) / 86400000);
      const status = days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid";
      const { error } = await supabase.from("certificates").update({
        expiry_date: args.new_expiry_date,
        status,
        days_until_expiry: days,
      }).eq("id", cert.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `${args.certificate_type} renewed for ${args.registration_number}. New expiry: ${args.new_expiry_date}.` });
    }
    case "mark_damage_repaired": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id")
        .ilike("registration_number", args.registration_number)
        .maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const { data: items } = await supabase.from("damage_items")
        .select("id, location, damage_type, description")
        .eq("vehicle_id", vehicle.id)
        .eq("resolved", false)
        .ilike("location", `%${args.damage_location}%`);
      if (!items || items.length === 0) return JSON.stringify({ error: `No unresolved damage at '${args.damage_location}' found for ${args.registration_number}` });
      const item = items[0];
      const { error } = await supabase.from("damage_items").update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        repair_cost: args.repair_cost || 0,
        repaired_by: args.repaired_by || null,
        repair_date: args.repair_date || new Date().toISOString().split("T")[0],
      }).eq("id", item.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `Damage at '${item.location}' on ${args.registration_number} marked as repaired.` });
    }
    case "update_driver_licence_expiry": {
      const { data: driver } = await supabase.from("drivers")
        .select("id, full_name")
        .ilike("full_name", `%${args.driver_name}%`)
        .limit(1)
        .maybeSingle();
      if (!driver) return JSON.stringify({ error: `Driver '${args.driver_name}' not found` });
      const { error } = await supabase.from("drivers").update({
        licence_expiry: args.licence_expiry,
      }).eq("id", driver.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `${driver.full_name}'s licence expiry updated to ${args.licence_expiry}.` });
    }
    case "update_driver_prdp_expiry": {
      const { data: driver } = await supabase.from("drivers")
        .select("id, full_name")
        .ilike("full_name", `%${args.driver_name}%`)
        .limit(1)
        .maybeSingle();
      if (!driver) return JSON.stringify({ error: `Driver '${args.driver_name}' not found` });
      const { error } = await supabase.from("drivers").update({
        prdp_expiry: args.prdp_expiry,
      }).eq("id", driver.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `${driver.full_name}'s PrDP expiry updated to ${args.prdp_expiry}.` });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

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

    const { data: profile } = await supabase.from("users").select("organisation_id").eq("id", user.id).maybeSingle();
    if (!profile?.organisation_id) {
      return new Response(JSON.stringify({ error: "No organisation linked to your account." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [vehiclesRes, certsRes, driversRes, finesRes, inspectionsRes, damageRes] = await Promise.all([
      supabase.from("vehicles").select("*"),
      supabase.from("certificates").select("*, vehicles(registration_number)").order("expiry_date"),
      supabase.from("drivers").select("*"),
      supabase.from("fines").select("*, vehicles(registration_number), drivers(full_name)").order("offence_date", { ascending: false }),
      supabase.from("damage_inspections").select("*, vehicles(registration_number)").order("inspection_date", { ascending: false }).limit(20),
      supabase.from("damage_items").select("*, vehicles(registration_number)").eq("resolved", false),
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
      systemPrompt = `You are FleetPulse AI, a friendly and sharp fleet compliance assistant for a South African fleet company. Today is ${new Date().toISOString().split("T")[0]}.

Your job: Analyse the fleet data below and give exactly 3 bullet point insights about the MOST URGENT stuff that needs attention. Be specific and human:

Rules:
- Talk like a helpful colleague, not a robot. Use "you" and "your fleet"
- Be SPECIFIC: mention vehicle registration numbers, certificate types, exact expiry dates, exact KM readings
- Calculate days until expiry from today's date
- Flag expired certificates, overdue services, high-risk vehicles, unpaid fines, unresolved critical damage
- Prioritise: expired/overdue items first, then items expiring within 7 days, then 30 days
- Keep each bullet to 1-2 sentences max. Be punchy and actionable.
- If no issues found, say something like "Looking good! Your fleet is compliant."
- End with a brief helpful sign-off

Fleet data:
${fleetData}`;
    } else {
      systemPrompt = `You are FleetPulse AI, a warm, professional fleet compliance assistant for South African businesses. Today is ${new Date().toISOString().split("T")[0]}.

You have COMPLETE access to this organisation's fleet data:
${fleetData}

YOUR PERSONALITY:
- Speak in a warm, friendly, human tone — like a helpful colleague
- Address the user as "you" — never say "the user"
- Proactively flag issues without being asked
- Understand broken English, Afrikaans, mixed language queries

IMPORTANT INSTRUCTIONS:
- When asked about a specific vehicle, provide ALL details
- Always be SPECIFIC: use exact dates, KM readings, amounts in ZAR
- Never give generic answers. If data exists, quote it.
- Understand SA context: AARTO, C-NATIS, PrDP categories, COF validity
- Calculate days until expiry from today's date
- When providing certificate file links, use the file_url field from certificate data

DATA UPDATE CAPABILITIES:
You can update fleet data when users ask. You have tools to:
- Update vehicle odometer readings
- Update service records (last service km, next service due km)
- Add new certificates
- Renew existing certificates
- Mark damage items as repaired
- Update driver licence expiry dates
- Update driver PrDP expiry dates

CRITICAL RULES FOR UPDATES:
1. ALWAYS ask for confirmation before executing any update. Show exactly what you're about to change.
2. Format confirmation like: "I'm about to update [detail]. Shall I go ahead? (Yes/No)"
3. Only execute the tool call AFTER the user confirms with yes, ja, sure, okay, or similar affirmative
4. After successful update, confirm with a ✅ emoji
5. If you need more information, ask for it before proceeding
6. NEVER update without explicit user confirmation`;
    }

    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    if (mode === "insights") {
      aiMessages.push({ role: "user", content: "Give me 3 quick insights about what needs attention in my fleet right now." });
    }

    // For chat mode, include tools for data updates
    const requestBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: aiMessages,
      stream: true,
    };

    if (mode === "chat") {
      requestBody.tools = tools;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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

    // For streaming with tool calls, we need to collect the full response to check for tool calls
    // Then execute them and send a follow-up
    if (mode === "chat") {
      // Read the full streamed response to check for tool calls
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let toolCalls: any[] = [];
      let currentToolCalls: Record<number, { id: string; function: { name: string; arguments: string } }> = {};

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
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) fullContent += delta.content;
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!currentToolCalls[idx]) {
                  currentToolCalls[idx] = { id: tc.id || "", function: { name: "", arguments: "" } };
                }
                if (tc.id) currentToolCalls[idx].id = tc.id;
                if (tc.function?.name) currentToolCalls[idx].function.name += tc.function.name;
                if (tc.function?.arguments) currentToolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          } catch { /* ignore partial */ }
        }
      }

      toolCalls = Object.values(currentToolCalls).filter(tc => tc.function.name);

      if (toolCalls.length > 0) {
        // Execute tool calls
        const toolResults: any[] = [];
        for (const tc of toolCalls) {
          try {
            const args = JSON.parse(tc.function.arguments);
            const result = await executeTool(supabase, tc.function.name, args);
            toolResults.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            });
          } catch (e) {
            toolResults.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: "Failed to execute tool" }),
            });
          }
        }

        // Send follow-up with tool results
        const followUpMessages = [
          ...aiMessages,
          {
            role: "assistant",
            content: fullContent || null,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: "function",
              function: tc.function,
            })),
          },
          ...toolResults,
        ];

        const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: followUpMessages,
            stream: true,
          }),
        });

        if (!followUpResponse.ok) {
          const t = await followUpResponse.text();
          console.error("Follow-up AI error:", followUpResponse.status, t);
          // Return tool result as plain text
          const resultMsg = toolResults.map(r => {
            try { return JSON.parse(r.content).message || r.content; } catch { return r.content; }
          }).join("\n");
          const sseBody = `data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n\ndata: [DONE]\n\n`;
          return new Response(sseBody, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }

        return new Response(followUpResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // No tool calls — stream the collected content as SSE
      const lines = fullContent.split("");
      // Reconstruct as a single SSE event
      const sseBody = `data: ${JSON.stringify({ choices: [{ delta: { content: fullContent } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sseBody, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // For insights mode, just pass through the stream
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
