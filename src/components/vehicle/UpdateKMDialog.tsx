import { useState } from "react";
import { Loader2, X, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { recalculateAllVehicleCompliance } from "@/lib/compliance";

interface Props {
  vehicleId: string;
  organisationId: string | null;
  currentKm: number;
  registration: string;
  onClose: () => void;
  onSaved: () => void;
}

export function UpdateKMDialog({ vehicleId, organisationId, currentKm, registration, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [reading, setReading] = useState(currentKm.toString());
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const km = parseInt(reading, 10);
    if (isNaN(km) || km < 0) { toast.error("Enter a valid KM reading"); return; }
    if (km < currentKm) {
      if (!confirm(`New reading (${km.toLocaleString()}) is lower than current (${currentKm.toLocaleString()}). Continue?`)) return;
    }
    setSaving(true);
    // Update vehicle and stamp km_last_updated_at so the "KM Updated" badge can use the dedicated column.
    const nowIso = new Date().toISOString();
    const { error: vErr } = await supabase.from("vehicles").update({
      current_odometer_km: km,
      last_odometer_update: date,
      km_last_updated_at: nowIso,
      km_last_updated_by: user?.id || null,
      updated_at: nowIso,
    }).eq("id", vehicleId);
    if (vErr) { toast.error(vErr.message); setSaving(false); return; }
    // Insert history record
    await supabase.from("odometer_readings" as any).insert({
      vehicle_id: vehicleId,
      organisation_id: organisationId,
      reading_km: km,
      reading_date: date,
      notes: notes || null,
      recorded_by: user?.id || null,
    });
    setSaving(false);
    toast.success(`KM updated for ${registration}`);
    // Recalculate compliance scores so all pages show consistent status
    recalculateAllVehicleCompliance().then(() => {
      onSaved();
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 w-[420px] max-w-[95vw] space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" /> Update KM
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-secondary/50 rounded-lg p-3 text-sm">
          <p className="text-xs text-muted-foreground">Vehicle</p>
          <p className="font-mono font-semibold text-foreground">{registration}</p>
          <p className="text-xs text-muted-foreground mt-1">Current reading: <span className="text-foreground font-mono">{currentKm.toLocaleString()} km</span></p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">New KM Reading *</label>
          <input
            type="number"
            value={reading}
            onChange={e => setReading(e.target.value)}
            autoFocus
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. After return from Cape Town trip"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-lg text-sm font-medium hover:bg-secondary/80">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Reading
          </button>
        </div>
      </div>
    </div>
  );
}
