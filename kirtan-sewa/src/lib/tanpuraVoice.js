// One tanpura string, rendered harmonic by harmonic.
//
// What makes a tanpura sound like a tanpura (and not a guitar) is its curved bridge, the jawari, with the
// cotton thread (jiva) under the strings. It keeps the high harmonics alive long after the pluck and makes a
// bright band of them swell up and then slide slowly downwards while the string rings — the "shimmering"
// buzz. A finger pluck on its own is soft and dark; the jawari brings the brightness in a moment later.
// So each string is built from:
//   • a soft, dark finger pluck (a few strong low harmonics, a tiny thump of noise),
//   • a jawari band that blooms in ~0.2 s and glides from ~3.3 kHz down to ~700 Hz,
//   • slow, independent wobble on every upper harmonic (the shimmer),
//   • a long ring, with the top harmonics fading a little faster than the bottom ones,
//   • the pitch settling a few cents downwards just after the pluck, as a real string does.

export const RENDER_RATE = 32000;
export const RENDER_SECONDS = 8.5;
const JAWARI = 0.5;

function random(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * @param {number} freq    fundamental in Hz
 * @param {number} variant changes the random detail, so two strings at the same pitch don't sound identical
 * @returns {Float32Array} mono samples at RENDER_RATE, peak-normalised to 0.9
 */
export function renderString(freq, variant = 0, sr = RENDER_RATE, seconds = RENDER_SECONDS) {
  const rand = random(Math.round(freq * 1000) * 31 + variant * 7919 + 17);
  const length = Math.floor(sr * seconds);
  const out = new Float32Array(length);
  const maxFreq = Math.min(10000, sr / 2 - 1500);
  const count = Math.max(1, Math.min(140, Math.floor(maxFreq / freq)));
  const block = 64;
  const blocks = Math.ceil(length / block);

  // Where the finger plucks shapes which harmonics are strong (with a gentle comb of weaker ones).
  const pluckAt = 0.11 + rand() * 0.03;

  const partials = [];
  for (let k = 1; k <= count; k++) {
    const hz = k * freq;
    const finger = (0.35 + 0.65 * Math.abs(Math.sin(Math.PI * k * pluckAt))) / k ** 1.1;
    partials.push({
      k,
      hz,
      finger,
      // the jawari lifts every harmonic in its band by about the same amount, so the band reads as one bright buzz
      jawari: JAWARI / (1 + k / 45),
      // seconds for the amplitude to fall to 1/e: bottom harmonics ring longest; the jawari keeps its band alive
      tau: 3.4 / (1 + 0.02 * k) * (k === 1 ? 1.1 : 1),
      wobbleRate: 0.35 + rand() * 2.2,
      wobbleDepth: k < 3 ? 0.04 : 0.18 + rand() * 0.22,
      wobblePhase: rand() * Math.PI * 2,
      // running phasor
      c: Math.cos(rand() * Math.PI * 2),
      s: 0,
      amp: 0,
    });
  }
  for (const p of partials) p.s = Math.sqrt(1 - p.c * p.c) * (rand() < 0.5 ? -1 : 1);

  const glideFrom = 3300;
  const glideTo = 700;
  const glideTime = 6.5;
  const bandWidth = 0.55; // octaves (Gaussian sigma)

  for (let b = 0; b < blocks; b++) {
    const start = b * block;
    const end = Math.min(length, start + block);
    const t = end / sr;

    // pitch: starts ~6 cents sharp and settles within ~0.15 s
    const cents = 6 * Math.exp(-t / 0.05);
    const bend = 2 ** (cents / 1200);

    // the jawari band: blooms in, then glides down
    const bloom = 1 - Math.exp(-t / 0.18);
    const centre = glideFrom * (glideTo / glideFrom) ** Math.min(1, t / glideTime);
    const attack = Math.min(1, t / 0.004);

    for (const p of partials) {
      if (p.hz * bend >= sr / 2) continue;
      const decay = Math.exp(-t / p.tau);
      const sustain = Math.exp(-t / 3.3);
      const distance = Math.log2(p.hz / centre) / bandWidth;
      const band = Math.exp(-0.5 * distance * distance);
      const wobble = 1 + p.wobbleDepth * Math.sin(2 * Math.PI * p.wobbleRate * t + p.wobblePhase);
      const target = attack * (p.finger * decay + p.jawari * bloom * band * sustain) * wobble;

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
      // keep the phasor on the unit circle
      const norm = 1 / Math.hypot(c, s);
      p.c = c * norm;
      p.s = s * norm;
      p.amp = amp;
    }
  }

  // the finger itself: a short, dull thump
  const thump = Math.floor(sr * 0.018);
  let lp = 0;
  for (let n = 0; n < thump; n++) {
    lp += 0.12 * ((rand() * 2 - 1) - lp);
    out[n] += lp * 0.5 * (1 - n / thump) ** 2;
  }

  let peak = 0;
  for (let n = 0; n < length; n++) peak = Math.max(peak, Math.abs(out[n]));
  const gain = 0.9 / (peak || 1);
  const fadeFrom = length - Math.floor(sr * 0.6);
  for (let n = 0; n < length; n++) out[n] *= n < fadeFrom ? gain : gain * (1 - (n - fadeFrom) / (length - fadeFrom));
  return out;
}
