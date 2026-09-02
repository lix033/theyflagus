# Flag It

Red flag ou green flag : deux gros boutons, un verdict immédiat.
Un appui déclenche un **son** (succès ou erreur), **colore tout l'écran** en vert ou
en rouge, et **fait vibrer** l'appareil. L'application s'installe sur Android et
iOS depuis le navigateur, sans passer par un store.

Next.js 16.2.12 · React 19 · PWA installable et utilisable hors ligne.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
```

Le service worker n'est actif qu'en production (il est désenregistré en dev pour
ne pas gêner le rechargement à chaud) :

```bash
npm run build && npm start
```

## Installer sur téléphone

L'installation d'une PWA exige une origine sécurisée : `localhost` ou **HTTPS**.
Déployez (Vercel, Netlify, Cloudflare Pages… `npm run build` suffit) puis :

- **Android / Chrome** — une bannière « Installer Flag It » apparaît dans
  l'application ; sinon menu ⋮ → *Ajouter à l'écran d'accueil*.
- **iOS / Safari** — bouton *Partager* → *Sur l'écran d'accueil*. L'application
  rappelle le geste automatiquement (iOS n'expose pas de bouton d'installation).

Une fois installée, elle s'ouvre en plein écran, sans barre d'adresse, et
fonctionne hors ligne.

## Structure

| Fichier | Rôle |
| --- | --- |
| `app/page.tsx` | Assemble l'écran |
| `app/manifest.ts` | Manifeste PWA (servi sur `/manifest.webmanifest`) |
| `app/globals.css` | Design system : jetons, cartes, flash plein écran |
| `components/FlagBoard.tsx` | Les deux boutons, le flash, le réglage du son |
| `components/InstallPrompt.tsx` | Invitation à installer (Android + iOS) |
| `components/ServiceWorker.tsx` | Enregistrement du service worker |
| `lib/audio.ts` | Sons tenus de succès / d'erreur synthétisés (Web Audio API) |
| `public/sw.js` | Cache hors ligne |
| `scripts/generate-icons.mjs` | Génère les icônes PNG depuis un SVG (`npm run icons`) |

## Détails d'implémentation

- **Sons** — synthétisés à la volée avec la Web Audio API : aucun fichier à
  télécharger, latence quasi nulle, fonctionne hors ligne. Les deux verdicts sont
  **tenus** et restent sous les 3 secondes : le green flag est un accord majeur
  qui s'installe et résonne (≈ 2,4 s audibles), le red flag un **buzzer grave et
  rêche** qui tient son palier avant de retomber (≈ 2,2 s). Un nouvel appui
  éteint le son précédent en douceur au lieu de s'y superposer, et un limiteur
  protège de la saturation. Le contexte audio est débloqué au premier appui
  (contrainte iOS / Chrome). Le bouton haut-parleur coupe le son, le choix est
  mémorisé sur l'appareil.
  *Sur iPhone, le bouton latéral silencieux coupe l'audio du web : c'est une
  limite du système, pas de l'application.*
- **Vibration** — `navigator.vibrate` (Android ; iOS ne l'expose pas) : brève
  sur green flag, longue et saccadée sur red flag, en écho au buzzer.
- **Réactivité** — le verdict part sur `pointerdown`, pas sur `click`.
- **Icônes** — jeu d'icônes lucide (aucun emoji) ; icônes d'application générées
  depuis un SVG vectoriel, avec variantes *maskable* pour Android et
  `apple-touch-icon` pour iOS.
- **Accessibilité** — boutons natifs, navigation clavier (Entrée / Espace),
  annonce du verdict via `aria-live`, respect de `prefers-reduced-motion`.
