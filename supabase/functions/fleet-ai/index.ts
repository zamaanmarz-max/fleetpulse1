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
      description: "Update a vehicle's current odometer reading in km.",
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
          registration_number: { type: "string" },
          certificate_type: { type: "string" },
          certificate_number: { type: "string" },
          expiry_date: { type: "string", description: "YYYY-MM-DD" },
          issue_date: { type: "string" },
          issuing_authority: { type: "string" },
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
          registration_number: { type: "string" },
          certificate_type: { type: "string" },
          new_expiry_date: { type: "string", description: "YYYY-MM-DD" },
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
          registration_number: { type: "string" },
          damage_location: { type: "string" },
          repair_cost: { type: "number" },
          repaired_by: { type: "string" },
          repair_date: { type: "string" },
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
          driver_name: { type: "string" },
          licence_expiry: { type: "string", description: "YYYY-MM-DD" },
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
          driver_name: { type: "string" },
          prdp_expiry: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["driver_name", "prdp_expiry"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_vehicle_status",
      description: "Mark a vehicle as available, out_for_repair, on_route, off_road, or standby.",
      parameters: {
        type: "object",
        properties: {
          registration_number: { type: "string" },
          status: { type: "string", enum: ["available", "out_for_repair", "on_route", "off_road", "standby"] },
          workshop_name: { type: "string" },
          repair_description: { type: "string" },
          estimated_return_date: { type: "string" },
        },
        required: ["registration_number", "status"],
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
      const { error } = await supabase.from("vehicles").update({
        current_odometer_km: args.current_odometer_km,
      }).eq("id", vehicle.id);
      if (error) return JSON.stringify({ error: error.message });
      const kmUntil = (vehicle.next_service_due_km ?? 0) - args.current_odometer_km;
      return JSON.stringify({ success: true, message: `Odometer updated to ${args.current_odometer_km.toLocaleString()} km. KM until service: ${kmUntil.toLocaleString()} km.` });
    }
    case "update_vehicle_service": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id, current_odometer_km")
        .ilike("registration_number", args.registration_number)
        .maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const { error } = await supabase.from("vehicles").update({
        last_service_km: args.last_service_km,
        next_service_due_km: args.next_service_due_km,
      }).eq("id", vehicle.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `Service updated. Last: ${args.last_service_km.toLocaleString()} km, Next: ${args.next_service_due_km.toLocaleString()} km.` });
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
        vehicle_id: vehicle.id, organisation_id: vehicle.organisation_id,
        certificate_type: args.certificate_type, certificate_number: args.certificate_number || null,
        expiry_date: args.expiry_date, issue_date: args.issue_date || null,
        issuing_authority: args.issuing_authority || null, status, days_until_expiry: days,
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `${args.certificate_type} added for ${args.registration_number}, expiring ${args.expiry_date}.` });
    }
    case "renew_certificate": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id").ilike("registration_number", args.registration_number).maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const { data: cert } = await supabase.from("certificates")
        .select("id").eq("vehicle_id", vehicle.id).ilike("certificate_type", args.certificate_type)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!cert) return JSON.stringify({ error: `No ${args.certificate_type} found for ${args.registration_number}` });
      const days = Math.ceil((new Date(args.new_expiry_date).getTime() - Date.now()) / 86400000);
      const status = days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid";
      const { error } = await supabase.from("certificates").update({ expiry_date: args.new_expiry_date, status, days_until_expiry: days }).eq("id", cert.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `${args.certificate_type} renewed. New expiry: ${args.new_expiry_date}.` });
    }
    case "mark_damage_repaired": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id").ilike("registration_number", args.registration_number).maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const { data: items } = await supabase.from("damage_items")
        .select("id, location").eq("vehicle_id", vehicle.id).eq("resolved", false)
        .ilike("location", `%${args.damage_location}%`);
      if (!items || items.length === 0) return JSON.stringify({ error: `No unresolved damage at '${args.damage_location}' found` });
      const { error } = await supabase.from("damage_items").update({
        resolved: true, resolved_at: new Date().toISOString(),
        repair_cost: args.repair_cost || 0, repaired_by: args.repaired_by || null,
        repair_date: args.repair_date || new Date().toISOString().split("T")[0],
      }).eq("id", items[0].id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `Damage at '${items[0].location}' on ${args.registration_number} marked as repaired.` });
    }
    case "update_driver_licence_expiry": {
      const { data: driver } = await supabase.from("drivers")
        .select("id, full_name").ilike("full_name", `%${args.driver_name}%`).limit(1).maybeSingle();
      if (!driver) return JSON.stringify({ error: `Driver '${args.driver_name}' not found` });
      const { error } = await supabase.from("drivers").update({ licence_expiry: args.licence_expiry }).eq("id", driver.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `${driver.full_name}'s licence expiry updated to ${args.licence_expiry}.` });
    }
    case "update_driver_prdp_expiry": {
      const { data: driver } = await supabase.from("drivers")
        .select("id, full_name").ilike("full_name", `%${args.driver_name}%`).limit(1).maybeSingle();
      if (!driver) return JSON.stringify({ error: `Driver '${args.driver_name}' not found` });
      const { error } = await supabase.from("drivers").update({ prdp_expiry: args.prdp_expiry }).eq("id", driver.id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `${driver.full_name}'s PrDP expiry updated to ${args.prdp_expiry}.` });
    }
    case "update_vehicle_status": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id, organisation_id").ilike("registration_number", args.registration_number).maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const statusData: any = {
        vehicle_id: vehicle.id, organisation_id: vehicle.organisation_id, status: args.status,
        updated_at: new Date().toISOString(),
      };
      if (args.workshop_name) statusData.workshop_name = args.workshop_name;
      if (args.repair_description) statusData.repair_description = args.repair_description;
      if (args.estimated_return_date) statusData.estimated_return_date = args.estimated_return_date;
      if (args.status === "out_for_repair") statusData.date_sent_for_repair = new Date().toISOString().split("T")[0];
      if (args.status === "available") statusData.actual_return_date = new Date().toISOString().split("T")[0];
      // Upsert by checking if exists
      const { data: existing } = await supabase.from("vehicle_status")
        .select("id").eq("vehicle_id", vehicle.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      let error;
      if (existing) {
        ({ error } = await supabase.from("vehicle_status").update(statusData).eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("vehicle_status").insert(statusData));
      }
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: `${args.registration_number} status updated to ${args.status}.` });
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, mode } = await req.json();

    const { data: profile } = await supabase.from("users").select("organisation_id, full_name").eq("id", user.id).maybeSingle();
    if (!profile?.organisation_id) {
      return new Response(JSON.stringify({ error: "No organisation linked to your account." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch ALL org data
    const [vehiclesRes, certsRes, driversRes, finesRes, inspectionsRes, damageRes, statusRes, driverDocsRes, toolboxRes, branchesRes] = await Promise.all([
      supabase.from("vehicles").select("*"),
      supabase.from("certificates").select("*, vehicles(registration_number)").order("expiry_date"),
      supabase.from("drivers").select("*"),
      supabase.from("fines").select("*, vehicles(registration_number), drivers(full_name)").order("offence_date", { ascending: false }),
      supabase.from("damage_inspections").select("*, vehicles(registration_number)").order("inspection_date", { ascending: false }).limit(50),
      supabase.from("damage_items").select("*, vehicles(registration_number)").eq("resolved", false),
      supabase.from("vehicle_status").select("*, vehicles(registration_number)").order("updated_at", { ascending: false }),
      supabase.from("driver_documents").select("*, drivers(full_name)").order("expiry_date"),
      supabase.from("toolbox_talks").select("*, drivers(full_name)").order("date_conducted", { ascending: false }),
      supabase.from("branches").select("*"),
    ]);

    const fleetData = JSON.stringify({
      vehicles: vehiclesRes.data || [],
      certificates: certsRes.data || [],
      drivers: driversRes.data || [],
      fines: finesRes.data || [],
      recent_inspections: inspectionsRes.data || [],
      unresolved_damage: damageRes.data || [],
      vehicle_statuses: statusRes.data || [],
      driver_documents: driverDocsRes.data || [],
      toolbox_talks: toolboxRes.data || [],
      branches: branchesRes.data || [],
      today: new Date().toISOString().split("T")[0],
    });

    const saPersonality = `YOUR PERSONALITY — This is critical, follow it exactly:
- You are a warm, direct, professional South African fleet manager's assistant
- Use natural SA speech: "hey", "so", "look", "right", "shame", "eish"
- Understand SA context deeply: AARTO, JMPD, RTMC, roadblocks, COF, PrDP, C-NATIS, SABS, NRCS
- Never be robotic or overly formal — talk like a helpful colleague who genuinely cares
- Always end with an offer to help more, like "Need me to check anything else?"
- Give SPECIFIC data — exact dates, exact KM readings, exact ZAR amounts
- Never give vague or generic answers when data exists

CRITICAL RULES:
- When asked about ONE specific vehicle/driver/branch, ONLY report on that ONE thing. Don't dump info about the whole fleet.
- When asked about a specific topic (e.g. "expiring certificates"), ONLY show that data.
- Calculate days until expiry from today's date (${new Date().toISOString().split("T")[0]})
- All currency is in South African Rand (ZAR), display as "R X,XXX"
- Driver compliance requires ALL of: valid licence, valid PrDP, valid medical certificate, valid criminal background check, and toolbox talk within 30 days
- Vehicle compliance requires: service not overdue (km_until_service >= 0), all required certificates valid, equipment-specific certificates present`;

    let systemPrompt: string;
    if (mode === "insights") {
      systemPrompt = `You are MARZ Fleet AI, the fleet compliance assistant for a South African fleet company. Today is ${new Date().toISOString().split("T")[0]}.

${saPersonality}

Your job: Analyse the fleet data below and give exactly 3 bullet point insights about the MOST URGENT stuff that needs attention. Be specific — mention reg numbers, driver names, exact dates, exact KMs.

Prioritise: expired/overdue items first, then items expiring within 7 days, then 30 days.
Keep each bullet to 1-2 sentences max. Be punchy and actionable.
If no issues found, say something like "Looking good! Your fleet is running clean."

Fleet data:
${fleetData}`;
    } else {
      systemPrompt = `You are MARZ Fleet AI, a warm and sharp fleet compliance assistant for South African businesses. Today is ${new Date().toISOString().split("T")[0]}. The logged-in user is ${profile.full_name || user.email}.

${saPersonality}

You have COMPLETE access to this organisation's fleet data (and ONLY this organisation):
${fleetData}

DATA UPDATE CAPABILITIES:
You can update fleet data when users ask. You have tools to:
- Update vehicle odometer readings
- Update service records
- Add or renew certificates
- Mark damage items as repaired
- Update driver licence/PrDP expiry dates
- Update vehicle availability status (available, out for repair, etc.)

CRITICAL RULES FOR UPDATES:
1. ALWAYS ask for confirmation before executing any update
2. Format: "I'm about to update [detail]. Shall I go ahead?"
3. Only execute AFTER the user confirms with yes/ja/sure/okay
4. After success, confirm with ✅
5. If info is missing, ask before proceeding
6. NEVER update without explicit confirmation`;
    }

    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    if (mode === "insights") {
      aiMessages.push({ role: "user", content: "Give me 3 quick insights about what needs attention in my fleet right now." });
    }

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

    if (mode === "chat") {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
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
                const i = tc.index ?? 0;
                if (!currentToolCalls[i]) currentToolCalls[i] = { id: tc.id || "", function: { name: "", arguments: "" } };
                if (tc.id) currentToolCalls[i].id = tc.id;
                if (tc.function?.name) currentToolCalls[i].function.name += tc.function.name;
                if (tc.function?.arguments) currentToolCalls[i].function.arguments += tc.function.arguments;
              }
            }
          } catch { /* ignore */ }
        }
      }

      const toolCalls = Object.values(currentToolCalls).filter(tc => tc.function.name);

      if (toolCalls.length > 0) {
        const toolResults: any[] = [];
        for (const tc of toolCalls) {
          try {
            const args = JSON.parse(tc.function.arguments);
            const result = await executeTool(supabase, tc.function.name, args);
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
          } catch (e) {
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Failed to execute tool" }) });
          }
        }

        const followUpMessages = [
          ...aiMessages,
          {
            role: "assistant", content: fullContent || null,
            tool_calls: toolCalls.map(tc => ({ id: tc.id, type: "function", function: tc.function })),
          },
          ...toolResults,
        ];

        const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: followUpMessages, stream: true }),
        });

        if (!followUpResponse.ok) {
          const resultMsg = toolResults.map(r => {
            try { return JSON.parse(r.content).message || r.content; } catch { return r.content; }
          }).join("\n");
          const sseBody = `data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n\ndata: [DONE]\n\n`;
          return new Response(sseBody, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        }

        return new Response(followUpResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      const sseBody = `data: ${JSON.stringify({ choices: [{ delta: { content: fullContent } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sseBody, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("fleet-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
