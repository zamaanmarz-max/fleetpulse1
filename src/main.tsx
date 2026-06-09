import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Hide the inline startup animation once the app is mounted.
// Keep it visible long enough for the animation to play (~2s), then fade out.
function hideSplash() {
  const splash = document.getElementById("marz-splash");
  if (splash) {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 600);
  }
}
setTimeout(hideSplash, 2000);

// Register the PWA service worker (makes the app installable on phones)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.log("Service worker registration skipped:", err);
    });
  });
}
