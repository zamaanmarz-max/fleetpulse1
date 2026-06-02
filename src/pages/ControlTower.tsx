import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Radio, Users, CheckCircle, XCircle, Clock, Plus, X,
  Loader2, AlertTriangle, MessageSquare, Send, Bell, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "text-warning",          bg: "bg-warning/20",     icon: Clock },
  confirmed:   { label: "Confirmed",   color: "text-success",          bg: "bg-success/20",     icon: CheckCircle },
  declined:    { label: "Declined",    color: "text-destructive",      bg: "bg-destructive/20", icon: XCircle },
  no_response: { label: "No Response", color: "text-muted-foreground", bg: "bg-muted",          icon: Clock },
  completed:   { label: "Completed",   color: "text-primary",          bg: "bg-primary/20",     icon: CheckCircle },
  cancelled:   { label: "Cancelled",   color: "text-muted-foreground", bg: "bg-muted",          icon: XCircle },
};

const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1";

export default function ControlTower() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"bookings" | "checkins" | "alerts">("bookings");

  const [form, setForm] = useState({
    driver_id: "", vehicle_id: "", shift_time: "05:00",
    route: "", instructions: "", booked_by: "",
  });

  const [checkinForm, setCheckinForm] = useState({
    driver_id: "", vehicle_id: "", checkin_type: "delivery_update",
    message: "", location: "",
  });

  // ── Data ──────────────────────────────────────────────────────
  const { data: bookings, isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ["driver_bookings", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_bookings" as any)
        .select("*, drivers(first_name, last_name, phone_number), vehicles(registration_number, fleet_number, make, model)")
        .eq("booking_date", selectedDate)
        .order("shift_time");
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0, refetchOnMount: "always",
  });

  const { data: checkins, refetch: refetchCheckins } = useQuery({
    queryKey: ["driver_checkins", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_checkins" as any)
        .select("*, drivers(first_name, last_name), vehicles(registration_number)")
        .gte("created_at", `${selectedDate}T00:00:00`)
        .lte("created_at", `${selectedDate}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0, refetchOnMount: "always",
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers_list"],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("id, first_name, last_name, phone_number").order("first_name");
      return data || [];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles_list_tower"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, registration_number, fleet_number, make, model").eq("is_active", true).order("fleet_number");
      return (data || []) as any[];
    },
  });

  // ── Stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const b = bookings || [];
    return {
      total: b.length,
      confirmed: b.filter(x => x.status === "confirmed").length,
      pending: b.filter(x => x.status === "pending").length,
      declined: b.filter(x => x.status === "declined").length,
    };
  }, [bookings]);

  const breakdowns = (checkins || []).filter(c => c.checkin_type === "breakdown_report");

  // ── Actions ───────────────────────────────────────────────────
  const sendWhatsApp = async (booking: any) => {
    const driver = booking.drivers;
    if (!driver?.phone_number) { toast.error("Driver has no phone number"); return; }
    const vehicle = booking.vehicles;
    const vehInfo = vehicle ? `${vehicle.registration_number} (${vehicle.make} ${vehicle.model})` : "TBA";
    const msg = `Hi ${driver.first_name}, you have been booked for duty on ${selectedDate} at ${booking.shift_time}.\n\nVehicle: ${vehInfo}\n${booking.route ? `Route: ${booking.route}\n` : ""}${booking.instructions ? `Instructions: ${booking.instructions}\n` : ""}\nReply *YES* to confirm or *NO* if unavailable.\n\n_MARZ Fleet Management_`;
    window.open(`https://wa.me/27${driver.phone_number.replace(/^0/, "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
    await supabase.from("driver_bookings" as any).update({ whatsapp_sent_at: new Date().toISOString() }).eq("id", booking.id);
    toast.success(`WhatsApp opened for ${driver.first_name}`);
    refetchBookings();
  };

  const handleSaveBooking = async () => {
    if (!form.driver_id) { toast.error("Select a driver"); return; }
    setSaving(true);
    const { error } = await supabase.from("driver_bookings" as any).insert({
      organisation_id: profile?.organisation_id,
      booking_date: selectedDate,
      driver_id: form.driver_id,
      vehicle_id: form.vehicle_id || null,
      shift_time: form.shift_time,
      route: form.route || null,
      instructions: form.instructions || null,
      booked_by: form.booked_by || null,
      status: "pending",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Driver booked — click WhatsApp to notify them");
    setShowNewBooking(false);
    setForm({ driver_id: "", vehicle_id: "", shift_time: "05:00", route: "", instructions: "", booked_by: "" });
    refetchBookings();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("driver_bookings" as any).update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    refetchBookings();
    toast.success(`Marked as ${status}`);
  };

  const handleLogCheckin = async () => {
    if (!checkinForm.driver_id || !checkinForm.message) { toast.error("Select driver and enter message"); return; }
    const { error } = await supabase.from("driver_checkins" as any).insert({
      organisation_id: profile?.organisation_id,
      driver_id: checkinForm.driver_id,
      vehicle_id: checkinForm.vehicle_id || null,
      checkin_type: checkinForm.checkin_type,
      message: checkinForm.message,
      location: checkinForm.location || null,
      source: "manual",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Update logged");
    setShowCheckin(false);
    setCheckinForm({ driver_id: "", vehicle_id: "", checkin_type: "delivery_update", message: "", location: "" });
    refetchCheckins();
  };

  const isToday = selectedDate === today;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" /> Control Tower
          </h1>
          <p className="text-sm text-muted-foreground">Book drivers · Track updates · Report breakdowns — no airtime needed</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
          <button onClick={() => { refetchBookings(); refetchCheckins(); }} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live indicator */}
      {isToday && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-sm text-primary font-medium">Live — Today's Operations</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Drivers Booked", value: stats.total, color: "text-foreground" },
          { label: "Confirmed", value: stats.confirmed, color: "text-success" },
          { label: "Awaiting Reply", value: stats.pending, color: "text-warning" },
          { label: "Declined", value: stats.declined, color: "text-destructive" },
          { label: "Breakdowns", value: breakdowns.length, color: breakdowns.length > 0 ? "text-destructive" : "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="stat-card p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Breakdown alert */}
      {breakdowns.length > 0 && (
        <div className="glass-card p-4 border border-destructive/30 bg-destructive/5 space-y-2">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {breakdowns.length} Active Breakdown{breakdowns.length > 1 ? "s" : ""} Today
          </h3>
          {breakdowns.map(b => (
            <div key={b.id} className="flex items-center justify-between bg-destructive/10 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {b.drivers?.first_name} {b.drivers?.last_name} — {b.vehicles?.registration_number || "Unknown vehicle"}
                </p>
                <p className="text-xs text-muted-foreground">{b.message}</p>
                {b.location && <p className="text-xs text-warning">📍 {b.location}</p>}
              </div>
              <p className="text-xs text-muted-foreground ml-4 whitespace-nowrap">
                {new Date(b.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "bookings", icon: Users, label: "Driver Bookings", badge: stats.pending > 0 ? stats.pending : 0 },
          { key: "checkins", icon: MessageSquare, label: "Check-ins & Updates", badge: 0 },
          { key: "alerts", icon: Bell, label: "Alerts", badge: breakdowns.length + stats.declined },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
            {t.badge > 0 && <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full font-bold">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Bookings Tab */}
      {activeTab === "bookings" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{stats.total} drivers booked for {selectedDate}</p>
            <button onClick={() => setShowNewBooking(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
              <Plus className="w-4 h-4" /> Book Driver
            </button>
          </div>

          {bookingsLoading
            ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            : (bookings || []).length === 0
              ? (
                <div className="glass-card p-8 text-center space-y-2">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-sm font-semibold text-foreground">No drivers booked for this date</p>
                  <p className="text-xs text-muted-foreground">Click "Book Driver" to start building the roster</p>
                </div>
              ) : (
                <div className="glass-card overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border">
                        {["Time", "Driver", "Phone", "Vehicle", "Route", "Status", "Actions"].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(bookings || []).map((b: any) => {
                        const cfg = STATUS_CONFIG[b.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                        const StatusIcon = cfg.icon;
                        return (
                          <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-mono font-bold text-foreground">{b.shift_time}</td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-foreground">{b.drivers?.first_name} {b.drivers?.last_name}</p>
                              {b.instructions && <p className="text-xs text-muted-foreground truncate max-w-[150px]">{b.instructions}</p>}
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{b.drivers?.phone_number || "—"}</td>
                            <td className="px-4 py-3 text-sm text-foreground">
                              {b.vehicles ? b.vehicles.registration_number : <span className="text-warning text-xs">TBA</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground max-w-[120px] truncate">{b.route || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full w-fit ${cfg.bg} ${cfg.color}`}>
                                <StatusIcon className="w-3 h-3" /> {cfg.label}
                              </span>
                              {b.whatsapp_sent_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Sent {new Date(b.whatsapp_sent_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5 flex-wrap">
                                <button onClick={() => sendWhatsApp(b)}
                                  className="flex items-center gap-1 text-xs bg-success/20 text-success px-2 py-1.5 rounded-lg hover:opacity-80 font-semibold">
                                  <Send className="w-3 h-3" /> WhatsApp
                                </button>
                                {b.status === "pending" && <>
                                  <button onClick={() => updateStatus(b.id, "confirmed")} className="text-xs bg-success/20 text-success px-2 py-1.5 rounded-lg hover:opacity-80">✓ Yes</button>
                                  <button onClick={() => updateStatus(b.id, "declined")} className="text-xs bg-destructive/20 text-destructive px-2 py-1.5 rounded-lg hover:opacity-80">✗ No</button>
                                </>}
                                {b.status === "confirmed" && (
                                  <button onClick={() => updateStatus(b.id, "completed")} className="text-xs bg-primary/20 text-primary px-2 py-1.5 rounded-lg hover:opacity-80">Complete</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
          }

          {stats.total > 0 && (
            <div className="glass-card p-4 flex gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{stats.confirmed}</p>
                <p className="text-xs text-muted-foreground">Confirmed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Awaiting Reply</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{stats.declined}</p>
                <p className="text-xs text-muted-foreground">Declined — find replacement</p>
              </div>
              <div className="text-center border-l border-border pl-6">
                <p className="text-2xl font-bold text-primary">{Math.round((stats.confirmed / Math.max(stats.total, 1)) * 100)}%</p>
                <p className="text-xs text-muted-foreground">Confirmation Rate</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Check-ins Tab */}
      {activeTab === "checkins" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{(checkins || []).length} updates today</p>
            <button onClick={() => setShowCheckin(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
              <Plus className="w-4 h-4" /> Log Update
            </button>
          </div>

          {(checkins || []).length === 0
            ? <div className="glass-card p-8 text-center"><MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">No updates logged yet</p></div>
            : (
              <div className="space-y-2">
                {(checkins || []).map((c: any) => (
                  <div key={c.id} className={`glass-card p-4 border ${c.checkin_type === "breakdown_report" ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            c.checkin_type === "breakdown_report" ? "bg-destructive/20 text-destructive" :
                            c.checkin_type === "morning_checkin" ? "bg-primary/20 text-primary" :
                            c.checkin_type === "delivery_update" ? "bg-success/20 text-success" :
                            "bg-secondary text-muted-foreground"
                          }`}>
                            {c.checkin_type === "breakdown_report" ? "🚨 BREAKDOWN" :
                             c.checkin_type === "morning_checkin" ? "🌅 Morning Check-in" :
                             c.checkin_type === "delivery_update" ? "📦 Delivery Update" :
                             c.checkin_type === "end_of_day" ? "🏁 End of Day" : "💬 Update"}
                          </span>
                          <span className="text-xs text-muted-foreground">{c.source === "whatsapp" ? "📱 WhatsApp" : "Manual"}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {c.drivers?.first_name} {c.drivers?.last_name}
                          {c.vehicles?.registration_number && <span className="text-muted-foreground font-normal"> — {c.vehicles.registration_number}</span>}
                        </p>
                        <p className="text-sm text-foreground mt-1">{c.message}</p>
                        {c.location && <p className="text-xs text-warning mt-1">📍 {c.location}</p>}
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(c.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <div className="space-y-3">
          {breakdowns.length === 0 && stats.declined === 0
            ? <div className="glass-card p-8 text-center"><CheckCircle className="w-10 h-10 text-success mx-auto mb-3" /><p className="text-sm font-semibold text-success">All clear — no active alerts</p></div>
            : (
              <>
                {breakdowns.map(b => (
                  <div key={b.id} className="glass-card p-4 border border-destructive/30 bg-destructive/5">
                    <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-destructive" /><span className="text-sm font-bold text-destructive">Breakdown Report</span></div>
                    <p className="text-sm text-foreground">{b.drivers?.first_name} {b.drivers?.last_name} — {b.vehicles?.registration_number}</p>
                    <p className="text-sm text-muted-foreground mt-1">{b.message}</p>
                    {b.location && <p className="text-xs text-warning mt-1">📍 {b.location}</p>}
                  </div>
                ))}
                {(bookings || []).filter(b => b.status === "declined").map((b: any) => (
                  <div key={b.id} className="glass-card p-4 border border-warning/30 bg-warning/5">
                    <div className="flex items-center gap-2 mb-1"><XCircle className="w-4 h-4 text-warning" /><span className="text-sm font-bold text-warning">Driver Declined — Replacement Needed</span></div>
                    <p className="text-sm text-foreground">{b.drivers?.first_name} {b.drivers?.last_name} declined for {b.vehicles?.registration_number || "vehicle TBA"}</p>
                  </div>
                ))}
              </>
            )
          }
        </div>
      )}

      {/* Book Driver Modal */}
      {showNewBooking && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setShowNewBooking(false)} />
          <div className="w-full max-w-md bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">Book Driver</h2>
                <p className="text-xs text-muted-foreground mt-0.5">For {selectedDate}</p>
              </div>
              <button onClick={() => setShowNewBooking(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className={labelCls}>Driver *</label>
                <select value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })} className={inputCls}>
                  <option value="">Select driver...</option>
                  {(drivers || []).map((d: any) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}{d.phone_number ? ` — ${d.phone_number}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Vehicle</label>
                <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} className={inputCls}>
                  <option value="">Select vehicle (optional)</option>
                  {(vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registration_number} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Shift Time</label>
                  <input type="time" value={form.shift_time} onChange={e => setForm({ ...form, shift_time: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Booked By</label>
                  <input value={form.booked_by} onChange={e => setForm({ ...form, booked_by: e.target.value })} placeholder="Your name" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Route / Area</label>
                <input value={form.route} onChange={e => setForm({ ...form, route: e.target.value })} placeholder="e.g. Midrand to Cape Town" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Instructions</label>
                <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={3} placeholder="Any special instructions" className={inputCls} />
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-primary space-y-1">
                <p className="font-semibold">After saving:</p>
                <p>Click the WhatsApp button on the booking. The driver gets a message asking YES or NO. No airtime needed — pure data.</p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={handleSaveBooking} disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} Save Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Check-in Modal */}
      {showCheckin && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setShowCheckin(false)} />
          <div className="w-full max-w-md bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <h2 className="text-base font-bold text-foreground">Log Driver Update</h2>
              <button onClick={() => setShowCheckin(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className={labelCls}>Driver *</label>
                <select value={checkinForm.driver_id} onChange={e => setCheckinForm({ ...checkinForm, driver_id: e.target.value })} className={inputCls}>
                  <option value="">Select driver...</option>
                  {(drivers || []).map((d: any) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Vehicle</label>
                <select value={checkinForm.vehicle_id} onChange={e => setCheckinForm({ ...checkinForm, vehicle_id: e.target.value })} className={inputCls}>
                  <option value="">Select vehicle (optional)</option>
                  {(vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Update Type</label>
                <select value={checkinForm.checkin_type} onChange={e => setCheckinForm({ ...checkinForm, checkin_type: e.target.value })} className={inputCls}>
                  <option value="morning_checkin">🌅 Morning Check-in</option>
                  <option value="delivery_update">📦 Delivery Update</option>
                  <option value="breakdown_report">🚨 Breakdown Report</option>
                  <option value="end_of_day">🏁 End of Day</option>
                  <option value="other">💬 Other Update</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input value={checkinForm.location} onChange={e => setCheckinForm({ ...checkinForm, location: e.target.value })} placeholder="e.g. N14 near Buccleuch" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Message *</label>
                <textarea value={checkinForm.message} onChange={e => setCheckinForm({ ...checkinForm, message: e.target.value })} rows={4} placeholder="What did the driver report?" className={inputCls} />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={handleLogCheckin} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" /> Log Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
