# theyflagus

*they flag us* — red flag ou green flag : deux gros boutons, un verdict immédiat.
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

- **Android / Chrome** — une bannière « Installer theyflagus » apparaît dans
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
| `components/Logo.tsx` | Le logo : drapeau deux tons + signature `theyflagus` |
| `components/FlagBoard.tsx` | Les deux boutons, le flash, le réglage du son |
| `components/InstallPrompt.tsx` | Invitation à installer (Android + iOS) |
| `components/ServiceWorker.tsx` | Enregistrement du service worker |
| `lib/audio.ts` | Sons de succès / d'erreur : synthèse, rendu WAV, lecture |
| `public/sw.js` | Cache hors ligne |
| `scripts/generate-icons.mjs` | Génère les icônes PNG depuis un SVG (`npm run icons`) |

## Détails d'implémentation

- **Sons** — synthétisés avec la Web Audio API : aucun fichier à télécharger,
  fonctionne hors ligne. Les deux verdicts sont **tenus** et restent sous les
  3 secondes : le green flag est un accord majeur qui s'installe et résonne
  (≈ 2,4 s audibles), le red flag un **buzzer grave et rêche** qui tient son
  palier avant de retomber (≈ 2,2 s). Un nouvel appui éteint le son précédent
  au lieu de s'y superposer, et un limiteur protège de la saturation. Le bouton
  haut-parleur coupe le son, le choix est mémorisé sur l'appareil.

- **Le son sur un vrai téléphone** — trois obstacles, trois réponses ; ils ne se
  voient pas sur un navigateur de bureau :

  1. *iPhone en mode silencieux.* La Web Audio API sort dans la session audio
     « ambient », que le bouton latéral silencieux coupe — un élément `<audio>`,
     lui, sonne quand même. Les deux verdicts sont donc **rendus une fois** en
     WAV (`OfflineAudioContext`, dès le montage de la page) puis joués par un
     élément `<audio>`. iOS 16.4+ se voit en plus réclamer la session
     `playback`. La synthèse temps réel reste le repli si le rendu échoue.
  2. *Premier appui muet.* `AudioContext` démarre « suspended » et repasse
     « interrupted » sur iOS après un appel ; `resume()` étant asynchrone,
     programmer les oscillateurs juste après revient à les programmer dans le
     passé. Le moteur attend désormais la reprise, et relance le contexte au
     retour au premier plan.
  3. *Haut-parleur de téléphone.* Il ne restitue quasiment rien sous ~500 Hz.
     Un buzzer bâti sur des fondamentales à ~100 Hz est donc inaudible sans
     casque : chaque verdict porte maintenant son énergie dans la bande
     réellement reproduite (mesuré : le red flag y gagne 5 dB et rejoint le
     green flag), et le rendu est normalisé pour un volume constant d'un
     appareil à l'autre.
- **Vibration** — `navigator.vibrate` (Android ; iOS ne l'expose pas) : brève
  sur green flag, longue et saccadée sur red flag, en écho au buzzer.
- **Réactivité** — le verdict part sur `pointerdown`, pas sur `click`.
- **Logo** — un drapeau dont l'oriflamme est coupée net en deux, vert côté hampe
  et rouge à la volée : les deux verdicts dans un seul signe. La signature reprend
  la coupure sur le nom — they·**fl**·**ag**·us. La géométrie de
  `components/Logo.tsx` est celle qu'utilise `scripts/generate-icons.mjs`, donc la
  marque affichée dans l'en-tête et l'icône installée sur l'écran d'accueil sont
  strictement le même dessin.
- **Icônes** — jeu d'icônes lucide (aucun emoji) ; icônes d'application générées
  depuis un SVG vectoriel, avec variantes *maskable* pour Android et
  `apple-touch-icon` pour iOS.
- **Accessibilité** — boutons natifs, navigation clavier (Entrée / Espace),
  annonce du verdict via `aria-live`, respect de `prefers-reduced-motion`.
