/**
 * Moteur audio synthétique (Web Audio API).
 * Aucun fichier son à télécharger : les sons sont générés à la volée,
 * ce qui garantit une latence quasi nulle et un fonctionnement hors ligne.
 *
 * Les deux verdicts sont tenus (≈ 2,4 s) et ne dépassent jamais 3 secondes :
 *   — green flag : accord majeur qui s'installe et résonne ;
 *   — red flag   : buzzer grave et rêche, un refus qui dure.
 */

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

    // Limiteur : plusieurs oscillateurs tenus se cumulent, on évite la saturation.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(limiter).connect(ctx.destination);
  }

  return ctx;
}

/**
 * À appeler sur la première interaction utilisateur : iOS et Chrome
 * démarrent le contexte audio en état "suspended".
 */
export function unlockAudio(): void {
  const context = getContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();
}

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

/** Accord majeur qui s'installe, résonne, puis s'éteint. ≈ 2,7 s */
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
    gain: 0.15,
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
      gain: 0.14 - i * 0.02,
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

  return 2.8;
}

/** Buzzer grave et rêche, tenu : le refus qui s'impose. ≈ 2,4 s */
function playError(context: BaseAudioContext, out: AudioNode): number {
  // Le trémolo rapide donne le grain caractéristique du buzzer.
  const voice = tremolo(context, out, { rate: 19, depth: 0.22, duration: 2.5 });

  const ATTACK = 0.006;
  const HOLD = 1.95;
  const RELEASE = 0.3;

  // Deux dents de scie très proches : le battement crée la rugosité.
  tone(context, voice, {
    freq: 104,
    toFreq: 92,
    start: 0,
    attack: ATTACK,
    hold: HOLD,
    release: RELEASE,
    sustain: 0.92,
    type: "sawtooth",
    gain: 0.15,
    cutoff: 1400,
    q: 4,
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
    gain: 0.15,
    cutoff: 1250,
    q: 4,
    detune: -7,
  });

  // Sub : le poids qui fait vibrer le téléphone.
  tone(context, voice, {
    freq: 52,
    toFreq: 46,
    start: 0,
    attack: 0.01,
    hold: HOLD,
    release: RELEASE + 0.1,
    sustain: 0.85,
    type: "square",
    gain: 0.12,
    cutoff: 320,
  });

  // Harmonique supérieure : la morsure qui rend le buzzer net à petit volume.
  tone(context, voice, {
    freq: 208,
    toFreq: 184,
    start: 0,
    attack: ATTACK,
    hold: HOLD,
    release: RELEASE,
    sustain: 0.8,
    type: "sawtooth",
    gain: 0.055,
    cutoff: 2400,
    q: 2,
  });

  return 2.5;
}

/**
 * Programme un verdict sur un contexte audio quelconque, à partir de son
 * temps courant. Renvoie la durée totale du son, en secondes.
 * Séparé de `playVerdict` pour rester rendable hors ligne (mesures, tests).
 */
export function scheduleVerdict(
  context: BaseAudioContext,
  out: AudioNode,
  kind: "green" | "red",
): number {
  return kind === "green" ? playSuccess(context, out) : playError(context, out);
}

export function playVerdict(kind: "green" | "red"): void {
  const context = getContext();
  if (!context || !master) return;

  if (context.state === "suspended") void context.resume();

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

/** Retour haptique (Android / navigateurs supportant l'API Vibration). */
export function vibrate(kind: "green" | "red"): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    // Le red flag vibre longuement, en écho au buzzer.
    navigator.vibrate(kind === "green" ? [22] : [90, 70, 90, 70, 220]);
  } catch {
    /* certains navigateurs bloquent la vibration hors geste utilisateur */
  }
}
