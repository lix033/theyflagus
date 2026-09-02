"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "theyflagus:install-dismissed";
const APPEAR_DELAY = 2200;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* stockage indisponible */
    }
    if (dismissed) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS ne propose pas `beforeinstallprompt` : on explique le geste natif.
    let timer: number | undefined;
    if (isIOS()) {
      timer = window.setTimeout(() => {
        setShowIOS(true);
        setVisible(true);
      }, APPEAR_DELAY);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignoré */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  }, [deferred]);

  if (!visible) return null;

  return (
    <aside className="sheet" role="complementary" aria-label="Installer l'application">
      <span className="sheet-icon" aria-hidden="true">
        <Download size={18} />
      </span>

      <div className="sheet-body">
        <p className="sheet-title">Installer theyflagus</p>
        {showIOS && !deferred ? (
          <p className="sheet-text">
            Touchez <Share aria-hidden="true" /> puis
            <SquarePlus aria-hidden="true" /> « Sur l&apos;écran d&apos;accueil ».
          </p>
        ) : (
          <p className="sheet-text">Ajoutez-la à votre écran d&apos;accueil.</p>
        )}
      </div>

      {deferred && (
        <button type="button" className="sheet-cta" onClick={install}>
          Installer
        </button>
      )}

      <button
        type="button"
        className="sheet-close"
        onClick={dismiss}
        aria-label="Masquer l'invitation à installer"
      >
        <X size={16} />
      </button>
    </aside>
  );
}
