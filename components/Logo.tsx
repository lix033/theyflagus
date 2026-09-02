/**
 * Logo theyflagus : un drapeau dont l'oriflamme est coupée net en deux —
 * vert côté hampe, rouge à la volée. Les deux verdicts dans un seul signe.
 *
 * La même géométrie sert aux icônes d'application (scripts/generate-icons.mjs).
 */

type LogoMarkProps = {
  size?: number;
  /** Rend le drapeau en une seule couleur (hérite de `currentColor`). */
  mono?: boolean;
};

export function LogoMark({ size = 24, mono = false }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {!mono && (
        <defs>
          {/* objectBoundingBox : la coupure tombe pile au milieu de l'oriflamme, à toute échelle. */}
          <linearGradient id="tfu-banner" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#4ade80" />
            <stop offset="0.5" stopColor="#22c55e" />
            <stop offset="0.5" stopColor="#f43f5e" />
            <stop offset="1" stopColor="#e11d48" />
          </linearGradient>
        </defs>
      )}

      <path
        d="M6.6 3.5C9.4 2.1 12.2 4.9 15 3.9c2.2-.8 3.8-.4 4.8.2v7.3c-1-.6-2.6-1-4.8-.2-2.8 1-5.6-1.8-8.4-.4z"
        fill={mono ? "currentColor" : "url(#tfu-banner)"}
      />
      <rect x="3.4" y="2" width="2.3" height="20" rx="1.15" fill="currentColor" />
    </svg>
  );
}

/** Le nom, avec « flag » mis en couleur : they·flag·us. */
export function Wordmark() {
  return (
    <span className="wordmark">
      they<em>flag</em>us
    </span>
  );
}
