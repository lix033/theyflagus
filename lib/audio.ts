/**
 * Moteur audio (Web Audio API).
 * Aucun fichier son à télécharger : les sons sont générés à la volée,
 * ce qui garantit une latence quasi nulle et un fonctionnement hors ligne.
 *
 * Les deux verdicts sont tenus et ne dépassent jamais 3 secondes :
 *   — green flag : accord majeur qui s'installe et résonne ;
 *   — red flag   : buzzer grave et rêche, un refus qui dure.
 *
 * Lecture sur téléphone — trois contraintes, trois réponses :
 *
 *   1. iOS coupe la Web Audio API avec le bouton latéral silencieux (le son
 *      part dans la session « ambient »). Les éléments <audio>, eux, sonnent
 *      malgré l'interrupteur. Les deux verdicts sont donc *rendus une fois*
 *      hors ligne en WAV, puis joués par un élément <audio>.
 *   2. Le contexte audio démarre « suspended » (et repasse « interrupted » sur
 *      iOS après un appel). `resume()` est asynchrone : programmer les
 *      oscillateurs juste après, c'est les programmer dans le passé — le son
 *      est avalé. Le repli temps réel attend donc la reprise.
 *   3. Un haut-parleur de téléphone ne restitue quasiment rien sous ~500 Hz :
 *      chaque verdict porte son énergie dans la bande réellement audible.
 */

export type Verdict = "green" | "red";

/** Durée totale de chaque verdict, en secondes. Source unique : rendu + synthèse. */
export const VERDICT_DURATION: Record<Verdict, number> = { green: 2.8, red: 2.5 };

/** Le rendu hors ligne est normalisé à ce niveau crête : volume constant partout. */
const TARGET_PEAK = 0.89;
const SAMPLE_RATE = 44100;

/* ------------------------------------------------------------------ */
/*  Synthèse — partagée par le rendu hors ligne et le repli temps réel */
/* ------------------------------------------------------------------ */

type ToneOptions = {
  freq: number;
  /** Fréquence d'arrivée : dérive lente de la hauteur sur toute la durée. */
  toFreq?: number;
  start: number;
  /** Montée. */
  attack: number;
  /** Palier tenu — c'est lui qui donne sa longueur au son. */
  hold: number;
  /** Extinction. */
  release: number;
  /** Niveau relatif atteint en fin de palier (1 = tenue plate). */
  sustain?: number;
  type?: OscillatorType;
  gain?: number;
  /** Fréquence de coupure du filtre passe-bas, façonne le timbre. */
  cutoff?: number;
  q?: number;
  detune?: number;
};

function tone(context: BaseAudioContext, out: AudioNode, o: ToneOptions): void {
  const t0 = context.currentTime + o.start;
  const peak = o.gain ?? 0.2;
  const tail = peak * (o.sustain ?? 1);
  const total = o.attack + o.hold + o.release;

  const osc = context.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.toFreq) osc.frequency.exponentialRampToValueAtTime(o.toFreq, t0 + total);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t0);

  const env = context.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + o.attack);
  env.gain.exponentialRampToValueAtTime(tail, t0 + o.attack + o.hold);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + total);

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(o.cutoff ?? 6000, t0);
  filter.Q.value = o.q ?? 0.7;

  osc.connect(env).connect(filter).connect(out);
  osc.start(t0);
  osc.stop(t0 + total + 0.08);
}

/** Trémolo : module le volume d'un groupe pour donner du grain ou du souffle. */
function tremolo(
  context: BaseAudioContext,
  out: AudioNode,
  { rate, depth, duration }: { rate: number; depth: number; duration: number },
): GainNode {
  const t0 = context.currentTime;

  const vca = context.createGain();
  vca.gain.setValueAtTime(1 - depth, t0);
  vca.connect(out);

  const lfo = context.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(rate, t0);

  const lfoGain = context.createGain();
  lfoGain.gain.setValueAtTime(depth, t0);

  lfo.connect(lfoGain).connect(vca.gain);
  lfo.start(t0);
  lfo.stop(t0 + duration + 0.1);

  return vca;
}

/** Accord majeur qui s'installe, résonne, puis s'éteint. */
function playSuccess(context: BaseAudioContext, out: AudioNode): number {
  const voice = tremolo(context, out, { rate: 4.5, depth: 0.07, duration: 2.8 });

  // Nappe : Ré3 + La3, montée douce et longue tenue.
  tone(context, voice, {
    freq: 293.66,
    start: 0,
    attack: 0.18,
    hold: 1.85,
    release: 0.62,
    sustain: 0.72,
    type: "sine",
    gain: 0.13,
    cutoff: 2600,
  });
  tone(context, voice, {
    freq: 440,
    start: 0.03,
    attack: 0.22,
    hold: 1.8,
    release: 0.6,
    sustain: 0.7,
    type: "sine",
    gain: 0.1,
    cutoff: 2400,
  });
  // Ré4 : l'octave qui tient l'accord dans la bande que restitue un
  // haut-parleur de téléphone, là où Ré3 est déjà largement atténué.
  tone(context, voice, {
    freq: 587.33,
    start: 0.05,
    attack: 0.24,
    hold: 1.75,
    release: 0.6,
    sustain: 0.62,
    type: "sine",
    gain: 0.07,
    cutoff: 3200,
  });

  // Arpège de cloches : Ré5 – Fa#5 – La5 – Ré6, chacune laissée résonner.
  const bells = [587.33, 739.99, 880, 1174.66];
  bells.forEach((freq, i) => {
    tone(context, voice, {
      freq,
      start: i * 0.09,
      attack: 0.012,
      hold: 0.5,
      release: 1.25,
      sustain: 0.32,
      type: "sine",
      gain: 0.15 - i * 0.02,
      cutoff: 8000,
    });
  });

  // Voile aigu qui arrive après coup et prolonge la résonance.
  tone(context, voice, {
    freq: 1760,
    start: 0.32,
    attack: 0.45,
    hold: 0.95,
    release: 0.9,
    sustain: 0.45,
    type: "sine",
    gain: 0.035,
    cutoff: 9000,
  });

  return VERDICT_DURATION.green;
}

/** Buzzer grave et rêche, tenu : le refus qui s'impose. */
function playError(context: BaseAudioContext, out: AudioNode): number {
  // Le trémolo rapide donne le grain caractéristique du buzzer.
  const voice = tremolo(context, out, { rate: 19, depth: 0.22, duration: 2.5 });

  const ATTACK = 0.006;
  const HOLD = 1.95;
  const RELEASE = 0.3;

  // Deux dents de scie très proches : le battement crée la rugosité.
  // Coupure haute et Q modéré : ce sont les harmoniques (500 Hz – 3 kHz) qui
  // portent le buzzer sur un petit haut-parleur, la fondamentale n'y passe pas.
  tone(context, voice, {
    freq: 104,
    toFreq: 92,
    start: 0,
    attack: ATTACK,
    hold: HOLD,
    release: RELEASE,
    sustain: 0.92,
    type: "sawtooth",
    gain: 0.12,
    cutoff: 3000,
    q: 1.2,
  });
  tone(context, voice, {
    freq: 98,
    toFreq: 87,
    start: 0,
    attack: ATTACK,
    hold: HOLD,
    release: RELEASE,
    sustain: 0.92,
    type: "sawtooth",
    gain: 0.12,
    cutoff: 2800,
    q: 1.2,
    detune: -7,
  });

  // Sub : le poids en écoute au casque. Volontairement très discret — un
  // haut-parleur de téléphone n'en restitue rien, et il mangerait la marge du
  // limiteur au détriment des harmoniques, elles bien audibles.
  tone(context, voice, {
    freq: 52,
    toFreq: 46,
    start: 0,
    attack: 0.01,
    hold: HOLD,
    release: RELEASE + 0.1,
    sustain: 0.85,
    type: "square",
    gain: 0.03,
    cutoff: 320,
  });

  // Octave supérieure : la morsure qui rend le buzzer net à petit volume.
  tone(context, voice, {
    freq: 208,
    toFreq: 184,
    start: 0,
    attack: ATTACK,
    hold: HOLD,
    release: RELEASE,
    sustain: 0.8,
    type: "sawtooth",
    gain: 0.13,
    cutoff: 3800,
    q: 1,
  });

  // Deuxième octave : plein milieu de bande du haut-parleur de téléphone,
  // c'est elle qui fait exister le red flag sans casque.
  tone(context, voice, {
    freq: 416,
    toFreq: 368,
    start: 0,
    attack: ATTACK,
    hold: HOLD,
    release: RELEASE,
    sustain: 0.75,
    type: "sawtooth",
    gain: 0.09,
    cutoff: 5200,
    q: 0.9,
  });

  return VERDICT_DURATION.red;
}

/**
 * Programme un verdict sur un contexte audio quelconque, à partir de son
 * temps courant. Renvoie la durée totale du son, en secondes.
 * Séparé de `playVerdict` pour rester rendable hors ligne (rendu WAV, mesures).
 */
export function scheduleVerdict(
  context: BaseAudioContext,
  out: AudioNode,
  kind: Verdict,
): number {
  return kind === "green" ? playSuccess(context, out) : playError(context, out);
}

/** Limiteur : plusieurs oscillateurs tenus se cumulent, on évite la saturation. */
function createLimiter(context: BaseAudioContext): DynamicsCompressorNode {
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  return limiter;
}

/* ------------------------------------------------------------------ */
/*  Session audio iOS                                                  */
/* ------------------------------------------------------------------ */

type AudioSession = { type: string };

/**
 * iOS 16.4+ : réclamer la session « playback » fait sonner l'application
 * malgré le bouton latéral silencieux, et lui donne la priorité sur le mixage.
 */
function claimPlaybackSession(): void {
  if (typeof navigator === "undefined") return;
  const session = (navigator as Navigator & { audioSession?: AudioSession }).audioSession;
  if (!session || session.type === "playback") return;
  try {
    session.type = "playback";
  } catch {
    /* propriété absente ou en lecture seule : on s'appuie sur l'élément <audio> */
  }
}

/* ------------------------------------------------------------------ */
/*  Chemin principal : verdicts pré-rendus en WAV, joués par <audio>    */
/* ------------------------------------------------------------------ */

const players = new Map<Verdict, HTMLAudioElement>();
let preparing: Promise<void> | null = null;

function offlineContextCtor(): typeof OfflineAudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext ??
    null
  );
}

/** `startRendering()` rend une promesse partout sauf sur le vieux WebKit (callback). */
function startRendering(offline: OfflineAudioContext): Promise<AudioBuffer | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (buffer: AudioBuffer | null) => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };

    offline.oncomplete = (event) => done(event.renderedBuffer);

    try {
      const pending = offline.startRendering() as unknown as Promise<AudioBuffer> | undefined;
      if (pending && typeof pending.then === "function") {
        pending.then(done, () => done(null));
      }
    } catch {
      done(null);
    }

    // Filet : un rendu qui n'aboutit jamais ne doit pas bloquer le son.
    window.setTimeout(() => done(null), 4000);
  });
}

/** Normalise au niveau crête cible : même volume perçu d'un appareil à l'autre. */
function normalize(buffer: AudioBuffer): AudioBuffer {
  const samples = buffer.getChannelData(0);

  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.abs(samples[i]);
    if (value > peak) peak = value;
  }
  if (peak < 1e-4) return buffer;

  const scale = TARGET_PEAK / peak;
  for (let i = 0; i < samples.length; i += 1) samples[i] *= scale;

  return buffer;
}

/** WAV PCM 16 bits mono : le seul format que lisent tous les téléphones. */
function encodeWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // taille du bloc fmt
  view.setUint16(20, 1, true); // PCM entier
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true); // octets par seconde
  view.setUint16(32, 2, true); // alignement de bloc
  view.setUint16(34, 16, true); // bits par échantillon
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([bytes], { type: "audio/wav" });
}

async function renderVerdict(kind: Verdict): Promise<AudioBuffer | null> {
  const Ctor = offlineContextCtor();
  if (!Ctor) return null;

  const frames = Math.ceil((VERDICT_DURATION[kind] + 0.2) * SAMPLE_RATE);

  let offline: OfflineAudioContext;
  try {
    offline = new Ctor(1, frames, SAMPLE_RATE);
  } catch {
    return null;
  }

  const bus = offline.createGain();
  bus.gain.value = 1;
  bus.connect(createLimiter(offline)).connect(offline.destination);

  scheduleVerdict(offline, bus, kind);

  const rendered = await startRendering(offline);
  return rendered ? normalize(rendered) : null;
}

function createPlayer(buffer: AudioBuffer): HTMLAudioElement {
  const player = new Audio();
  player.src = URL.createObjectURL(encodeWav(buffer));
  player.preload = "auto";
  // Certains WebView Android refusent la lecture sans ces attributs.
  player.setAttribute("playsinline", "");
  player.setAttribute("webkit-playsinline", "");
  player.load();
  return player;
}

/**
 * Rend les deux verdicts et prépare leur lecteur. Idempotent, sans geste
 * utilisateur requis : à appeler au montage pour que le tout premier appui
 * dispose déjà de son fichier.
 */
export function prepareAudio(): Promise<void> {
  if (preparing) return preparing;
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return Promise.resolve();
  }

  preparing = (async () => {
    for (const kind of ["green", "red"] as const) {
      try {
        const buffer = await renderVerdict(kind);
        if (buffer) players.set(kind, createPlayer(buffer));
      } catch {
        /* rendu impossible : le repli temps réel prendra le relais */
      }
    }
  })();

  return preparing;
}

function stopPlayers(): void {
  players.forEach((player) => {
    if (player.paused) return;
    player.pause();
    try {
      player.currentTime = 0;
    } catch {
      /* média pas encore prêt */
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Repli temps réel : Web Audio API                                   */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** Verdict en cours : un nouvel appui l'interrompt au lieu de s'y superposer. */
let activeBus: GainNode | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;

    ctx = new Ctor();

    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(createLimiter(ctx)).connect(ctx.destination);

    // iOS suspend le contexte en arrière-plan et le laisse « interrupted »
    // après un appel : on le relance dès le retour au premier plan.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void resumeContext();
    });
  }

  return ctx;
}

/** Reprend le contexte s'il ne tourne pas. `resume()` est asynchrone. */
function resumeContext(): Promise<void> {
  const context = ctx;
  if (!context) return Promise.resolve();
  // « suspended » (démarrage, arrière-plan) et « interrupted » (iOS, appel).
  if (context.state === "running") return Promise.resolve();
  return context.resume().catch(() => undefined);
}

function scheduleLive(context: AudioContext, kind: Verdict): void {
  if (!master) return;

  // Un appui pendant qu'un son tient encore : on éteint le précédent en douceur.
  if (activeBus) {
    const previous = activeBus;
    const now = context.currentTime;
    previous.gain.cancelScheduledValues(now);
    previous.gain.setValueAtTime(previous.gain.value, now);
    previous.gain.linearRampToValueAtTime(0.0001, now + 0.07);
    window.setTimeout(() => previous.disconnect(), 200);
  }

  const bus = context.createGain();
  bus.gain.value = 1;
  bus.connect(master);
  activeBus = bus;

  const duration = scheduleVerdict(context, bus, kind);

  window.setTimeout(() => {
    if (activeBus === bus) activeBus = null;
    bus.disconnect();
  }, duration * 1000 + 300);
}

function playVerdictLive(kind: Verdict): void {
  const context = getContext();
  if (!context || !master) return;

  if (context.state === "running") {
    scheduleLive(context, kind);
    return;
  }

  // Programmer avant la fin de `resume()` reviendrait à programmer dans le
  // passé : le son serait avalé. On attend que l'horloge reparte.
  void resumeContext().then(() => scheduleLive(context, kind));
}

/* ------------------------------------------------------------------ */
/*  API publique                                                       */
/* ------------------------------------------------------------------ */

/**
 * À appeler sur chaque interaction utilisateur, avant le verdict : iOS et
 * Chrome démarrent le contexte audio en état « suspended », et la session
 * « playback » ne peut être réclamée que dans un geste utilisateur.
 */
export function unlockAudio(): void {
  claimPlaybackSession();
  void prepareAudio();
  getContext();
  void resumeContext();
}

export function playVerdict(kind: Verdict): void {
  claimPlaybackSession();

  const player = players.get(kind);
  if (player) {
    stopPlayers();
    try {
      player.currentTime = 0;
    } catch {
      /* média pas encore prêt : `play()` repartira du début */
    }

    const started = player.play();
    if (started && typeof started.catch === "function") {
      // Lecture refusée (hors geste utilisateur, média indisponible) :
      // la synthèse temps réel reste jouable.
      started.catch(() => playVerdictLive(kind));
    }
    return;
  }

  // Rendu pas encore prêt (tout premier appui) ou indisponible.
  playVerdictLive(kind);
  void prepareAudio();
}

/** Coupe immédiatement le verdict en cours. */
export function stopVerdict(): void {
  stopPlayers();
  if (!ctx || !activeBus) return;

  const previous = activeBus;
  activeBus = null;
  const now = ctx.currentTime;
  previous.gain.cancelScheduledValues(now);
  previous.gain.setValueAtTime(previous.gain.value, now);
  previous.gain.linearRampToValueAtTime(0.0001, now + 0.07);
  window.setTimeout(() => previous.disconnect(), 200);
}

/** Retour haptique (Android / navigateurs supportant l'API Vibration). */
export function vibrate(kind: Verdict): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    // Le red flag vibre longuement, en écho au buzzer.
    navigator.vibrate(kind === "green" ? [22] : [90, 70, 90, 70, 220]);
  } catch {
    /* certains navigateurs bloquent la vibration hors geste utilisateur */
  }
}
