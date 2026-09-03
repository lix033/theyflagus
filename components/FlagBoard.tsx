"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, Volume2, VolumeX } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/Logo";
import { playVerdict, prepareAudio, stopVerdict, unlockAudio, vibrate } from "@/lib/audio";

type Kind = "green" | "red";

type Flash = { id: number; kind: Kind; x: number; y: number };

/** Le flash tient l'écran aussi longtemps que le son du verdict. */
const FLASH_MS = 2300;
const SOUND_KEY = "theyflagus:sound";

const THEME_COLOR: Record<Kind | "idle", string> = {
  green: "#16a34a",
  red: "#dc2626",
  idle: "#0b0e14",
};

const CARDS: {
  kind: Kind;
  label: string;
  hint: string;
  aria: string;
}[] = [
  {
    kind: "green",
    label: "Green flag",
    hint: "Bon signe. On continue.",
    aria: "Green flag — signal positif",
  },
  {
    kind: "red",
    label: "Red flag",
    hint: "Mauvais signe. On s'arrête là.",
    aria: "Red flag — signal d'alerte",
  },
];

export default function FlagBoard() {
  const [soundOn, setSoundOn] = useState(true);
  const [pressed, setPressed] = useState<Kind | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const flashTimer = useRef<number | null>(null);
  const seq = useRef(0);

  /* Les deux verdicts sont rendus dès le montage : le tout premier appui
     dispose ainsi déjà de son fichier, sans latence ni son avalé. */
  useEffect(() => {
    void prepareAudio();
  }, []);

  /* Préférence son mémorisée sur l'appareil. */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SOUND_KEY);
      if (stored !== null) setSoundOn(stored === "1");
    } catch {
      /* stockage indisponible (navigation privée) : on garde la valeur par défaut */
    }
  }, []);

  /* La barre d'état suit la couleur du verdict en mode application. */
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLOR[flash?.kind ?? "idle"];
  }, [flash]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      try {
        window.localStorage.setItem(SOUND_KEY, next ? "1" : "0");
      } catch {
        /* ignoré */
      }
      if (next) unlockAudio();
      else stopVerdict();
      return next;
    });
  }, []);

  const trigger = useCallback(
    (kind: Kind, x: number, y: number) => {
      seq.current += 1;
      setFlash({ id: seq.current, kind, x, y });

      if (soundOn) playVerdict(kind);
      vibrate(kind);

      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
    },
    [soundOn],
  );

  const onPointerDown = useCallback(
    (kind: Kind) => (event: React.PointerEvent<HTMLButtonElement>) => {
      unlockAudio();

      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--px", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      el.style.setProperty("--py", `${((event.clientY - rect.top) / rect.height) * 100}%`);

      setPressed(kind);
      trigger(
        kind,
        (event.clientX / window.innerWidth) * 100,
        (event.clientY / window.innerHeight) * 100,
      );
    },
    [trigger],
  );

  const onKeyDown = useCallback(
    (kind: Kind) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (event.repeat) return;

      unlockAudio();
      setPressed(kind);
      trigger(kind, 50, 50);
      window.setTimeout(() => setPressed(null), 220);
    },
    [trigger],
  );

  const release = useCallback(() => setPressed(null), []);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <LogoMark size={21} />
          </span>
          <span className="brand-text">
            <span className="brand-title">
              <Wordmark />
            </span>
            <span className="brand-sub">Le verdict, en un geste</span>
          </span>
        </div>

        <button
          type="button"
          className="icon-btn"
          data-on={soundOn}
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Couper le son" : "Activer le son"}
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </header>

      <main className="board">
        {CARDS.map((card) => (
          <button
            key={card.kind}
            type="button"
            className="flag"
            data-kind={card.kind}
            data-pressed={pressed === card.kind}
            aria-label={card.aria}
            onPointerDown={onPointerDown(card.kind)}
            onPointerUp={release}
            onPointerLeave={release}
            onPointerCancel={release}
            onKeyDown={onKeyDown(card.kind)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="flag-icon" aria-hidden="true">
              <Flag strokeWidth={1.9} />
            </span>
            <span className="flag-label">{card.label}</span>
            <span className="flag-hint">{card.hint}</span>
          </button>
        ))}
      </main>

      <p className="footnote">Appuyez sur un bouton pour rendre votre verdict</p>

      {flash && (
        <div
          key={flash.id}
          className="flash"
          data-kind={flash.kind}
          style={
            {
              "--px": `${flash.x}%`,
              "--py": `${flash.y}%`,
            } as React.CSSProperties
          }
          aria-hidden="true"
        >
          <span className="flash-inner">
            <Flag strokeWidth={1.6} />
            <span className="flash-word">
              {flash.kind === "green" ? "Green flag" : "Red flag"}
            </span>
          </span>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {flash ? (flash.kind === "green" ? "Green flag" : "Red flag") : ""}
      </p>
    </>
  );
}
