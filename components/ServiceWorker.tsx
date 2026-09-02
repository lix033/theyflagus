"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker : l'application reste disponible hors ligne
 * une fois installée sur l'écran d'accueil.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // En développement, un SW actif fausserait le rechargement à chaud.
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => void reg.unregister()))
        .catch(() => undefined);
      return;
    }

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
