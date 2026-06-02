import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─────────────────────────────────────────────────────────
// MARZ FleetPulse — WhatsApp Agentic AI
// ─────────────────────────────────────────────────────────

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-sonnet-latest";
const MAX_HISTORY = 20; // messages to keep per conversation

// ── Tool definitions ──────────────────────────────────────
const TOOLS = [
  // 1. LOG DAMAGE (guided — AI validates before committing)
  {
    name: "log_damage",
    description: `Log a vehicle damage report. ALL fields are required — do NOT call this tool until you have confirmed:
    registration_number, reported_by, reporter_role, description, odometer_km.
    If ANY field is missing, ask the user for it BEFORE calling this tool.
    The reporter_role must be one of: driver, checker, controller, other.`,
    input_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string", description: "Vehicle registration number" },
        reported_by: { type: "string", description: "Full name of person reporting" },
        reporter_role: { type: "string", enum: ["driver", "checker", "controller", "other"] },
        description: { type: "string", description: "Detailed description of the damage" },
        odometer_km: { type: "number", description: "Odometer reading at time of damage" },
        location: { type: "string", description: "Where damage occurred (optional)" },
        driver_name: { type: "string", description: "Name of driver at time (optional)" },
        fleet_marshall_jc_ref: { type: "string", description: "Fleet Marshall job card number if already raised (optional)" },
      },
      required: ["registration_number", "reported_by", "reporter_role", "description", "odometer_km"],
    },
  },

  // 2. LOG BREAKDOWN
  {
    name: "log_breakdown",
    description: "Log a vehicle breakdown. Required: registration_number, location, breakdown_type. Ask for these if missing.",
    input_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string" },
        location: { type: "string", description: "Where the breakdown occurred" },
        breakdown_type: { type: "string", enum: ["Tyre", "Mechanical", "Accident", "Electrical", "Body Damage", "Refrigeration", "Other"] },
        driver_name: { type: "string", description: "Driver name (optional)" },
        description: { type: "string", description: "What happened (optional)" },
        national_team_notified: { type: "boolean", description: "Has national breakdown team been called?" },
        workshop: { type: "string", description: "Workshop if already known (optional)" },
      },
      required: ["registration_number", "location", "breakdown_type"],
    },
  },

  // 3. GET VEHICLE STATUS (full picture)
  {
    name: "get_vehicle_status",
    description: "Get full status of a vehicle: compliance, open damages, job cards, breakdowns, certificates.",
    input_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string" },
      },
      required: ["registration_number"],
    },
  },

  // 4. GET OFF-ROAD VEHICLES
  {
    name: "get_offroad_vehicles",
    description: "List all vehicles currently off-road, under repair, or broken down.",
    input_schema: {
      type: "object",
      properties: {
        include_resolved: { type: "boolean", description: "Include recently resolved breakdowns?" },
      },
    },
  },

  // 5. APPROVE JOB CARD
  {
    name: "approve_job_card",
    description: "Approve a job card and set the workshop. Ask for the job card number and workshop if not provided.",
    input_schema: {
      type: "object",
      properties: {
        job_card_number: { type: "string", description: "e.g. JC-00001" },
        workshop: { type: "string", enum: ["AC&R", "JJ", "ICE COLD BODIES", "SERCO BODIES", "DH LIFTS", "SPARTAN WORKSHOP", "Other"] },
        approved_by: { type: "string", description: "Name of person approving" },
      },
      required: ["job_card_number", "workshop", "approved_by"],
    },
  },

  // 6. GET VEHICLE PHOTOS
  {
    name: "get_vehicle_photos",
    description: "Get photo URLs for a vehicle. Returns links the user can open.",
    input_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string" },
        photo_type: { type: "string", enum: ["pre-hire", "current", "damage-before", "damage-after", "compliance", "all"], description: "Type of photo to retrieve" },
      },
      required: ["registration_number"],
    },
  },

  // 7. VEHICLE COST ANALYSIS
  {
    name: "vehicle_cost_analysis",
    description: "Get total repair costs, breakdown count, and maintenance trends for a specific vehicle or the whole fleet.",
    input_schema: {
      type: "object",
      properties: {
        registration_number: { type: "string", description: "Specific vehicle (omit for full fleet)" },
        period_days: { type: "number", description: "How many days back to analyse (default 90)" },
      },
    },
  },

  // 8. FLEET TREND REPORT
  {
    name: "fleet_trend_report",
    description: "Analyse fleet-wide trends: most common damage types, most costly trucks, breakdown patterns, workshop turnaround.",
    input_schema: {
      type: "object",
      properties: {
        period_days: { type: "number", description: "Analysis period in days (default 90)" },
      },
    },
  },

  // 9. GET OUTSTANDING ITEMS
  {
    name: "get_outstanding_items",
    description: "Get everything currently outstanding: unapproved job cards, open damages, active breakdowns, overdue compliance registers, expiring certificates.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  // 10. GENERATE PDF REPORT
  {
    name: "generate_fleet_report",
    description: "Generate a fleet summary report and return a link the user can download or share.",
    input_schema: {
      type: "object",
      properties: {
        report_type: {
          type: "string",
          enum: ["full_fleet", "damages", "compliance", "offroad", "costs"],
          description: "Type of report to generate",
        },
        registration_number: { type: "string", description: "For single-vehicle report (optional)" },
      },
      required: ["report_type"],
    },
  },

  // 11. LOG DRIVER CHECK-IN
  {
    name: "log_driver_checkin",
    description: "Log a driver check-in, delivery update, arrival confirmation or breakdown report from WhatsApp. Use when a driver sends any status update — arrived on site, delivered, issue, end of day.",
    input_schema: {
      type: "object",
      properties: {
        driver_id: { type: "string", description: "Driver ID if known" },
        registration_number: { type: "string", description: "Vehicle registration if mentioned" },
        checkin_type: { type: "string", enum: ["morning_checkin", "delivery_update", "breakdown_report", "end_of_day", "other"] },
        message: { type: "string", description: "Full message or summary of what the driver reported" },
        location: { type: "string", description: "Location if mentioned" },
      },
      required: ["message", "checkin_type"],
    },
  },

  // 12. GET TODAY'S BOOKINGS
  {
    name: "get_todays_bookings",
    description: "Get today's driver bookings — who is booked, confirmed, pending, declined. Use when controller asks about today's roster.",
    input_schema: { type: "object", properties: {} },
  },

  // 13. REGISTER DRIVER VIA WHATSAPP
  {
    name: "register_driver_whatsapp",
    description: "Register a driver's WhatsApp number. Use when a driver messages to register or onboard themselves onto the MARZ system.",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        phone_number: { type: "string", description: "Their WhatsApp number" },
      },
      required: ["first_name", "last_name", "phone_number"],
    },
  },
];

// ── Tool executors ────────────────────────────────────────
async function executeTool(supabase: any, toolName: string, args: any, orgId: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  switch (toolName) {

    // ── 1. LOG DAMAGE ─────────────────────────────────────
    case "log_damage": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id, current_odometer_km")
        .ilike("registration_number", args.registration_number)
        .maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found. Check the registration number.` });

      let driver_id: string | null = null;
      if (args.driver_name) {
        const { data: driver } = await supabase.from("drivers")
          .select("id").ilike("full_name", `%${args.driver_name}%`).maybeSingle();
        driver_id = driver?.id || null;
      }

      const { error } = await supabase.from("damages").insert({
        vehicle_id: vehicle.id,
        driver_id,
        reported_by: args.reported_by,
        reporter_role: args.reporter_role,
        description: args.description,
        odometer_km: args.odometer_km,
        location: args.location || null,
        fleet_marshall_jc_ref: args.fleet_marshall_jc_ref || null,
        status: "Reported",
      });

      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({
        success: true,
        message: `✅ Damage logged for ${args.registration_number}. A job card has been automatically created. ${args.fleet_marshall_jc_ref ? `Fleet Marshall JC# ${args.fleet_marshall_jc_ref} cross-referenced.` : ""}`,
      });
    }

    // ── 2. LOG BREAKDOWN ──────────────────────────────────
    case "log_breakdown": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id").ilike("registration_number", args.registration_number).maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found.` });

      let driver_id: string | null = null;
      if (args.driver_name) {
        const { data: driver } = await supabase.from("drivers")
          .select("id").ilike("full_name", `%${args.driver_name}%`).maybeSingle();
        driver_id = driver?.id || null;
      }

      const { error } = await supabase.from("breakdowns").insert({
        vehicle_id: vehicle.id,
        driver_id,
        location: args.location,
        breakdown_type: args.breakdown_type,
        description: args.description || null,
        workshop: args.workshop || null,
        national_team_notified: args.national_team_notified || false,
        resolved: false,
      });

      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({
        success: true,
        message: `🚨 Breakdown logged for ${args.registration_number} at ${args.location}. Vehicle status updated to Breakdown. ${args.national_team_notified ? "National team notified ✓" : "⚠ Remember to notify the national breakdown team."}`,
      });
    }

    // ── 3. GET VEHICLE STATUS ─────────────────────────────
    case "get_vehicle_status": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id, registration_number, make, model, year, current_odometer_km, operational_status, compliance_status, next_service_due_km")
        .ilike("registration_number", args.registration_number)
        .maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found.` });

      const [damages, jobCards, breakdowns, certs] = await Promise.all([
        supabase.from("damages").select("description, status, created_at, reported_by").eq("vehicle_id", vehicle.id).neq("status", "Resolved").limit(5),
        supabase.from("job_cards").select("job_card_number, status, workshop_name, job_type, total_cost").eq("vehicle_id", vehicle.id).neq("status", "completed").limit(5),
        supabase.from("breakdowns").select("breakdown_type, location, reported_at, resolved").eq("vehicle_id", vehicle.id).eq("resolved", false).limit(3),
        supabase.from("certificates").select("certificate_type, expiry_date, status").eq("vehicle_id", vehicle.id).order("expiry_date", { ascending: true }).limit(10),
      ]);

      const kmToService = (vehicle.next_service_due_km || 0) - (vehicle.current_odometer_km || 0);
      return JSON.stringify({
        vehicle: {
          registration: vehicle.registration_number,
          make_model: `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
          odometer: `${(vehicle.current_odometer_km || 0).toLocaleString()} km`,
          km_to_service: kmToService > 0 ? `${kmToService.toLocaleString()} km` : "OVERDUE",
          operational_status: vehicle.operational_status || "Operational",
          compliance_status: vehicle.compliance_status || "compliant",
        },
        open_damages: damages.data?.length || 0,
        damage_details: damages.data || [],
        open_job_cards: jobCards.data || [],
        active_breakdowns: breakdowns.data || [],
        certificates: certs.data || [],
      });
    }

    // ── 4. GET OFF-ROAD VEHICLES ──────────────────────────
    case "get_offroad_vehicles": {
      const { data: vehicles } = await supabase.from("vehicles")
        .select("registration_number, make, model, operational_status")
        .in("operational_status", ["Breakdown", "Under Repair", "Awaiting Workshop", "Awaiting Parts", "Off Road"])
        .eq("is_active", true);

      const { data: breakdowns } = await supabase.from("breakdowns")
        .select("breakdown_type, location, reported_at, vehicles(registration_number)")
        .eq("resolved", false)
        .limit(20);

      const { data: jobCards } = await supabase.from("job_cards")
        .select("job_card_number, status, workshop_name, vehicles(registration_number)")
        .in("status", ["open", "in_progress"])
        .limit(20);

      return JSON.stringify({
        offroad_count: vehicles?.length || 0,
        vehicles: vehicles || [],
        active_breakdowns: breakdowns || [],
        open_job_cards: jobCards || [],
      });
    }

    // ── 5. APPROVE JOB CARD ───────────────────────────────
    case "approve_job_card": {
      const { data: jc } = await supabase.from("job_cards")
        .select("id, vehicle_id, status")
        .ilike("job_card_number", args.job_card_number)
        .maybeSingle();
      if (!jc) return JSON.stringify({ error: `Job card ${args.job_card_number} not found.` });
      if (jc.status === "completed") return JSON.stringify({ error: `Job card ${args.job_card_number} is already completed.` });

      const { error } = await supabase.from("job_cards").update({
        status: "in_progress",
        workshop_name: args.workshop,
        approved_by: args.approved_by,
      }).eq("id", jc.id);

      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({
        success: true,
        message: `✅ Job card ${args.job_card_number} approved by ${args.approved_by}. Workshop: ${args.workshop}. Vehicle status updated to Under Repair.`,
      });
    }

    // ── 6. GET VEHICLE PHOTOS ─────────────────────────────
    case "get_vehicle_photos": {
      const { data: vehicle } = await supabase.from("vehicles")
        .select("id, registration_number").ilike("registration_number", args.registration_number).maybeSingle();
      if (!vehicle) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found.` });

      let q = supabase.from("vehicle_photos").select("photo_url, photo_type, caption, uploaded_at").eq("vehicle_id", vehicle.id);
      if (args.photo_type && args.photo_type !== "all") q = q.eq("photo_type", args.photo_type);
      const { data: photos } = await q.limit(10);

      if (!photos || photos.length === 0) {
        return JSON.stringify({ message: `No photos found for ${args.registration_number}${args.photo_type && args.photo_type !== "all" ? ` (type: ${args.photo_type})` : ""}.` });
      }

      // Generate public URLs
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const photosWithUrls = photos.map((p: any) => ({
        type: p.photo_type,
        caption: p.caption,
        date: p.uploaded_at?.split("T")[0],
        url: `${supabaseUrl}/storage/v1/object/public/certificates/${p.photo_url}`,
      }));

      return JSON.stringify({ registration: vehicle.registration_number, photos: photosWithUrls });
    }

    // ── 7. VEHICLE COST ANALYSIS ──────────────────────────
    case "vehicle_cost_analysis": {
      const periodDays = args.period_days || 90;
      const since = new Date(Date.now() - periodDays * 86400000).toISOString().split("T")[0];

      let vehicleFilter = {};
      let vehicleLabel = "Full Fleet";

      if (args.registration_number) {
        const { data: v } = await supabase.from("vehicles")
          .select("id, registration_number").ilike("registration_number", args.registration_number).maybeSingle();
        if (!v) return JSON.stringify({ error: `Vehicle ${args.registration_number} not found.` });
        vehicleFilter = { vehicle_id: v.id };
        vehicleLabel = v.registration_number;
      }

      const [jobCards, breakdowns] = await Promise.all([
        supabase.from("job_cards")
          .select("vehicle_id, total_cost, job_type, work_date, status, vehicles(registration_number)")
          .gte("work_date", since)
          .not("total_cost", "is", null),
        supabase.from("breakdowns")
          .select("vehicle_id, breakdown_type, reported_at, resolved, vehicles(registration_number)")
          .gte("reported_at", since),
      ]);

      const jcData = jobCards.data || [];
      const bdData = breakdowns.data || [];

      // Aggregate by vehicle
      const costByVehicle: Record<string, { reg: string; total: number; count: number }> = {};
      for (const jc of jcData) {
        const reg = (jc as any).vehicles?.registration_number || "Unknown";
        if (!costByVehicle[reg]) costByVehicle[reg] = { reg, total: 0, count: 0 };
        costByVehicle[reg].total += Number(jc.total_cost) || 0;
        costByVehicle[reg].count++;
      }
      const ranked = Object.values(costByVehicle).sort((a, b) => b.total - a.total);

      const totalCost = ranked.reduce((s, v) => s + v.total, 0);
      const avgCost = ranked.length > 0 ? totalCost / ranked.length : 0;

      // Breakdown types
      const byType: Record<string, number> = {};
      for (const bd of bdData) {
        byType[bd.breakdown_type || "Other"] = (byType[bd.breakdown_type || "Other"] || 0) + 1;
      }

      return JSON.stringify({
        period: `Last ${periodDays} days`,
        scope: vehicleLabel,
        total_repair_cost: `R ${totalCost.toLocaleString()}`,
        total_job_cards: jcData.length,
        average_per_vehicle: `R ${Math.round(avgCost).toLocaleString()}`,
        total_breakdowns: bdData.length,
        breakdown_types: byType,
        top_cost_vehicles: ranked.slice(0, 5).map(v => ({ registration: v.reg, total_cost: `R ${v.total.toLocaleString()}`, job_cards: v.count })),
      });
    }

    // ── 8. FLEET TREND REPORT ─────────────────────────────
    case "fleet_trend_report": {
      const periodDays = args.period_days || 90;
      const since = new Date(Date.now() - periodDays * 86400000).toISOString().split("T")[0];

      const [damages, breakdowns, jobCards, offroad] = await Promise.all([
        supabase.from("damages").select("description, status, reporter_role, created_at, vehicles(registration_number)").gte("created_at", since),
        supabase.from("breakdowns").select("breakdown_type, reported_at, resolved, vehicles(registration_number)").gte("reported_at", since),
        supabase.from("job_cards").select("job_type, workshop_name, total_cost, work_date, status").gte("work_date", since),
        supabase.from("vehicles").select("registration_number, operational_status").neq("operational_status", "Operational").eq("is_active", true),
      ]);

      const dmgData = damages.data || [];
      const bdData  = breakdowns.data || [];
      const jcData  = jobCards.data || [];

      // Most common damage reporters
      const byRole: Record<string, number> = {};
      for (const d of dmgData) { byRole[d.reporter_role || "unknown"] = (byRole[d.reporter_role || "unknown"] || 0) + 1; }

      // Breakdown frequency by type
      const bdByType: Record<string, number> = {};
      for (const b of bdData) { bdByType[b.breakdown_type || "Other"] = (bdByType[b.breakdown_type || "Other"] || 0) + 1; }

      // Workshop usage
      const byWorkshop: Record<string, number> = {};
      for (const j of jcData) { if (j.workshop_name) { byWorkshop[j.workshop_name] = (byWorkshop[j.workshop_name] || 0) + 1; } }

      // Total cost
      const totalCost = jcData.reduce((s: number, j: any) => s + (Number(j.total_cost) || 0), 0);
      const resolvedBd = bdData.filter((b: any) => b.resolved).length;

      return JSON.stringify({
        period: `Last ${periodDays} days`,
        damage_reports: dmgData.length,
        damage_by_reporter_role: byRole,
        breakdowns_total: bdData.length,
        breakdowns_resolved: resolvedBd,
        breakdowns_open: bdData.length - resolvedBd,
        breakdown_types: bdByType,
        job_cards_raised: jcData.length,
        total_repair_spend: `R ${totalCost.toLocaleString()}`,
        workshop_usage: byWorkshop,
        currently_offroad: offroad.data?.length || 0,
        offroad_vehicles: offroad.data?.map((v: any) => `${v.registration_number} (${v.operational_status})`) || [],
      });
    }

    // ── 9. GET OUTSTANDING ITEMS ──────────────────────────
    case "get_outstanding_items": {
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      const [openDamages, openJCs, activeBreakdowns, overdueCerts, overdueCompliance] = await Promise.all([
        supabase.from("damages").select("description, created_at, vehicles(registration_number)").eq("status", "Reported").limit(20),
        supabase.from("job_cards").select("job_card_number, vehicle_id, workshop_name, vehicles(registration_number)").eq("status", "open").limit(20),
        supabase.from("breakdowns").select("breakdown_type, location, vehicles(registration_number)").eq("resolved", false).limit(10),
        supabase.from("certificates").select("certificate_type, expiry_date, vehicles(registration_number)").lte("expiry_date", in30).eq("status", "valid").order("expiry_date", { ascending: true }).limit(15),
        supabase.from("compliance_register_types").select("name, compliance_sites(name), last_completed, frequency").eq("is_active", true).limit(20),
      ]);

      // Flag compliance registers not completed this month
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const overdueRegs = (overdueCompliance.data || []).filter((r: any) => {
        if (!r.last_completed) return true;
        if (r.frequency === "monthly") return !r.last_completed.startsWith(thisMonth);
        return false;
      });

      return JSON.stringify({
        summary: {
          open_damages: openDamages.data?.length || 0,
          unapproved_job_cards: openJCs.data?.length || 0,
          active_breakdowns: activeBreakdowns.data?.length || 0,
          expiring_certificates_30d: overdueCerts.data?.length || 0,
          overdue_compliance_registers: overdueRegs.length,
        },
        open_damages: (openDamages.data || []).map((d: any) => ({ vehicle: (d as any).vehicles?.registration_number, description: d.description, date: d.created_at?.split("T")[0] })),
        unapproved_job_cards: (openJCs.data || []).map((j: any) => ({ jc: j.job_card_number, vehicle: (j as any).vehicles?.registration_number })),
        active_breakdowns: (activeBreakdowns.data || []).map((b: any) => ({ vehicle: (b as any).vehicles?.registration_number, type: b.breakdown_type, location: b.location })),
        expiring_certs: (overdueCerts.data || []).map((c: any) => ({ vehicle: (c as any).vehicles?.registration_number, type: c.certificate_type, expiry: c.expiry_date })),
        overdue_registers: overdueRegs.map((r: any) => ({ name: r.name, site: (r as any).compliance_sites?.name, last_done: r.last_completed || "Never" })),
      });
    }

    // ── 10. GENERATE FLEET REPORT ─────────────────────────
    case "generate_fleet_report": {
      let reportLines: string[] = [];
      const header = `MARZ FleetPulse — ${args.report_type.replace(/_/g, " ").toUpperCase()} REPORT\nGenerated: ${new Date().toLocaleString("en-ZA")}\n${"─".repeat(50)}\n`;

      if (args.report_type === "offroad" || args.report_type === "full_fleet") {
        const { data: vehicles } = await supabase.from("vehicles")
          .select("registration_number, make, model, operational_status, compliance_status")
          .eq("is_active", true).order("registration_number");
        const offroad = (vehicles || []).filter((v: any) => v.operational_status !== "Operational" && v.operational_status !== null);
        const operational = (vehicles || []).filter((v: any) => !v.operational_status || v.operational_status === "Operational");
        reportLines.push(`FLEET SUMMARY\nTotal Active Vehicles: ${vehicles?.length || 0}\nOperational: ${operational.length}\nOff-Road/Issues: ${offroad.length}\n`);
        if (offroad.length > 0) {
          reportLines.push("OFF-ROAD VEHICLES:");
          offroad.forEach((v: any) => reportLines.push(`  - ${v.registration_number} | ${v.make} ${v.model} | Status: ${v.operational_status}`));
        }
      }
      if (args.report_type === "damages" || args.report_type === "full_fleet") {
        const { data: damages } = await supabase.from("damages").select("description, status, reported_by, created_at, vehicles(registration_number)").neq("status", "Resolved").order("created_at", { ascending: false }).limit(30);
        reportLines.push(`\nOPEN DAMAGES (${damages?.length || 0}):`);
        (damages || []).forEach((d: any) => reportLines.push(`  - ${(d as any).vehicles?.registration_number} | ${d.description} | By: ${d.reported_by} | ${d.created_at?.split("T")[0]}`));
      }
      if (args.report_type === "compliance" || args.report_type === "full_fleet") {
        const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
        const { data: certs } = await supabase.from("certificates").select("certificate_type, expiry_date, vehicles(registration_number)").lte("expiry_date", in30).order("expiry_date", { ascending: true }).limit(20);
        reportLines.push(`\nCERTIFICATES EXPIRING IN 30 DAYS (${certs?.length || 0}):`);
        (certs || []).forEach((c: any) => reportLines.push(`  - ${(c as any).vehicles?.registration_number} | ${c.certificate_type} | Expires: ${c.expiry_date}`));
      }
      if (args.report_type === "costs" || args.report_type === "full_fleet") {
        const since = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
        const { data: jcs } = await supabase.from("job_cards").select("total_cost, job_type, vehicles(registration_number)").gte("work_date", since).not("total_cost", "is", null);
        const total = (jcs || []).reduce((s: number, j: any) => s + (Number(j.total_cost) || 0), 0);
        reportLines.push(`\nCOST ANALYSIS (Last 90 Days):\nTotal Spend: R ${total.toLocaleString()}\nJob Cards: ${jcs?.length || 0}`);
      }
      const reportContent = header + reportLines.join("\n");
      const filename = `reports/fleet-report-${args.report_type}-${Date.now()}.txt`;
      const { error: upErr } = await supabase.storage.from("certificates").upload(filename, new Blob([reportContent], { type: "text/plain" }), { contentType: "text/plain" });
      if (upErr) return JSON.stringify({ success: true, report: reportContent.substring(0, 2000) + "\n...(truncated)" });
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      return JSON.stringify({ success: true, message: `✅ Report generated.`, download_url: `${supabaseUrl}/storage/v1/object/public/certificates/${filename}`, report_preview: reportContent.substring(0, 500) + "..." });
    }

    // ── 11. DRIVER CHECK-IN ───────────────────────────────
    case "log_driver_checkin": {
      const { data: vehicle } = args.registration_number
        ? await supabase.from("vehicles").select("id").ilike("registration_number", args.registration_number).maybeSingle()
        : { data: null };
      const { error } = await supabase.from("driver_checkins").insert({
        organisation_id: orgId,
        driver_id: args.driver_id || null,
        vehicle_id: vehicle?.id || null,
        checkin_type: args.checkin_type || "delivery_update",
        message: args.message,
        location: args.location || null,
        source: "whatsapp",
      });
      if (error) return JSON.stringify({ error: error.message });
      if (args.driver_id) {
        await supabase.from("drivers").update({ last_checkin_at: new Date().toISOString(), last_checkin_message: args.message }).eq("id", args.driver_id);
      }
      const typeEmoji: Record<string, string> = { morning_checkin: "🌅", delivery_update: "📦", breakdown_report: "🚨", end_of_day: "🏁", other: "💬" };
      return JSON.stringify({ success: true, message: `${typeEmoji[args.checkin_type] || "💬"} Logged: ${args.message}` });
    }

    // ── 12. GET TODAY'S BOOKINGS ──────────────────────────
    case "get_todays_bookings": {
      const todayDate = new Date().toISOString().split("T")[0];
      const { data: bookings } = await supabase.from("driver_bookings")
        .select("*, drivers(first_name, last_name, phone_number), vehicles(registration_number)")
        .eq("booking_date", todayDate).order("shift_time");
      const confirmed = (bookings || []).filter((b: any) => b.status === "confirmed").length;
      const pending = (bookings || []).filter((b: any) => b.status === "pending").length;
      const declined = (bookings || []).filter((b: any) => b.status === "declined").length;
      return JSON.stringify({
        date: todayDate, total_booked: bookings?.length || 0, confirmed, pending, declined,
        bookings: (bookings || []).map((b: any) => ({
          driver: `${b.drivers?.first_name} ${b.drivers?.last_name}`,
          vehicle: b.vehicles?.registration_number || "TBA",
          shift: b.shift_time, status: b.status, route: b.route || "Not specified",
        })),
      });
    }

    // ── 13. REGISTER DRIVER ───────────────────────────────
    case "register_driver_whatsapp": {
      const { data: driver } = await supabase.from("drivers")
        .select("id, first_name, last_name")
        .or(`first_name.ilike.%${args.first_name}%,last_name.ilike.%${args.last_name}%`)
        .maybeSingle();
      if (!driver) return JSON.stringify({ error: `Driver ${args.first_name} ${args.last_name} not found. Check spelling or contact your manager.` });
      await supabase.from("drivers").update({ whatsapp_number: args.phone_number, is_registered_whatsapp: true }).eq("id", driver.id);
      await supabase.from("driver_whatsapp_registration").upsert({ driver_id: driver.id, phone_number: args.phone_number, welcome_sent: true, is_active: true }, { onConflict: "phone_number" });
      return JSON.stringify({ success: true, driver_id: driver.id, message: `✅ Welcome to MARZ Fleet, ${driver.first_name}! You will receive bookings and updates here on WhatsApp.` });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
// ── Build fleet snapshot for system prompt ────────────────
async function buildSnapshot(supabase: any): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const [vehicles, damages, breakdowns] = await Promise.all([
    supabase.from("vehicles").select("registration_number, make, model, operational_status, compliance_status, current_odometer_km, next_service_due_km").eq("is_active", true).limit(100),
    supabase.from("damages").select("vehicles(registration_number), status, description").eq("status", "Reported").limit(20),
    supabase.from("breakdowns").select("vehicles(registration_number), breakdown_type, location").eq("resolved", false).limit(10),
  ]);

  const offroad = (vehicles.data || []).filter((v: any) => v.operational_status && v.operational_status !== "Operational");

  return `Today: ${today}
Fleet: ${vehicles.data?.length || 0} active vehicles
Currently off-road: ${offroad.length} — ${offroad.map((v: any) => `${v.registration_number}(${v.operational_status})`).join(", ")}
Open damages: ${damages.data?.length || 0}
Active breakdowns: ${breakdowns.data?.length || 0}`;
}

// ── Send WhatsApp message via Twilio ──────────────────────
async function sendWhatsApp(to: string, body: string, mediaUrl?: string) {
  const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+14155238886";

  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.log("Twilio not configured — response:", body);
    return;
  }

  const formData = new URLSearchParams();
  formData.append("To", to.startsWith("whatsapp:") ? to : `whatsapp:${to}`);
  formData.append("From", TWILIO_FROM);
  formData.append("Body", body);
  if (mediaUrl) formData.append("MediaUrl", mediaUrl);

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });
}

// ── Main handler ──────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
    if (!ANTHROPIC_API_KEY) return new Response("ANTHROPIC_API_KEY not set", { status: 500 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse body — Twilio sends form-encoded, dashboard sends JSON
    const contentType = req.headers.get("content-type") || "";
    let fromNumber = "", userMessage = "", mediaUrl = "", orgId = "";
    let isWhatsApp = false;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Twilio WhatsApp webhook
      isWhatsApp = true;
      const text = await req.text();
      const params = new URLSearchParams(text);
      fromNumber = params.get("From") || "";
      userMessage = params.get("Body") || "";
      mediaUrl = params.get("MediaUrl0") || "";

      // Get org from whatsapp number mapping
      const { data: mapping } = await supabase.from("whatsapp_conversations")
        .select("organisation_id").eq("phone_number", fromNumber).limit(1).maybeSingle();
      orgId = mapping?.organisation_id || Deno.env.get("DEFAULT_ORG_ID") || "";
    } else {
      // Dashboard / JSON call
      const body = await req.json();
      userMessage = body.message || "";
      orgId = body.organisationId || "";
      fromNumber = body.fromNumber || "";
    }

    // ── Look up driver by phone number ───────────────────
    let driverProfile: any = null;
    if (fromNumber && isWhatsApp) {
      const cleanPhone = fromNumber.replace("whatsapp:", "").replace("+", "");
      const { data: regDriver } = await supabase.from("driver_whatsapp_registration")
        .select("*, drivers(id, first_name, last_name)")
        .eq("phone_number", fromNumber)
        .maybeSingle();
      driverProfile = regDriver?.drivers || null;

      // Check if this is a booking YES/NO response
      const cleanMsg = userMessage.trim().toUpperCase();
      if (cleanMsg === "YES" || cleanMsg === "NO" || cleanMsg === "YEP" || cleanMsg === "NAH" || cleanMsg === "JA" || cleanMsg === "NEE") {
        const today = new Date().toISOString().split("T")[0];
        const isYes = ["YES", "YEP", "JA"].includes(cleanMsg);
        const { data: booking } = await supabase.from("driver_bookings")
          .select("id, vehicles(registration_number), shift_time")
          .eq("booking_date", today)
          .eq("driver_id", driverProfile?.id || "")
          .eq("status", "pending")
          .maybeSingle();

        if (booking) {
          await supabase.from("driver_bookings").update({
            status: isYes ? "confirmed" : "declined",
            driver_response: userMessage,
            responded_at: new Date().toISOString(),
          }).eq("id", booking.id);
        }
      }

      // Save incoming message to history
      await supabase.from("whatsapp_messages").insert({
        organisation_id: orgId || null,
        phone_number: fromNumber,
        driver_id: driverProfile?.id || null,
        direction: "inbound",
        message_text: userMessage,
        media_url: mediaUrl || null,
        message_type: mediaUrl ? "media" : "text",
        created_at: new Date().toISOString(),
      });
    }

    // ── Load conversation history ─────────────────────────
    let history: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (fromNumber) {
      const { data: stored } = await supabase.from("whatsapp_conversations")
        .select("messages").eq("phone_number", fromNumber).maybeSingle();
      history = stored?.messages || [];
    }

    // If photo was sent, add to user message
    const fullUserMessage = mediaUrl
      ? `${userMessage}\n[Photo attached: ${mediaUrl}]`
      : userMessage;

    // ── Build fleet snapshot ──────────────────────────────
    const snapshot = await buildSnapshot(supabase);

    const driverContext = driverProfile
      ? `\nTHIS MESSAGE IS FROM DRIVER: ${driverProfile.first_name} ${driverProfile.last_name} (ID: ${driverProfile.id})\nWhen they send updates, arrivals, or reports — use log_driver_checkin with their driver_id.`
      : "\nThis message is from an unregistered number. If they want to register, ask for their first name, last name, and use register_driver_whatsapp.";

    const systemPrompt = `You are MARZ Control Tower AI — a South African fleet operations assistant managing drivers, vehicles, compliance and daily operations.

FLEET SNAPSHOT:
${snapshot}
${driverContext}

YOUR CAPABILITIES:
1. Fleet Management: log damages, breakdowns, vehicle status, job cards, compliance
2. Control Tower: log driver check-ins, get today's bookings, register drivers
3. Driver Support: guide drivers through issues, confirm arrivals, log deliveries

DRIVER INTERACTION RULES:
- When a driver says they arrived somewhere, use log_driver_checkin with type "delivery_update"
- When a driver says they're done for the day, use log_driver_checkin with type "end_of_day"
- When a driver reports a breakdown, use BOTH log_breakdown AND log_driver_checkin with type "breakdown_report"
- When a driver says anything about their route or deliveries, log it
- Be friendly and supportive with drivers — they're on the road
- If a driver sends "Register" or wants to sign up, ask for their first and last name then register them

CONTROLLER RULES:
- When asked about today's roster, use get_todays_bookings
- Be concise and direct — controllers are busy
- Always confirm actions before executing

GENERAL RULES:
- No markdown, no bullet points on WhatsApp — plain sentences only
- Use ZAR (R) for currency, DD/MM/YYYY for dates
- If unsure of a registration number, ask
- Every driver update must be logged — nothing gets lost`;

    // ── Agentic loop ──────────────────────────────────────
    const messages: any[] = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: fullUserMessage },
    ];

    let finalReply = "";
    let reportUrl: string | undefined;

    for (let i = 0; i < 5; i++) {
      const aiResp = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1200,
          system: systemPrompt,
          tools: TOOLS,
          messages,
        }),
      });

      if (!aiResp.ok) {
        const err = await aiResp.text();
        console.error("Anthropic error:", err);
        finalReply = "Sorry, I'm having trouble connecting right now. Please try again.";
        break;
      }

      const data = await aiResp.json();
      const content: any[] = data.content || [];
      const textBlocks = content.filter(b => b.type === "text").map(b => b.text).join(" ");
      const toolUses = content.filter(b => b.type === "tool_use");

      if (toolUses.length === 0) {
        finalReply = textBlocks || finalReply;
        break;
      }

      messages.push({ role: "assistant", content });
      const toolResults = [];
      for (const tu of toolUses) {
        const result = await executeTool(supabase, tu.name, tu.input, orgId);
        // Check for report URL
        try {
          const parsed = JSON.parse(result);
          if (parsed.download_url) reportUrl = parsed.download_url;
        } catch {}
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      }
      messages.push({ role: "user", content: toolResults });
      if (textBlocks) finalReply = textBlocks;
    }

    // ── Save conversation history ─────────────────────────
    if (fromNumber) {
      const updatedHistory = [
        ...history,
        { role: "user" as const, content: fullUserMessage },
        { role: "assistant" as const, content: finalReply },
      ].slice(-MAX_HISTORY);

      await supabase.from("whatsapp_conversations")
        .upsert({ phone_number: fromNumber, messages: updatedHistory, organisation_id: orgId, updated_at: new Date().toISOString() },
          { onConflict: "phone_number" });
    }

    // ── Save outbound message ─────────────────────────────
    if (fromNumber && isWhatsApp && finalReply) {
      await supabase.from("whatsapp_messages").insert({
        organisation_id: orgId || null,
        phone_number: fromNumber,
        driver_id: driverProfile?.id || null,
        direction: "outbound",
        message_text: finalReply,
        created_at: new Date().toISOString(),
      });
    }

    // ── Send WhatsApp reply ───────────────────────────────
    if (isWhatsApp && fromNumber) {
      await sendWhatsApp(fromNumber, finalReply, reportUrl);
      // WhatsApp webhook must return 200 with TwiML or empty
      return new Response("<?xml version='1.0' encoding='UTF-8'?><Response></Response>", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // ── JSON response (dashboard) ─────────────────────────
    return new Response(
      JSON.stringify({ message: finalReply, reportUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("whatsapp-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
