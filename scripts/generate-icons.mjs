/**
 * Génère les icônes PWA (PNG) à partir d'un SVG vectoriel unique.
 *   npm run icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/** Le drapeau : hampe claire + oriflamme dégradée du vert au rouge. */
function glyph(scale = 1, tx = 0, ty = 0) {
  return `
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <g transform="translate(-37 0)">
    <path
      d="M196 124 C248 98 296 158 352 136 C386 122 408 130 420 140
         L420 272 C408 262 386 254 352 268 C296 290 248 230 196 256 Z"
      fill="url(#banner)" />
    <rect x="166" y="92" width="30" height="330" rx="15" fill="#EEF3FA" />
    <circle cx="181" cy="92" r="15" fill="#EEF3FA" />
    </g>
  </g>`;
}

function svg({ size = 512, bleed = false, contentScale = 1 } = {}) {
  const offset = (512 * (1 - contentScale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#151b26" />
      <stop offset="1" stop-color="#070910" />
    </linearGradient>
    <linearGradient id="banner" x1="196" y1="120" x2="420" y2="276" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4ADE80" />
      <stop offset="0.5" stop-color="#22C55E" />
      <stop offset="0.52" stop-color="#F43F5E" />
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

  <rect x="0" y="0" width="512" height="512" rx="${bleed ? 0 : 116}" fill="url(#bg)" />
  <rect x="0" y="0" width="512" height="512" rx="${bleed ? 0 : 116}" fill="url(#glowA)" />
  <rect x="0" y="0" width="512" height="512" rx="${bleed ? 0 : 116}" fill="url(#glowB)" />
  ${glyph(contentScale, offset, offset)}
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, opts: {} },
  { file: "icon-512.png", size: 512, opts: {} },
  { file: "maskable-192.png", size: 192, opts: { bleed: true, contentScale: 0.68 } },
  { file: "maskable-512.png", size: 512, opts: { bleed: true, contentScale: 0.68 } },
  { file: "apple-touch-icon.png", size: 180, opts: { bleed: true, contentScale: 0.78 } },
  { file: "favicon-32.png", size: 32, opts: {} },
  { file: "favicon-16.png", size: 16, opts: {} },
];

await mkdir(OUT, { recursive: true });

await writeFile(resolve(OUT, "icon.svg"), svg(), "utf8");

for (const { file, size, opts } of TARGETS) {
  const source = Buffer.from(svg({ size: 512, ...opts }));
  await sharp(source, { density: 384 })
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, file));
  console.log(`✓ ${file} (${size}×${size})`);
}

console.log(`\nIcônes écrites dans ${OUT}`);
