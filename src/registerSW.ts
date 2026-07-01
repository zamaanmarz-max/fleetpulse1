import { toast } from "sonner";

/**
 * Registers the PWA service worker and wires up a safe "new version available"
 * flow so users stop having to hard-refresh / open incognito after a deploy.
 *
 * How it works:
 *  - The worker in public/sw.js no longer calls skipWaiting() on install, so a
 *    freshly deployed worker sits in "waiting" until we tell it to take over.
 *  - When we detect a waiting worker we show a sticky toast. Tapping "Refresh"
 *    messages the worker to skipWaiting(); once it takes control the
 *    controllerchange event fires and we reload exactly once.
 *  - We never auto-reload silently — that could wipe a half-filled repair or
 *    certificate form. The user is always in control of when the swap happens.
 *  - We also poll for updates periodically and whenever the tab regains focus,
 *    so a long-open PWA still notices a new deploy.
 */
export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  // Only reload after WE initiate the swap (guards against reloading on the
  // very first install, when clients.claim() also fires controllerchange).
  let updateInitiated = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateInitiated) return;
    window.location.reload();
  });

  const promptUpdate = (worker: ServiceWorker) => {
    toast("A new version of MARZ Fleet is ready", {
      description: "Refresh to get the latest updates.",
      duration: Infinity,
      action: {
        label: "Refresh",
        onClick: () => {
          updateInitiated = true;
          worker.postMessage({ type: "SKIP_WAITING" });
        },
      },
    });
  };

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // A new worker was already waiting when the app loaded.
        if (reg.waiting && navigator.serviceWorker.controller) {
          promptUpdate(reg.waiting);
        }

        // A new worker started installing after load.
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" + an existing controller == this is an update, not
            // the first-ever install.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate(installing);
            }
          });
        });

        // Nudge the browser to check for a new worker periodically and on focus.
        const check = () => reg.update().catch(() => {});
        setInterval(check, 60 * 1000);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
      })
      .catch((err) => {
        console.log("Service worker registration skipped:", err);
      });
  });
}
