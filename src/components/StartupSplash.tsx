import { useEffect, useState } from "react";

// Animated MARZ intro shown briefly when the app first loads, before login.
// Plays once per app session.
export function StartupSplash({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 50);
    const t2 = setTimeout(() => setExiting(true), 1600);
    const t3 = setTimeout(() => onDone(), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const letters = ["M", "A", "R", "Z"];

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center transition-opacity duration-500"
      style={{ background: "#0a0e1a", opacity: exiting ? 0 : 1 }}
    >
      <div className="flex items-end gap-1 relative">
        {letters.map((l, i) => (
          <span
            key={i}
            className="text-6xl font-extrabold text-primary transition-all duration-500"
            style={{
              opacity: show ? 1 : 0,
              transform: show ? "translateY(0)" : "translateY(20px)",
              transitionDelay: `${i * 130}ms`,
            }}
          >
            {l}
          </span>
        ))}
        {/* truck drives across under the letters */}
        <div
          className="absolute -bottom-7 left-1 transition-all ease-out"
          style={{
            transform: show ? "translateX(0)" : "translateX(-60px)",
            opacity: show ? 1 : 0,
            transitionDuration: "1000ms",
            transitionDelay: "550ms",
          }}
        >
          <svg width="48" height="26" viewBox="0 0 26 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="2" width="13" height="8" rx="1" className="fill-primary" />
            <path d="M14 4 H20 L24 7 V10 H14 Z" className="fill-primary" />
            <rect x="15.5" y="5" width="3.5" height="2.5" rx="0.5" fill="#0a0e1a" />
            <circle cx="6" cy="11" r="2" fill="#dde6f0" />
            <circle cx="19" cy="11" r="2" fill="#dde6f0" />
            <text x="4" y="9" fill="#0a0e1a" fontSize="6" fontWeight="bold">❄</text>
          </svg>
        </div>
      </div>
      <div
        className="h-1 bg-primary/50 mt-10 rounded-full transition-all"
        style={{ width: show ? "180px" : "0px", transitionDuration: "900ms", transitionDelay: "650ms" }}
      />
      <p
        className="text-xs text-muted-foreground mt-4 tracking-widest uppercase transition-opacity duration-500"
        style={{ opacity: show ? 1 : 0, transitionDelay: "900ms" }}
      >
        Fleet
      </p>
    </div>
  );
}
