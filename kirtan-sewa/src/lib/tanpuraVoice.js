// One tanpura string, rendered harmonic by harmonic.
//
// The numbers here were fitted to measurements of real acoustic tanpura recordings (a big tanpura with the
// jiva thread in, tuned Pa–Sa–Sa–low Sa, Sa ≈ 138 Hz). What those measurements show, and what this copies:
//   • Very little energy in the fundamentals: below ~400 Hz the sound is 20–40 dB down. The tanpura's colour
//     is a broad bright region from ~450 Hz to ~3 kHz, falling away above 4 kHz (TONE below).
//   • The jawari: right after the pluck the brightest overtone is around the 4th; within ~0.6 s it climbs to
//     the 9th–10th, holds, then drifts back down by ~2.5 s.
//   • The level doesn't simply fade: it swells by ~2 dB over the first second, then decays slowly.
//   • Between plucks the tone is steady — real tanpuras don't swirl. The movement comes from the plucks
//     (each one a little different) plus small, irregular (never regular, never cyclic) wavering of the
//     overtones: about 2 dB of fast level change, measured on steady playing.

export const RENDER_RATE = 32000;
export const RENDER_SECONDS = 8.5;
const FIT_SA = 138.59; // the recordings' Sa (≈ C#3)

// Tone curve in dB at 1/3-octave band centres (Hz), fitted so the whole drone's spectrum matches the recordings
// (within ~0.3 dB per band). The jawari band below adds its moving lift on top of this.
export const TONE = {
  hz: [56, 71, 89, 112, 141, 178, 224, 283, 356, 449, 566, 713, 898, 1131, 1425, 1796, 2263, 2851, 3592, 4525, 5702, 7184, 9050],
  db: [-14.3, -11.8, -4.3, 0, -3.6, -6.2, -6.2, -7.8, -9.1, -8.5, -6.5, -17.4, -12.9, -14.1, -5.6, -5.2, -5, -6.3, -11.5, -9.9, -13.9, -11, -40],
};

export const PARAMS = {
  jawariDb: 17.3, // how much the moving jawari band lifts the overtones it passes
  jawariFrom: 4, // overtone number where the band starts…
  jawariTo: 9.5, // …climbs to by `jawariRise` seconds…
  jawariRise: 0.6,
  jawariSettle: 6, // …and drifts back to, by ~2.5 s
  jawariWidth: 0.45, // octaves
  variety: 0.35, // octaves: each pluck's jawari band sits a little higher or lower (no two plucks alike)
  drift: 0.15, // octaves: slow, irregular drift of the band while the string rings (never a regular sweep)
  shimmer: 0.9, // depth of each overtone's own irregular wavering (natural-log units) — ~1.5 dB between plucks
  swellDb: 2, // the level rises by this much over the first second…
  decayDbPerSec: 1.7, // …then falls this fast (higher overtones a little faster)
  sa: FIT_SA, // the scale's Sa in Hz; higher scales pull the jawari band down to lower overtones…
  saFollow: 1, // …by (FIT_SA / sa) ** saFollow, so the buzz stays in about the same range of pitch (checked
  //               against a second recording with Sa ≈ 233 Hz)
};

function random(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Smooth, irregular (non-repeating) noise: random knots `spacing` s apart on average, eased between. */
function smoothNoise(rand, spacing, seconds) {
  const times = [0];
  const values = [gauss(rand)];
  while (times.at(-1) < seconds + spacing) {
    times.push(times.at(-1) + spacing * (0.55 + rand() * 0.9));
    values.push(gauss(rand));
  }
  let i = 0;
  return (t) => {
    while (times[i + 1] < t) i++;
    const f = (t - times[i]) / (times[i + 1] - times[i]);
    const e = f * f * (3 - 2 * f);
    return values[i] + (values[i + 1] - values[i]) * e;
  };
}

function gauss(rand) {
  return (rand() + rand() + rand() + rand() - 2) * 1.73;
}

function toneAt(hz, tone) {
  const { hz: xs, db } = tone;
  if (hz <= xs[0]) return db[0];
  if (hz >= xs.at(-1)) return db.at(-1);
  let i = 1;
  while (xs[i] < hz) i++;
  const f = Math.log(hz / xs[i - 1]) / Math.log(xs[i] / xs[i - 1]);
  return db[i - 1] + f * (db[i] - db[i - 1]);
}

/**
 * @param {number} freq    fundamental in Hz
 * @param {number} variant changes the random detail, so two strings at the same pitch don't sound identical
 * @returns {Float32Array} mono samples at `sr`, peak-normalised to 0.9
 */
export function renderString(freq, variant = 0, sr = RENDER_RATE, seconds = RENDER_SECONDS, tone = TONE, params = PARAMS) {
  const P = { ...PARAMS, ...params };
  const rand = random(Math.round(freq * 1000) * 31 + variant * 7919 + 17);
  const length = Math.floor(sr * seconds);
  const out = new Float32Array(length);
  const maxFreq = Math.min(10000, sr / 2 - 1500);
  const count = Math.max(1, Math.min(160, Math.floor(maxFreq / freq)));
  const block = 64;
  const blocks = Math.ceil(length / block);

  const placement = (FIT_SA / (P.sa || FIT_SA)) ** P.saFollow;

  // this pluck's own brightness, and the band's slow irregular drift
  const offset = 2 ** (P.variety * gauss(rand) * 0.5);
  const drift = smoothNoise(rand, 1.6, seconds);

  const partials = [];
  for (let k = 1; k <= count; k++) {
    const hz = k * freq;
    const phase = rand() * Math.PI * 2;
    partials.push({
      k,
      hz,
      base: 10 ** (toneAt(hz, tone) / 20),
      // decay: a little faster for higher overtones
      decay: (P.decayDbPerSec * (1 + 0.004 * k)) / 8.686,
      // each overtone's own irregular wavering
      waver: smoothNoise(rand, 0.45 + rand() * 0.5, seconds),
      depth: P.shimmer * (k < 3 ? 0.35 : 1),
      c: Math.cos(phase),
      s: Math.sin(phase),
      amp: 0,
    });
  }

  for (let b = 0; b < blocks; b++) {
    const start = b * block;
    const end = Math.min(length, start + block);
    const t = end / sr;

    // pitch: starts a few cents sharp and settles within ~0.15 s, as a plucked string does
    const bend = 2 ** ((5 * Math.exp(-t / 0.05)) / 1200);
    const attack = Math.min(1, t / 0.006);
    const swell = 10 ** ((P.swellDb * (1 - Math.exp(-t / 0.45))) / 20);

    // where the jawari band is now, in overtone numbers
    const glide = t < P.jawariRise
      ? P.jawariFrom + (P.jawariTo - P.jawariFrom) * Math.sin((Math.PI / 2) * (t / P.jawariRise))
      : P.jawariSettle + (P.jawariTo - P.jawariSettle) * Math.exp(-(t - P.jawariRise) / 0.9);
    const centre = glide * offset * 2 ** (P.drift * Math.min(1, t / 0.8) * drift(t)) * placement;
    const lift = 10 ** (P.jawariDb / 20) - 1;

    for (const p of partials) {
      if (p.hz * bend >= sr / 2) continue;
      const d = Math.log2(p.k / centre) / P.jawariWidth;
      const jawari = 1 + lift * Math.exp(-0.5 * d * d);
      const waver = Math.exp(p.depth * p.waver(t) - p.depth * p.depth * 0.5);
      const target = attack * swell * Math.exp(-p.decay * t) * p.base * jawari * waver;

      const w = (2 * Math.PI * p.hz * bend) / sr;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      const step = (target - p.amp) / (end - start);
      let { c, s, amp } = p;
      for (let n = start; n < end; n++) {
        amp += step;
        out[n] += amp * s;
        const nc = c * cw - s * sw;
        s = s * cw + c * sw;
        c = nc;
      }
      const norm = 1 / Math.hypot(c, s);
      p.c = c * norm;
      p.s = s * norm;
      p.amp = amp;
    }
  }

  // the finger itself: a short, dull thump
  const thump = Math.floor(sr * 0.015);
  let lp = 0;
  for (let n = 0; n < thump; n++) {
    lp += 0.15 * ((rand() * 2 - 1) - lp);
    out[n] += lp * 0.25 * (1 - n / thump) ** 2;
  }

  let peak = 0;
  for (let n = 0; n < length; n++) peak = Math.max(peak, Math.abs(out[n]));
  const gain = 0.9 / (peak || 1);
  const fadeFrom = length - Math.floor(sr * 0.6);
  for (let n = 0; n < length; n++) out[n] *= n < fadeFrom ? gain : gain * (1 - (n - fadeFrom) / (length - fadeFrom));
  return out;
}
