import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Railway serves the frontend and API from one origin in production. A
// build-time API URL remains available for local development or a split host.
setBaseUrl(import.meta.env.VITE_API_BASE_URL?.trim() || null);

// ── Service worker handling ─────────────────────────────────────────────────
// In development we must NEVER let a service worker cache bundles — a stale
// cached bundle will keep serving old (possibly broken) code even after fixes.
// So in dev we unregister any existing SW and wipe all caches. In production we
// register the SW (which uses a network-first strategy, see public/sw.js).
if (import.meta.env.DEV) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    }).catch(() => {});
  }
  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    }).catch(() => {});
  }
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
