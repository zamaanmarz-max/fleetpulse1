import { useState } from "react";

export const TRUCK_PARTS = {
  cab: {
    label: "Cab",
    parts: [
      "Front Bumper", "Windscreen", "Left Mirror", "Right Mirror",
      "Driver Door", "Passenger Door", "Cab Roof", "Grille",
      "Headlights", "Cab Steps",
    ],
  },
  engine: {
    label: "Engine & Mechanicals",
    parts: [
      "Engine", "Radiator", "Battery", "Air Filter",
      "Brakes - Front", "Brakes - Rear", "Suspension", "Steering",
      "Gearbox", "Clutch", "Exhaust",
    ],
  },
  tyres: {
    label: "Tyres & Wheels",
    parts: [
      "Tyre - Front Left", "Tyre - Front Right",
      "Tyre - Rear Left Outer", "Tyre - Rear Left Inner",
      "Tyre - Rear Right Outer", "Tyre - Rear Right Inner",
      "Spare Wheel", "Wheel Rims",
    ],
  },
  body: {
    label: "Body & Trailer",
    parts: [
      "Body - Left Side", "Body - Right Side", "Body - Front",
      "Body - Rear Door", "Body - Roof", "Body - Floor",
      "Tail Lift", "Tail Lift Cables", "Rear Bumper",
      "Taillights", "Indicators", "Reverse Lights",
    ],
  },
  refrigeration: {
    label: "Refrigeration",
    parts: [
      "Reefer Unit", "Condenser", "Evaporator",
      "Compressor", "Reefer Fuel Tank", "Temperature Probe",
    ],
  },
  chassis: {
    label: "Chassis & Undercarriage",
    parts: [
      "Chassis - Left", "Chassis - Right", "Crossmembers",
      "Fuel Tank", "Air Tanks", "Fifth Wheel / Coupling",
      "Tow Hitch", "Mudguards",
    ],
  },
};

export const ORDERABLE_PARTS: Record<string, string[]> = {
  "Mirrors": ["Left Mirror", "Right Mirror"],
  "Lights": ["Headlights", "Taillights", "Indicators", "Reverse Lights"],
  "Tyres": ["Tyre - Front Left", "Tyre - Front Right", "Tyre - Rear Left Outer", "Tyre - Rear Left Inner", "Tyre - Rear Right Outer", "Tyre - Rear Right Inner", "Spare Wheel"],
  "Doors": ["Driver Door", "Passenger Door"],
  "Body Panels": ["Body - Left Side", "Body - Right Side", "Body - Front", "Body - Rear Door", "Body - Roof"],
  "Cab Parts": ["Front Bumper", "Rear Bumper", "Windscreen", "Grille", "Cab Steps"],
  "Lift Parts": ["Tail Lift", "Tail Lift Cables"],
  "Engine Parts": ["Battery", "Air Filter", "Radiator"],
  "Reefer Parts": ["Reefer Unit", "Condenser", "Evaporator", "Temperature Probe"],
  "Brake Parts": ["Brakes - Front", "Brakes - Rear"],
  "Suspension Parts": ["Suspension", "Steering"],
  "Fuel": ["Fuel Tank", "Reefer Fuel Tank"],
};

interface Props {
  selectedParts: string[];
  onTogglePart: (part: string) => void;
}

const categoryColors: Record<string, string> = {
  cab: "text-blue-400",
  engine: "text-orange-400",
  tyres: "text-yellow-400",
  body: "text-purple-400",
  refrigeration: "text-cyan-400",
  chassis: "text-green-400",
};

const categoryBg: Record<string, string> = {
  cab: "border-blue-500/40 bg-blue-500/10",
  engine: "border-orange-500/40 bg-orange-500/10",
  tyres: "border-yellow-500/40 bg-yellow-500/10",
  body: "border-purple-500/40 bg-purple-500/10",
  refrigeration: "border-cyan-500/40 bg-cyan-500/10",
  chassis: "border-green-500/40 bg-green-500/10",
};

const categorySelectedBg: Record<string, string> = {
  cab: "bg-blue-500 text-white",
  engine: "bg-orange-500 text-white",
  tyres: "bg-yellow-500 text-black",
  body: "bg-purple-500 text-white",
  refrigeration: "bg-cyan-500 text-black",
  chassis: "bg-green-500 text-black",
};

export function TruckPartSelector({ selectedParts, onTogglePart }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>("cab");

  return (
    <div className="space-y-2">
      {/* Truck SVG side view */}
      <div className="bg-secondary/50 rounded-xl p-3 flex justify-center">
        <svg viewBox="0 0 520 160" className="w-full max-w-lg h-auto" xmlns="http://www.w3.org/2000/svg">
          {/* Chassis */}
          <rect x="20" y="110" width="480" height="12" rx="2" fill="#374151" />
          {/* Cab */}
          <rect x="20" y="55" width="130" height="58" rx="4" fill="#1f2937" stroke="#374151" strokeWidth="1.5" />
          {/* Cab windscreen */}
          <polygon points="40,58 130,58 130,90 40,90" fill="#0ea5e9" opacity="0.3" />
          {/* Cab roof curve */}
          <path d="M 20 55 Q 80 25 150 55" fill="#1f2937" stroke="#374151" strokeWidth="1.5" />
          {/* Body */}
          <rect x="155" y="45" width="340" height="68" rx="3" fill="#1f2937" stroke="#374151" strokeWidth="1.5" />
          {/* Body door */}
          <rect x="472" y="50" width="20" height="60" rx="2" fill="#111827" stroke="#374151" strokeWidth="1" />
          {/* Reefer unit on top */}
          <rect x="155" y="32" width="100" height="16" rx="2" fill="#164e63" stroke="#0891b2" strokeWidth="1" />
          <text x="205" y="43" textAnchor="middle" fill="#67e8f9" fontSize="7">REEFER</text>
          {/* Fuel tank */}
          <rect x="145" y="95" width="30" height="25" rx="3" fill="#374151" stroke="#4b5563" strokeWidth="1" />
          {/* Front wheels */}
          <circle cx="70" cy="128" r="20" fill="#111827" stroke="#374151" strokeWidth="2" />
          <circle cx="70" cy="128" r="10" fill="#1f2937" />
          {/* Rear wheels (dual) */}
          <circle cx="360" cy="128" r="20" fill="#111827" stroke="#374151" strokeWidth="2" />
          <circle cx="360" cy="128" r="10" fill="#1f2937" />
          <circle cx="395" cy="128" r="20" fill="#111827" stroke="#374151" strokeWidth="2" />
          <circle cx="395" cy="128" r="10" fill="#1f2937" />
          {/* Tail lift */}
          <rect x="492" y="110" width="15" height="5" rx="1" fill="#6b7280" />
          {/* Damage indicators */}
          {selectedParts.length > 0 && (
            <g>
              <circle cx="500" cy="60" r="6" fill="#ef4444" opacity="0.9" />
              <text x="500" y="64" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{selectedParts.length}</text>
            </g>
          )}
          {/* Labels */}
          <text x="80" y="80" textAnchor="middle" fill="#9ca3af" fontSize="8">CAB</text>
          <text x="320" y="82" textAnchor="middle" fill="#9ca3af" fontSize="8">BODY</text>
        </svg>
      </div>

      {selectedParts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <span className="text-xs font-semibold text-destructive w-full mb-1">Damaged parts selected ({selectedParts.length}):</span>
          {selectedParts.map(p => (
            <button key={p} onClick={() => onTogglePart(p)}
              className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full hover:bg-destructive/30 flex items-center gap-1">
              {p} ✕
            </button>
          ))}
        </div>
      )}

      {/* Category grid */}
      <div className="space-y-2">
        {Object.entries(TRUCK_PARTS).map(([catKey, cat]) => {
          const selectedInCat = cat.parts.filter(p => selectedParts.includes(p)).length;
          const isOpen = expandedCategory === catKey;
          return (
            <div key={catKey} className={`border rounded-xl overflow-hidden ${categoryBg[catKey]}`}>
              <button
                onClick={() => setExpandedCategory(isOpen ? null : catKey)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left"
              >
                <span className={`text-sm font-semibold ${categoryColors[catKey]}`}>{cat.label}</span>
                <div className="flex items-center gap-2">
                  {selectedInCat > 0 && (
                    <span className="text-xs bg-destructive text-white px-2 py-0.5 rounded-full font-bold">
                      {selectedInCat} selected
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
                  {cat.parts.map(part => {
                    const isSelected = selectedParts.includes(part);
                    return (
                      <button
                        key={part}
                        onClick={() => onTogglePart(part)}
                        className={`text-left text-xs px-3 py-2 rounded-lg border transition-all font-medium ${
                          isSelected
                            ? categorySelectedBg[catKey] + " border-transparent shadow-sm"
                            : "bg-background/50 border-border text-foreground hover:border-primary/40"
                        }`}
                      >
                        {isSelected && "✓ "}{part}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
