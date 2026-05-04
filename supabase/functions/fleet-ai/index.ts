import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

// Anthropic-format tool definitions (input_schema not parameters)
const tools = [
  {
    name: "update_vehicle_odometer",
    description: "Update a vehicle's current odometer reading in km.",
    input_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string" },
        current_odometer_km: { type: "number" },
      },
      required: ["registration_number", "current_odometer_km"],
    },
  },
  {
    name: "update_vehicle_service",
    description: "Update a vehicle's last service KM and next service due KM.",
    input_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string" },
        last_service_km: { type: "number" },
        next_service_due_km: { type: "number" },
      },
      required: ["registration_number", "last_service_km", "next_service_due_km"],
    },
  },
  {
    name: "add_certificate",
    description: "Add a new certificate for a vehicle.",
    input_schema: {
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
  {
    name: "renew_certificate",
    description: "Update an existing certificate's expiry date (renewal).",
    input_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string" },
        certificate_type: { type: "string" },
        new_expiry_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["registration_number", "certificate_type", "new_expiry_date"],
    },
  },
  {
    name: "mark_damage_repaired",
    description: "Mark a damage item as repaired.",
    input_schema: {
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
  {
    name: "update_driver_licence_expiry",
    description: "Update a driver's licence expiry date.",
    input_schema: {
      type: "object",
      properties: {
        driver_name: { type: "string" },
        licence_expiry: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["driver_name", "licence_expiry"],
    },
  },
  {
    name: "update_driver_prdp_expiry",
    description: "Update a driver's PrDP expiry date.",
    input_schema: {
      type: "object",
      properties: {
        driver_name: { type: "string" },
        prdp_expiry: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["driver_name", "prdp_expiry"],
    },
  },
  {
    name: "update_vehicle_status",
    description: "Mark a vehicle as available, out_for_repair, on_route, off_road, or standby.",
    input_schema: {
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
  {
    name: "get_certificate_link",
    description: "Get a secure 1-hour download link for a vehicle's certificate file. Returns markdown link.",
    input_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string" },
        certificate_type: { type: "string" },
      },
      required: ["registration_number", "certificate_type"],
    },
  },
  {
    name: "get_driver_document_link",
    description: "Get a secure 1-hour download link for a driver's document file. Returns markdown link.",
    input_schema: {
      type: "object",
      properties: {
        driver_name: { type: "string" },
        document_type: { type: "string" },
      },
      required: ["driver_name", "document_type"],
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
        .select("id").ilike("registration_number", args.registration_number).maybeSingle();
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
        .select("id, organisation_id").ilike("registration_number", args.registration_number).maybeSingle();
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
    case "get_certificate_link": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id").ilike("registration_number", args.registration_number).maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found` });
      const { data: cert } = await supabase.from("certificates")
        .select("file_url, certificate_type, expiry_date")
        .eq("vehicle_id", vehicle.id)
        .ilike("certificate_type", `%${args.certificate_type}%`)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!cert) return JSON.stringify({ error: `No ${args.certificate_type} certificate found for ${args.registration_number}` });
      if (!cert.file_url) return JSON.stringify({ error: `${args.certificate_type} for ${args.registration_number} has no file uploaded` });
      const { data: signed, error: signErr } = await supabase.storage.from("documents").createSignedUrl(cert.file_url, 3600);
      if (signErr || !signed?.signedUrl) return JSON.stringify({ error: `Failed to generate download link: ${signErr?.message || "unknown error"}` });
      return JSON.stringify({ success: true, message: `Here is the secure 1-hour download link for the **${cert.certificate_type}** of **${args.registration_number}** (expires ${cert.expiry_date || "n/a"}): [Download certificate](${signed.signedUrl})` });
    }
    case "get_driver_document_link": {
      const { data: driver } = await supabase.from("drivers")
        .select("id, full_name").ilike("full_name", `%${args.driver_name}%`).limit(1).maybeSingle();
      if (!driver) return JSON.stringify({ error: `Driver '${args.driver_name}' not found` });
      const { data: doc } = await supabase.from("driver_documents")
        .select("file_url, document_type, document_name, expiry_date")
        .eq("driver_id", driver.id)
        .ilike("document_type", `%${args.document_type}%`)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!doc) return JSON.stringify({ error: `No ${args.document_type} document found for ${driver.full_name}` });
      if (!doc.file_url) return JSON.stringify({ error: `${args.document_type} for ${driver.full_name} has no file uploaded` });
      const { data: signed, error: signErr } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 3600);
      if (signErr || !signed?.signedUrl) return JSON.stringify({ error: `Failed to generate download link: ${signErr?.message || "unknown error"}` });
      return JSON.stringify({ success: true, message: `Here is the secure 1-hour download link for **${driver.full_name}**'s **${doc.document_type}** (expires ${doc.expiry_date || "n/a"}): [Download document](${signed.signedUrl})` });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

async function buildFleetSnapshot(supabase: any, orgId: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const [vehicles, certs, drivers, fines, statuses, damages, trackers, driverDocs] = await Promise.all([
    supabase.from("vehicles").select("id, registration_number, fleet_number, make, model, year, vehicle_type, current_odometer_km, last_service_km, next_service_due_km, compliance_status, compliance_score, km_last_updated_at").eq("organisation_id", orgId).limit(200),
    // Join vehicle registration directly so AI never has to guess
    supabase.from("certificates").select("certificate_type, certificate_number, expiry_date, status, vehicle_id, vehicles(registration_number, fleet_number)").eq("organisation_id", orgId).limit(300),
    supabase.from("drivers").select("id, full_name, licence_expiry, prdp_expiry, licence_code, demerit_points, employment_status, phone, branch_id").eq("organisation_id", orgId).limit(200),
    supabase.from("fines").select("fine_number, amount, payment_status, offence_date, offence_description, vehicle_id, vehicles(registration_number)").eq("organisation_id", orgId).order("offence_date", { ascending: false }).limit(50),
    supabase.from("vehicle_status").select("vehicle_id, status, workshop_name, estimated_return_date, vehicles(registration_number)").eq("organisation_id", orgId).limit(200),
    // Damage items with vehicle registration AND driver name
    supabase.from("damage_items").select("id, vehicle_id, location, damage_type, severity, description, resolved, repair_cost, repair_date, reported_by_driver_id, reported_by_name, requires_immediate_action, vehicles(registration_number, fleet_number)").eq("organisation_id", orgId).limit(200),
    // Service trackers
    supabase.from("vehicle_service_trackers").select("tracker_name, tracking_type, last_done_date, last_done_value, next_due_date, next_due_value, vehicle_id, vehicles(registration_number)").eq("organisation_id", orgId).limit(200),
    // Driver documents for compliance
    supabase.from("driver_documents").select("driver_id, document_type, expiry_date, status").limit(300),
  ]);

  // Build driver damage summary with correct registrations
  const damageData = (damages.data || []).map((d: any) => ({
    registration: d.vehicles?.registration_number || "Unknown",
    fleet: d.vehicles?.fleet_number || "",
    location: d.location,
    type: d.damage_type,
    severity: d.severity,
    description: d.description,
    resolved: d.resolved,
    repair_cost: d.repair_cost,
    reported_by: d.reported_by_name,
    reported_by_driver_id: d.reported_by_driver_id,
    urgent: d.requires_immediate_action,
  }));

  // Build per-driver damage summary
  const driverDamageSummary = (drivers.data || []).map((d: any) => {
    const driverDamages = damageData.filter((dm: any) => dm.reported_by_driver_id === d.id);
    const totalCost = driverDamages.reduce((s: number, dm: any) => s + (Number(dm.repair_cost) || 0), 0);
    return {
      driver: d.full_name,
      damages_caused: driverDamages.length,
      total_repair_cost: totalCost,
      vehicles_damaged: [...new Set(driverDamages.map((dm: any) => dm.registration))],
      damage_details: driverDamages,
    };
  }).filter((d: any) => d.damages_caused > 0);

  return `# Fleet Snapshot (today ${today})
Vehicles (${vehicles.data?.length || 0}): ${JSON.stringify(vehicles.data || [])}
Certificates with vehicle registrations (${certs.data?.length || 0}): ${JSON.stringify(certs.data || [])}
Drivers (${drivers.data?.length || 0}): ${JSON.stringify(drivers.data || [])}
Driver Documents: ${JSON.stringify(driverDocs.data || [])}
Recent Fines (${fines.data?.length || 0}): ${JSON.stringify(fines.data || [])}
Vehicle Statuses: ${JSON.stringify(statuses.data || [])}
Damage Items with EXACT vehicle registrations (${damages.data?.length || 0}): ${JSON.stringify(damageData)}
Driver Damage Summary (who caused what): ${JSON.stringify(driverDamageSummary)}
Service Trackers: ${JSON.stringify(trackers.data || [])}

IMPORTANT: Always use the exact registration_number from the data above. Never guess or modify registrations.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY") || Deno.env.get("MARZ KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY secret is not configured in Supabase Edge Function secrets" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse body safely
    let body: any = {};
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message: string | undefined = body.message;
    const organisationId: string | undefined = body.organisationId;
    const conversationHistory: Array<{ role: string; content: string }> = body.conversationHistory || [];
    const mode: string = body.mode || "chat";

    if (!organisationId) {
      return new Response(JSON.stringify({ error: "organisationId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isInsights = mode === "insights";
    const userMessage = message || (isInsights
      ? "Give me 3 quick insights about what needs attention in my fleet right now. Be concise and specific."
      : "");

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const snapshot = await buildFleetSnapshot(supabase, organisationId);

    const systemPrompt = `You are MARZ Fleet AI, a warm, sharp South African fleet compliance assistant. Today is ${new Date().toISOString().split("T")[0]}.
Refer to local context: AARTO, JMPD, COF, PrDP, ZAR currency.
Be concise and direct. Use markdown for lists. Cite registration numbers and exact dates from the snapshot.

${snapshot}`;

    // Build Anthropic messages from conversation history + current user message
    const anthropicMessages: Array<{ role: "user" | "assistant"; content: any }> = [];
    for (const m of conversationHistory) {
      if (m.role === "user" || m.role === "assistant") {
        anthropicMessages.push({ role: m.role, content: m.content });
      }
    }
    anthropicMessages.push({ role: "user", content: userMessage });

    // First call
    let assistantMessages = anthropicMessages.slice();
    let finalText = "";

    for (let iter = 0; iter < 3; iter++) {
      const aiResp = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1500,
          system: systemPrompt,
          tools: isInsights ? undefined : tools,
          messages: assistantMessages,
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("Anthropic error:", aiResp.status, errText);
        return new Response(JSON.stringify({ error: `AI provider error: ${aiResp.status}`, detail: errText }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiResp.json();
      const content: any[] = data.content || [];
      const textBlocks = content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const toolUses = content.filter((b) => b.type === "tool_use");

      if (toolUses.length === 0 || isInsights) {
        finalText = textBlocks || finalText;
        break;
      }

      // Append assistant turn (with tool_use blocks) and tool_result turns
      assistantMessages.push({ role: "assistant", content });
      const toolResults = [];
      for (const tu of toolUses) {
        const result = await executeTool(supabase, tu.name, tu.input);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      }
      assistantMessages.push({ role: "user", content: toolResults });
      finalText = textBlocks || finalText;
    }

    return new Response(JSON.stringify({ message: finalText || "No response generated." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fleet-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
