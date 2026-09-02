/**
 * Génère les icônes PWA (PNG) à partir du logo theyflagus.
 * La géométrie est identique à celle de `components/Logo.tsx`.
 *   npm run icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/* Logo dessiné dans un carré 24×24 ; centre visuel en (11.6, 12). */
const BANNER =
  "M6.6 3.5C9.4 2.1 12.2 4.9 15 3.9c2.2-.8 3.8-.4 4.8.2v7.3c-1-.6-2.6-1-4.8-.2-2.8 1-5.6-1.8-8.4-.4z";
const POLE = { x: 3.4, y: 2, w: 2.3, h: 20, rx: 1.15 };

/** Place le logo au centre d'un canevas 512, à l'échelle demandée. */
function glyph(scale) {
  const tx = 256 - 11.6 * scale;
  const ty = 256 - 12 * scale;
  return `
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <path d="${BANNER}" fill="url(#banner)" />
    <rect x="${POLE.x}" y="${POLE.y}" width="${POLE.w}" height="${POLE.h}" rx="${POLE.rx}" fill="#EEF3FA" />
  </g>`;
}

function svg({ size = 512, bleed = false, scale = 15 } = {}) {
  const radius = bleed ? 0 : 116;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#151b26" />
      <stop offset="1" stop-color="#070910" />
    </linearGradient>
    <linearGradient id="banner" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4ADE80" />
      <stop offset="0.5" stop-color="#22C55E" />
      <stop offset="0.5" stop-color="#F43F5E" />
      <stop offset="1" stop-color="#E11D48" />
    </linearGradient>
    <radialGradient id="glowA" cx="0.2" cy="0.15" r="0.75">
      <stop offset="0" stop-color="#34D399" stop-opacity="0.34" />
      <stop offset="1" stop-color="#34D399" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowB" cx="0.85" cy="0.9" r="0.75">
      <stop offset="0" stop-color="#F43F5E" stop-opacity="0.3" />
      <stop offset="1" stop-color="#F43F5E" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="512" height="512" rx="${radius}" fill="url(#bg)" />
  <rect width="512" height="512" rx="${radius}" fill="url(#glowA)" />
  <rect width="512" height="512" rx="${radius}" fill="url(#glowB)" />
  ${glyph(scale)}
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, opts: { scale: 15 } },
  { file: "icon-512.png", size: 512, opts: { scale: 15 } },
  // Maskable : Android rogne jusqu'à 20 % sur chaque bord.
  { file: "maskable-192.png", size: 192, opts: { bleed: true, scale: 11 } },
  { file: "maskable-512.png", size: 512, opts: { bleed: true, scale: 11 } },
  // iOS applique lui-même le masque arrondi : fond plein bord.
  { file: "apple-touch-icon.png", size: 180, opts: { bleed: true, scale: 13 } },
  { file: "favicon-32.png", size: 32, opts: { scale: 16 } },
  { file: "favicon-16.png", size: 16, opts: { scale: 16 } },
];

await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, "icon.svg"), svg(), "utf8");

for (const { file, size, opts } of TARGETS) {
  await sharp(Buffer.from(svg({ size: 512, ...opts })), { density: 384 })
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, file));
  console.log(`✓ ${file} (${size}×${size})`);
}

console.log(`\nIcônes écrites dans ${OUT}`);
