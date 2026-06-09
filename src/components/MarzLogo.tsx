import { useEffect, useState } from "react";

// Animated MARZ wordmark with a little truck that drives in.
// Used on the tech home and can be reused anywhere.
export function MarzLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 50); return () => clearTimeout(t); }, []);

  const letterSize = size === "lg" ? "text-5xl" : size === "sm" ? "text-2xl" : "text-3xl";
  const letters = ["M", "A", "R", "Z"];

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-end gap-0.5 relative">
        {letters.map((l, i) => (
          <span
            key={i}
            className={`${letterSize} font-extrabold text-primary transition-all duration-500`}
            style={{
              opacity: show ? 1 : 0,
              transform: show ? "translateY(0)" : "translateY(12px)",
              transitionDelay: `${i * 120}ms`,
            }}
          >
            {l}
          </span>
        ))}
        {/* truck drives across under the letters */}
        <div
          className="absolute -bottom-3 left-0 transition-all ease-out"
          style={{
            transform: show ? "translateX(0)" : "translateX(-40px)",
            opacity: show ? 1 : 0,
            transitionDuration: "900ms",
            transitionDelay: "500ms",
          }}
        >
          <Truck />
        </div>
      </div>
      <div
        className="h-0.5 bg-primary/40 mt-4 rounded-full transition-all"
        style={{ width: show ? "100%" : "0%", transitionDuration: "700ms", transitionDelay: "600ms" }}
      />
    </div>
  );
}

function Truck() {
  return (
    <svg width="26" height="14" viewBox="0 0 26 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* trailer */}
      <rect x="1" y="2" width="13" height="8" rx="1" className="fill-primary" />
      {/* cab */}
      <path d="M14 4 H20 L24 7 V10 H14 Z" className="fill-primary" />
      <rect x="15.5" y="5" width="3.5" height="2.5" rx="0.5" className="fill-background" />
      {/* wheels */}
      <circle cx="6" cy="11" r="2" className="fill-foreground" />
      <circle cx="19" cy="11" r="2" className="fill-foreground" />
      <circle cx="6" cy="11" r="0.8" className="fill-background" />
      <circle cx="19" cy="11" r="0.8" className="fill-background" />
      {/* snowflake on trailer (fridge) */}
      <text x="7.5" y="8" className="fill-background" fontSize="6" fontWeight="bold">❄</text>
    </svg>
  );
}
