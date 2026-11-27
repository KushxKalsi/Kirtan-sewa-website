// A tanpura drone made in the browser with the Web Audio API. By default it plays a looped recording of a real
// tanpura (see tanpuraRecordings.js), re-pitched to the chosen scale; where no recording fits (Ni tuning, far
// octaves) or when asked to, it synthesises one instead.
// Each string is synthesised harmonic by harmonic with the tanpura's jawari buzz, its sound fitted to
// measurements of real tanpura recordings (see tanpuraVoice.js),
// in a worker, and played in the usual four-string cycle: first string (Pa / Ma / Ni), two middle Sa
// strings, then the low Sa (kharaj).

import { pickRecording } from './tanpuraRecordings';

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

// sound: 'real' plays a looped recording of a real tanpura when one fits the scale; 'synth' always synthesises.
export const DEFAULTS = { scale: 1, octave: 3, first: 'pa', cycle: 4.4, volume: 0.8, fine: 0, sound: 'real' };

// Where each of the four plucks falls in one cycle — the low Sa is followed by a short rest.
const GAPS = [0.23, 0.21, 0.23, 0.33];
const STRING_LEVEL = [0.85, 0.7, 0.7, 1];
const STRING_CENTS = [0, 0, 0, 0]; // in exact unison: detuned strings beat against each other and swirl
const STRING_PAN = [-0.28, -0.08, 0.1, 0.26];
const CACHE_LIMIT = 12;

const saFrequency = (scale, octave) => 440 * 2 ** ((scale - 9) / 12 + (octave - 4));
const LOOP_FADE = 0.35; // seconds of recording crossfaded at each loop join

/** The real recording that will play for these settings ({ rec, shift, rate }), or null when it will be synthesised. */
export function recordingFor(settings) {
  return settings.sound === 'synth' ? null : pickRecording(saFrequency(settings.scale, settings.octave), settings.first);
}

function fadeCurve(up) {
  const curve = new Float32Array(64);
  for (let i = 0; i < 64; i++) curve[i] = up ? Math.sin((i / 63) * (Math.PI / 2)) : Math.cos((i / 63) * (Math.PI / 2));
  return curve;
}
const FADE_IN = fadeCurve(true);
const FADE_OUT = fadeCurve(false);

export function stringFrequencies({ scale, octave, first }) {
  const sa = saFrequency(scale, octave);
  return [sa * FIRST_STRING[first].ratio, sa, sa, sa / 2];
}

const sampleKey = (freq, variant, sa) => `${freq.toFixed(3)}:${variant}:${sa.toFixed(3)}`;

/** Renders strings in a worker (or right here if workers aren't available). */
class Renderer {
  constructor() {
    this.cache = new Map(); // key -> Promise<{ samples, rate }>
    this.waiting = new Map();
    this.nextId = 1;
    this.worker = undefined; // made on first use
  }

  startWorker() {
    if (this.worker !== undefined) return this.worker;
    try {
      this.worker = new Worker(new URL('./tanpura.worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        this.waiting.get(data.id)?.(data);
        this.waiting.delete(data.id);
      };
    } catch {
      this.worker = null;
    }
    return this.worker;
  }

  render(freq, variant, sa) {
    const key = sampleKey(freq, variant, sa);
    if (!this.cache.has(key)) {
      if (this.cache.size >= CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value);
      const worker = this.startWorker();
      const job = worker
        ? new Promise((resolve) => {
          const id = this.nextId++;
          this.waiting.set(id, resolve);
          worker.postMessage({ id, freq, variant, sa });
        })
        : import('./tanpuraVoice').then(({ renderString, RENDER_RATE }) => ({ samples: renderString(freq, variant, undefined, undefined, undefined, { sa }), rate: RENDER_RATE }));
      this.cache.set(key, job);
    }
    return this.cache.get(key);
  }

  close() {
    this.worker?.terminate();
    this.worker = undefined;
    this.waiting.clear();
    this.cache.clear();
  }
}

function roomImpulse(ctx) {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * 2.2);
  const impulse = ctx.createBuffer(2, length, sr);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    let lp = 0;
    for (let n = 0; n < length; n++) {
      lp += 0.35 * ((Math.random() * 2 - 1) - lp); // a darker, wooden-room tail
      data[n] = lp * (1 - n / length) ** 3;
    }
  }
  return impulse;
}

export class Tanpura {
  constructor(settings = DEFAULTS) {
    this.settings = { ...DEFAULTS, ...settings };
    this.renderer = new Renderer();
    this.buffers = new Map(); // key -> AudioBuffer for this.ctx
    this.files = new Map(); // recording file -> Promise<ArrayBuffer>
    this.decoded = new Map(); // recording file -> Promise<AudioBuffer> for this.ctx
    this.mode = null; // 'real' | 'synth' while playing
    this.ctx = null;
    this.playing = false;
    this.ready = false;
    this.voices = new Set();
    this.lastVoice = [];
    this.listeners = new Set();
    this.timer = null;
    this.step = 0;
    this.nextAt = 0;
    this.tuning = 0;
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

  /** Get the four strings for these settings ready (in the background). Resolves when they are. */
  prepare(settings = this.settings) {
    const pick = recordingFor(settings);
    if (pick) return this.fetchRecording(pick.rec.file);
    const freqs = stringFrequencies(settings);
    return Promise.all(freqs.map((freq, i) => this.renderer.render(freq, i, freqs[1])));
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
    this.buffers.clear();
    this.bus = ctx.createGain();

    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 30;
    // The gourd's colour is already in the fitted strings; this only rounds off the very top.
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 9500;
    air.Q.value = 0.5;

    const reverb = ctx.createConvolver();
    reverb.buffer = roomImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 4;

    // Recordings already carry their own room, so they skip the reverb.
    this.realBus = ctx.createGain();
    this.realBus.connect(this.master);

    this.bus.connect(lowCut).connect(air);
    air.connect(this.master);
    air.connect(reverb).connect(wet).connect(this.master);
    this.master.connect(limiter).connect(ctx.destination);
  }

  buffer(freq, variant, sa, { samples, rate }) {
    const key = sampleKey(freq, variant, sa);
    if (!this.buffers.has(key)) {
      if (this.buffers.size >= CACHE_LIMIT) this.buffers.delete(this.buffers.keys().next().value);
      const buffer = this.ctx.createBuffer(1, samples.length, rate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(key, buffer);
    }
    return this.buffers.get(key);
  }

  fetchRecording(file) {
    if (!this.files.has(file)) {
      const job = fetch(`/tanpura/${file}`).then((r) => {
        if (!r.ok) throw new Error(`Could not load the tanpura recording (${r.status}).`);
        return r.arrayBuffer();
      });
      job.catch(() => this.files.delete(file)); // let a later attempt retry
      this.files.set(file, job);
    }
    return this.files.get(file);
  }

  decodeRecording(file) {
    if (!this.decoded.has(file)) {
      const ctx = this.ctx;
      const job = this.fetchRecording(file).then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data.slice(0), resolve, reject)));
      job.catch(() => this.decoded.delete(file));
      this.decoded.set(file, job);
    }
    return this.decoded.get(file);
  }

  /** Make AudioBuffers for the current settings, then (re)start the cycle. */
  async tune() {
    const token = ++this.tuning;
    this.ready = false;
    const settings = this.settings;
    const pick = recordingFor(settings);
    if (pick) {
      try {
        const buffer = await this.decodeRecording(pick.rec.file);
        if (token !== this.tuning || !this.ctx) return;
        this.mode = 'real';
        this.loop = { ...pick, buffer };
        this.realBus.gain.setValueAtTime(10 ** (pick.rec.gainDb / 20), this.ctx.currentTime);
        this.ready = true;
        this.loopNextAt = this.ctx.currentTime + 0.08;
        this.loopFirst = true;
        this.schedule();
        return;
      } catch (e) {
        console.warn('Tanpura recording unavailable, synthesising instead:', e);
        if (token !== this.tuning || !this.ctx) return;
      }
    }
    this.mode = 'synth';
    const rendered = await this.prepare({ ...settings, sound: 'synth' });
    if (token !== this.tuning || !this.ctx) return;
    const freqs = stringFrequencies(settings);
    this.strings = freqs.map((freq, i) => this.buffer(freq, i, freqs[1], rendered[i]));
    this.ready = true;
    this.step = 0;
    this.nextAt = this.ctx.currentTime + 0.08;
    this.schedule();
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
    this.timer = setInterval(() => this.schedule(), 60);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.keepAwake();
    await this.tune();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    this.ready = false;
    this.tuning++;
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.6);
    this.silence(0.6);
  }

  /** Tear everything down (when the page closes). */
  close() {
    this.stop();
    this.listeners.clear();
    this.renderer.close();
    const ctx = this.ctx;
    this.ctx = null;
    this.buffers.clear();
    if (ctx) setTimeout(() => ctx.close().catch(() => {}), 800);
  }

  update(next) {
    const before = this.settings;
    this.settings = { ...before, ...next };
    const retuned = ['scale', 'octave', 'first', 'sound'].some((k) => next[k] !== undefined && next[k] !== before[k]);
    if (!this.ctx || !this.playing) {
      if (retuned) this.prepare().catch(() => {}); // get it ready before Play is pressed
      return;
    }
    const now = this.ctx.currentTime;
    if (next.volume !== undefined) this.master.gain.setTargetAtTime(this.settings.volume, now, 0.05);
    if (next.fine !== undefined && next.fine !== before.fine) {
      for (const voice of this.voices) voice.source.detune.setTargetAtTime(this.settings.fine + voice.cents, now, 0.05);
    }
    if (retuned) {
      // Let the old strings fall quiet and start the cycle again in the new scale.
      this.silence(0.35);
      this.tune();
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
    this.lastVoice = [];
  }

  schedule() {
    if (!this.playing || !this.ready) return;
    const ctx = this.ctx;
    // Hidden tabs only run timers about once a second, so plan further ahead then.
    const ahead = document.visibilityState === 'hidden' ? 2.5 : 0.35;
    if (this.mode === 'real') {
      const { rec, rate } = this.loop;
      while (this.loopNextAt < ctx.currentTime + ahead + LOOP_FADE / rate) {
        this.playLoop(this.loopNextAt, this.loopFirst);
        this.loopFirst = false;
        this.loopNextAt += (rec.end - rec.start) / rate;
      }
      return;
    }
    while (this.nextAt < ctx.currentTime + ahead) {
      const index = this.step;
      const at = Math.max(this.nextAt, ctx.currentTime + 0.01);
      this.play(index, at);
      this.listeners.forEach((fn) => fn(index, at - ctx.currentTime));
      // a human hand: never exactly on the grid
      this.nextAt += GAPS[index] * this.settings.cycle * (0.97 + Math.random() * 0.06);
      this.step = (index + 1) % GAPS.length;
    }
  }

  /** One pass of the recorded loop, starting (its first pluck) at `at`, crossfaded with the passes either side. */
  playLoop(at, first) {
    const ctx = this.ctx;
    const { rec, rate, buffer } = this.loop;
    const fade = LOOP_FADE / rate;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.detune.value = this.settings.fine;
    const gain = ctx.createGain(); // the join crossfades
    const kill = ctx.createGain(); // only for stopping/retuning (never touched while a crossfade runs on `gain`)
    source.connect(gain).connect(kill).connect(this.realBus);

    let begins = at;
    if (first) {
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(1, at + 0.03);
      source.start(at, rec.start);
    } else {
      begins = at - fade;
      gain.gain.setValueAtTime(0, begins);
      gain.gain.setValueCurveAtTime(FADE_IN, begins, fade);
      source.start(begins, rec.start - LOOP_FADE);
    }
    const fadeOutAt = at + (rec.end - rec.start - LOOP_FADE) / rate;
    gain.gain.setValueCurveAtTime(FADE_OUT, fadeOutAt, fade);
    source.stop(fadeOutAt + fade + 0.05);

    const voice = { source, gain: kill, level: 1, cents: 0, at: begins };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      kill.disconnect();
    };
    for (const [t, index] of rec.plucks) {
      const delay = at + t / rate - ctx.currentTime;
      this.listeners.forEach((fn) => fn(index, delay));
    }
  }

  play(index, at) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.strings[index];
    const cents = STRING_CENTS[index] + (Math.random() - 0.5) * 0.2;
    source.detune.value = this.settings.fine + cents;

    const level = STRING_LEVEL[index] * (0.9 + Math.random() * 0.1);
    const gain = ctx.createGain();
    gain.gain.value = level;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = STRING_PAN[index];

    source.connect(gain);
    (pan ? gain.connect(pan) : gain).connect(this.bus);

    // Plucking a string again stops what it was still ringing, as a finger on a real string does.
    const previous = this.lastVoice[index];
    if (previous && previous.at < at) {
      previous.gain.gain.setValueAtTime(previous.level, at - 0.01);
      previous.gain.gain.linearRampToValueAtTime(0, at + 0.09);
      previous.source.stop(at + 0.12);
    }

    const voice = { source, gain, level, cents, at };
    this.voices.add(voice);
    this.lastVoice[index] = voice;
    source.onended = () => {
      this.voices.delete(voice);
      gain.disconnect();
      pan?.disconnect();
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
