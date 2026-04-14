import { useState } from "react";
import { EQUIPMENT_OPTIONS, getRequiredCertificates } from "@/lib/vehicleEquipment";

interface EquipmentChecklistProps {
  selected: string[];
  onChange: (equipment: string[]) => void;
}

export function EquipmentChecklist({ selected, onChange }: EquipmentChecklistProps) {
  const [customEquipment, setCustomEquipment] = useState("");

  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter(s => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  const addCustom = () => {
    const trimmed = customEquipment.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
      setCustomEquipment("");
    }
  };

  const requiredCerts = getRequiredCertificates(selected);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Vehicle Equipment & Compliance Requirements</label>
        <div className="grid grid-cols-2 gap-2">
          {EQUIPMENT_OPTIONS.map(eq => (
            <label key={eq} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selected.includes(eq)}
                onChange={() => toggle(eq)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-foreground">{eq}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={customEquipment}
          onChange={e => setCustomEquipment(e.target.value)}
          placeholder="Other equipment..."
          className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
        />
        <button type="button" onClick={addCustom} className="bg-secondary text-foreground px-3 py-2 rounded-lg text-sm hover:bg-secondary/80 border border-border">Add</button>
      </div>

      {/* Show custom items not in standard list */}
      {selected.filter(s => !(EQUIPMENT_OPTIONS as readonly string[]).includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.filter(s => !(EQUIPMENT_OPTIONS as readonly string[]).includes(s)).map(s => (
            <span key={s} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-xs">
              {s}
              <button type="button" onClick={() => toggle(s)} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}

      {requiredCerts.length > 0 && (
        <div className="bg-secondary/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Required Certificates</p>
          <div className="flex flex-wrap gap-1.5">
            {requiredCerts.map(c => (
              <span key={c} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
