// A tanpura drone made in the browser with the Web Audio API — no audio files to download.
// Each string is a plucked-string (Karplus–Strong) sample with a little "jawari" buzz, played in the
// usual four-string cycle: first string (Pa / Ma / Ni), two middle Sa strings, then the low Sa.

export const SCALES = [
  { id: 0, name: 'C', harmonium: 'Safed 1' },
  { id: 1, name: 'C#', harmonium: 'Kali 1' },
  { id: 2, name: 'D', harmonium: 'Safed 2' },
  { id: 3, name: 'D#', harmonium: 'Kali 2' },
  { id: 4, name: 'E', harmonium: 'Safed 3' },
  { id: 5, name: 'F', harmonium: 'Safed 4' },
  { id: 6, name: 'F#', harmonium: 'Kali 3' },
  { id: 7, name: 'G', harmonium: 'Safed 5' },
  { id: 8, name: 'G#', harmonium: 'Kali 4' },
  { id: 9, name: 'A', harmonium: 'Safed 6' },
  { id: 10, name: 'A#', harmonium: 'Kali 5' },
  { id: 11, name: 'B', harmonium: 'Safed 7' },
];

// The first string, as a ratio of the middle Sa (all tuned in the lower octave).
export const FIRST_STRING = {
  pa: { label: 'Pa', ratio: 3 / 4 },
  ma: { label: 'Ma', ratio: 2 / 3 },
  ni: { label: 'Ni', ratio: 15 / 16 },
};

export const OCTAVES = {
  2: 'Low',
  3: 'Medium',
  4: 'High',
};

export const DEFAULTS = { scale: 1, octave: 3, first: 'pa', cycle: 4.4, volume: 0.8, fine: 0 };

// Where each of the four plucks falls in one cycle — the low Sa is followed by a short rest.
const GAPS = [0.23, 0.21, 0.23, 0.33];
const STRING_LEVEL = [0.8, 0.72, 0.72, 1];
const STRING_CENTS = [0, -1.5, 1.5, 0]; // the two middle strings a hair apart, as on a real tanpura
const SAMPLE_SECONDS = 8;

const saFrequency = (scale, octave) => 440 * 2 ** ((scale - 9) / 12 + (octave - 4));

export function stringFrequencies({ scale, octave, first }) {
  const sa = saFrequency(scale, octave);
  return [sa * FIRST_STRING[first].ratio, sa, sa, sa / 2];
}

/** One plucked string as an AudioBuffer, plus the playback rate that puts it exactly on `freq`. */
function pluck(ctx, freq) {
  const sr = ctx.sampleRate;
  const blend = 0.1; // how much the loop filter smooths — lower keeps the string brighter for longer
  const period = Math.max(4, Math.round(sr / freq));
  const loss = 0.001 ** (1 / ((sr / period) * 22)); // a long ring, the same whatever the pitch
  const jawari = 0.2;
  const length = Math.floor(sr * SAMPLE_SECONDS);
  const buffer = ctx.createBuffer(1, length, sr);
  const out = buffer.getChannelData(0);
  const line = new Float32Array(period);

  // A soft pluck: slightly smoothed noise, then without its DC.
  let smooth = 0;
  let mean = 0;
  for (let i = 0; i < period; i++) {
    smooth = smooth * 0.45 + (Math.random() * 2 - 1) * 0.33;
    line[i] = smooth;
    mean += smooth / period;
  }
  for (let i = 0; i < period; i++) line[i] -= mean;

  let peak = 0;
  for (let n = 0, p = 0; n < length; n++) {
    const next = p + 1 === period ? 0 : p + 1;
    const value = line[p];
    let y = loss * (value * (1 - blend) + line[next] * blend);
    y -= jawari * y * y * y; // the bridge's buzz: a gentle bend at the peaks keeps the overtones alive
    line[p] = y;
    out[n] = value;
    if (Math.abs(value) > peak) peak = Math.abs(value);
    p = next;
  }

  const fadeFrom = Math.floor(length * 0.8);
  const gain = 0.9 / (peak || 1);
  for (let n = 0; n < length; n++) out[n] *= n < fadeFrom ? gain : gain * (1 - (n - fadeFrom) / (length - fadeFrom));

  return { buffer, rate: (freq * (period + blend)) / sr };
}

function roomImpulse(ctx) {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * 2.6);
  const impulse = ctx.createBuffer(2, length, sr);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let n = 0; n < length; n++) data[n] = (Math.random() * 2 - 1) * (1 - n / length) ** 3.2;
  }
  return impulse;
}

export class Tanpura {
  constructor(settings = DEFAULTS) {
    this.settings = { ...DEFAULTS, ...settings };
    this.ctx = null;
    this.playing = false;
    this.voices = new Set();
    this.samples = new Map();
    this.listeners = new Set();
    this.timer = null;
    this.step = 0;
    this.nextAt = 0;
    this.wakeLock = null;
    this.onVisibility = () => {
      if (document.visibilityState === 'visible' && this.playing) this.keepAwake();
    };
  }

  /** Called with (stringIndex, secondsFromNow) for every pluck, to animate the strings. */
  onPluck(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setup() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('This browser cannot play audio.');
    // On iPhone, play even when the ring/silent switch is on.
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
    const ctx = new Ctx({ latencyHint: 'playback' });
    this.ctx = ctx;
    this.bus = ctx.createGain();
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 28;
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowshelf';
    warmth.frequency.value = 220;
    warmth.gain.value = 3;
    const reverb = ctx.createConvolver();
    reverb.buffer = roomImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;

    this.bus.connect(lowCut).connect(warmth);
    warmth.connect(this.master);
    warmth.connect(reverb).connect(wet).connect(this.master);
    this.master.connect(limiter).connect(ctx.destination);
  }

  sample(freq) {
    const key = freq.toFixed(3);
    if (!this.samples.has(key)) {
      if (this.samples.size > 24) this.samples.clear();
      this.samples.set(key, pluck(this.ctx, freq));
    }
    return this.samples.get(key);
  }

  async start() {
    this.setup();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this.settings.volume, now + 0.3);
    this.step = 0;
    this.nextAt = now + 0.06;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 60);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.keepAwake();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.5);
    this.silence(0.5);
  }

  /** Tear everything down (when the page closes). */
  close() {
    this.stop();
    this.listeners.clear();
    const ctx = this.ctx;
    this.ctx = null;
    this.samples.clear();
    if (ctx) setTimeout(() => ctx.close().catch(() => {}), 700);
  }

  update(next) {
    const before = this.settings;
    this.settings = { ...before, ...next };
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.playing && next.volume !== undefined) this.master.gain.setTargetAtTime(this.settings.volume, now, 0.05);
    const retuned = ['scale', 'octave', 'first', 'fine'].some((k) => next[k] !== undefined && next[k] !== before[k]);
    if (this.playing && retuned) {
      // Let the old strings fall quiet quickly and start the cycle again in the new scale.
      this.silence(0.25);
      this.step = 0;
      this.nextAt = now + 0.18;
      this.schedule();
    }
  }

  silence(seconds) {
    const now = this.ctx.currentTime;
    for (const voice of this.voices) {
      if (voice.at > now) {
        voice.source.stop();
        this.voices.delete(voice);
        continue;
      }
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + seconds);
      voice.source.stop(now + seconds + 0.05);
    }
  }

  schedule() {
    if (!this.playing) return;
    const ctx = this.ctx;
    // Hidden tabs only run timers about once a second, so plan further ahead then.
    const ahead = document.visibilityState === 'hidden' ? 2.5 : 0.35;
    const freqs = stringFrequencies(this.settings);
    while (this.nextAt < ctx.currentTime + ahead) {
      const index = this.step;
      const at = Math.max(this.nextAt, ctx.currentTime + 0.01);
      this.play(index, freqs[index], at);
      this.listeners.forEach((fn) => fn(index, at - ctx.currentTime));
      this.nextAt += GAPS[index] * this.settings.cycle;
      this.step = (index + 1) % GAPS.length;
    }
  }

  play(index, freq, at) {
    const ctx = this.ctx;
    const { buffer, rate } = this.sample(freq);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.detune.value = this.settings.fine + STRING_CENTS[index] + (Math.random() - 0.5) * 0.8;

    const gain = ctx.createGain();
    gain.gain.value = STRING_LEVEL[index] * (0.94 + Math.random() * 0.06);

    // The jawari "sweep": a resonance that slides down through the overtones as the string rings.
    const sweep = ctx.createBiquadFilter();
    sweep.type = 'bandpass';
    sweep.Q.value = 3.5;
    sweep.frequency.setValueAtTime(Math.min(5200, freq * 28), at);
    sweep.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 5), at + 3.2);
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 0.9;

    source.connect(gain);
    source.connect(sweep).connect(sweepGain).connect(gain);
    gain.connect(this.bus);

    const voice = { source, gain, at };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      gain.disconnect();
    };
    source.start(at);
  }

  async keepAwake() {
    // Keep the screen on while it plays, so the shabad stays in front of you.
    try {
      if (!this.wakeLock && navigator.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      }
    } catch {
      /* not allowed — fine */
    }
  }
}
