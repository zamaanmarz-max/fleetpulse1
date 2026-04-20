// Helpers for vehicle_service_trackers
export type TrackingType = "km" | "days" | "hours";

export interface ServiceTracker {
  id: string;
  vehicle_id: string;
  organisation_id?: string | null;
  tracker_name: string;
  tracking_type: TrackingType | string;
  interval_value: number;
  last_done_value: number | null;
  last_done_date: string | null;
  next_due_value: number | null;
  next_due_date: string | null;
  notes?: string | null;
}

export interface TrackerStatus {
  status: "ok" | "due_soon" | "overdue";
  remaining: number;
  remainingLabel: string;
}

/** Compute live status of a tracker given current vehicle KM. */
export function computeTrackerStatus(t: ServiceTracker, currentKm: number): TrackerStatus {
  const now = Date.now();
  if (t.tracking_type === "days") {
    if (!t.next_due_date) return { status: "ok", remaining: 0, remainingLabel: "—" };
    const days = Math.ceil((new Date(t.next_due_date).getTime() - now) / 86400000);
    if (days <= 0) return { status: "overdue", remaining: days, remainingLabel: `${Math.abs(days)}d overdue` };
    if (days <= 14) return { status: "due_soon", remaining: days, remainingLabel: `${days}d left` };
    return { status: "ok", remaining: days, remainingLabel: `${days}d left` };
  }
  if (t.tracking_type === "km") {
    const next = Number(t.next_due_value ?? 0);
    const remaining = next - currentKm;
    if (remaining <= 0) return { status: "overdue", remaining, remainingLabel: `${Math.abs(remaining).toLocaleString()} km overdue` };
    if (remaining <= 1000) return { status: "due_soon", remaining, remainingLabel: `${remaining.toLocaleString()} km left` };
    return { status: "ok", remaining, remainingLabel: `${remaining.toLocaleString()} km left` };
  }
  // hours
  const next = Number(t.next_due_value ?? 0);
  const last = Number(t.last_done_value ?? 0);
  const remaining = next - last; // hours since last done is tracked manually, just show interval-style "next at"
  if (remaining <= 0) return { status: "overdue", remaining, remainingLabel: `Hours overdue` };
  return { status: "ok", remaining, remainingLabel: `Next at ${next} hrs` };
}

/** Compute next due value/date when creating or resetting a tracker. */
export function computeNextDue(
  trackingType: TrackingType | string,
  intervalValue: number,
  lastDoneValue: number | null,
  lastDoneDate: string | null
): { next_due_value: number | null; next_due_date: string | null } {
  if (trackingType === "days") {
    const base = lastDoneDate ? new Date(lastDoneDate) : new Date();
    const next = new Date(base.getTime() + intervalValue * 86400000);
    return { next_due_value: null, next_due_date: next.toISOString().split("T")[0] };
  }
  // km or hours
  const base = lastDoneValue ?? 0;
  return { next_due_value: base + intervalValue, next_due_date: null };
}

/** Map common tracker names to job_card job types so we can auto-reset on completion. */
export const TRACKER_JOB_TYPE_MAP: Record<string, string[]> = {
  "tyre rotation": ["Tyre Replacement"],
  "tyre replacement": ["Tyre Replacement"],
  "oil change": ["Scheduled Service"],
  "scheduled service": ["Scheduled Service"],
  "brake inspection": ["Brake Service"],
  "brake service": ["Brake Service"],
  "fridge service": ["Refrigeration Repair"],
  "refrigeration service": ["Refrigeration Repair"],
};
