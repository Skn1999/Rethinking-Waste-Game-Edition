/**
 * Offline Web Audio API Sound Engine for "Who's Sorting?"
 * Produces warm, organic marimba/woodblock & bell tones tailored to a
 * friendly cookout atmosphere — never harsh buzzers.
 */

let audioCtx: AudioContext | null = null;
let masterBus: GainNode | null = null;

function getAudioGraph(): { ctx: AudioContext; out: AudioNode } | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    audioCtx = new Ctx();
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-16, audioCtx.currentTime);
    compressor.knee.setValueAtTime(18, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.005, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.12, audioCtx.currentTime);

    masterBus = audioCtx.createGain();
    masterBus.gain.setValueAtTime(0.85, audioCtx.currentTime);

    masterBus.connect(compressor);
    compressor.connect(audioCtx.destination);
  }

  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }

  return masterBus ? { ctx: audioCtx, out: masterBus } : null;
}

/**
 * Call inside a click/keypress handler to unlock the browser AudioContext.
 */
export function unlockAudio(): void {
  getAudioGraph();
}

/**
 * Helper to synthesize a warm marimba/bell-like plucked tone with gentle overtone.
 */
function playOrganicTone(
  ctx: AudioContext,
  out: AudioNode,
  options: {
    freq: number;
    endFreq?: number;
    startTime: number;
    duration: number;
    peakGain: number;
    type?: OscillatorType;
    overtoneRatio?: number;
    overtoneGain?: number;
    lowpassHz?: number;
  }
): void {
  const {
    freq,
    endFreq,
    startTime,
    duration,
    peakGain,
    type = 'sine',
    overtoneRatio,
    overtoneGain = 0.25,
    lowpassHz,
  } = options;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  let destination: AudioNode = env;
  if (lowpassHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpassHz, startTime);
    filter.connect(env);
    destination = filter;
  }

  env.connect(out);

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (endFreq && endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration * 0.75);
  }
  osc.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);

  if (overtoneRatio) {
    const overOsc = ctx.createOscillator();
    const overEnv = ctx.createGain();
    overOsc.type = 'sine';
    overOsc.frequency.setValueAtTime(freq * overtoneRatio, startTime);
    overEnv.gain.setValueAtTime(0.0001, startTime);
    overEnv.gain.linearRampToValueAtTime(peakGain * overtoneGain, startTime + 0.006);
    overEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.55);

    overOsc.connect(overEnv);
    overEnv.connect(out);
    overOsc.start(startTime);
    overOsc.stop(startTime + duration * 0.6 + 0.02);
  }
}

/**
 * Soft wooden wheel tick during the 2.5s slot-machine number roll.
 * Pitch gently ascends as the roll slows toward the chosen guest.
 */
export function playRollTick(progress = 0): void {
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, out } = graph;
  const now = ctx.currentTime;
  const clamped = Math.min(1, Math.max(0, progress));
  const freq = 440 + clamped * 240;

  playOrganicTone(ctx, out, {
    freq,
    endFreq: freq * 0.72,
    startTime: now,
    duration: 0.042,
    peakGain: 0.11,
    type: 'triangle',
    lowpassHz: 1800,
  });
}

/**
 * Celebratory crisp sparkle played when a new guest number is drawn / locked in.
 */
export function playNumberDrawn(): void {
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, out } = graph;
  const now = ctx.currentTime;

  // Quick tactile pop + uplifting fifth chime (G5 -> D6)
  playOrganicTone(ctx, out, {
    freq: 587.33, // D5
    startTime: now,
    duration: 0.22,
    peakGain: 0.14,
    type: 'triangle',
    overtoneRatio: 2,
    overtoneGain: 0.2,
    lowpassHz: 2400,
  });
  playOrganicTone(ctx, out, {
    freq: 880, // A5
    startTime: now + 0.065,
    duration: 0.36,
    peakGain: 0.16,
    type: 'sine',
    overtoneRatio: 2,
    overtoneGain: 0.18,
  });
}

/**
 * Uplifting warm marimba/bell triad for a correct sorting guess.
 */
export function playCorrectGuess(): void {
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, out } = graph;
  const now = ctx.currentTime;

  const notes = [
    { freq: 523.25, delay: 0, dur: 0.32, gain: 0.14 }, // C5
    { freq: 659.25, delay: 0.075, dur: 0.34, gain: 0.15 }, // E5
    { freq: 783.99, delay: 0.15, dur: 0.42, gain: 0.16 }, // G5
    { freq: 1046.5, delay: 0.225, dur: 0.56, gain: 0.14 }, // C6 sparkle
  ];

  notes.forEach((n) => {
    playOrganicTone(ctx, out, {
      freq: n.freq,
      startTime: now + n.delay,
      duration: n.dur,
      peakGain: n.gain,
      type: 'sine',
      overtoneRatio: 2,
      overtoneGain: 0.22,
    });
  });
}

/**
 * Friendly, cheeky soft descending wood-bonk for a wrong guess — never harsh.
 */
export function playWrongGuess(): void {
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, out } = graph;
  const now = ctx.currentTime;

  playOrganicTone(ctx, out, {
    freq: 349.23, // F4
    endFreq: 329.63, // E4 subtle soften
    startTime: now,
    duration: 0.22,
    peakGain: 0.14,
    type: 'triangle',
    lowpassHz: 950,
  });

  playOrganicTone(ctx, out, {
    freq: 277.18, // C#4
    endFreq: 246.94, // B3 warm droop
    startTime: now + 0.12,
    duration: 0.36,
    peakGain: 0.15,
    type: 'triangle',
    lowpassHz: 850,
  });
}

/**
 * Clean single resonant bell for Open Discussion reveals or unpicked answers.
 */
export function playNeutralReveal(): void {
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, out } = graph;
  const now = ctx.currentTime;

  playOrganicTone(ctx, out, {
    freq: 523.25, // C5
    startTime: now,
    duration: 0.38,
    peakGain: 0.13,
    type: 'sine',
    overtoneRatio: 1.5, // gentle fifth harmonic
    overtoneGain: 0.25,
  });
}

/**
 * Subtle low woodblock pulse for the final 5 seconds of the countdown timer.
 */
export function playTimerWarningTick(): void {
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, out } = graph;
  const now = ctx.currentTime;

  playOrganicTone(ctx, out, {
    freq: 620,
    endFreq: 480,
    startTime: now,
    duration: 0.055,
    peakGain: 0.08,
    type: 'triangle',
    lowpassHz: 1400,
  });
}

// Backwards-compatible aliases
export const playDrawLand = playNumberDrawn;

export function playRevealChime(
  outcome: 'correct' | 'wrong' | 'neutral' = 'neutral'
): void {
  if (outcome === 'correct') {
    playCorrectGuess();
  } else if (outcome === 'wrong') {
    playWrongGuess();
  } else {
    playNeutralReveal();
  }
}
