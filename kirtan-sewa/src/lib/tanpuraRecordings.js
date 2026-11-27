// Real tanpura recordings, looped. Each file in /public/tanpura is a steady stretch of an acoustic tanpura being
// played, cut so it loops without a seam (the join is a short crossfade on the ringing just before a pluck),
// with 0.5 s to spare at each end for that crossfade.
//
// Recordings by “sankalp” on Freesound, CC BY 4.0 — trimmed, looped and re-pitched here.
// The credit is shown under the tanpura in the app, as the licence asks.
//
// sa:     the recording's own Sa, measured from its harmonics (Hz)
// start / end: the loop, in seconds into the file
// gainDb: brings every loop to the same loudness
// plucks: [seconds after `start`, string 0–3] — for lighting up the strings on screen

export const RECORDINGS = [
  {
    file: 'pa-csharp3.mp3',
    first: 'pa',
    sa: 138.681,
    start: 0.5,
    end: 19.372,
    gainDb: 7,
    source: { title: 'Acoustic Tanpura 4', url: 'https://freesound.org/s/153263/' },
    plucks: [[0, 1], [0.76, 2], [1.81, 0], [2.44, 3], [3.3, 1], [4.3, 3], [5.04, 3], [5.55, 3], [6.19, 0], [7.32, 2], [8.64, 3], [10.16, 0], [11.25, 1], [11.92, 2], [12.4, 3], [13.16, 3], [13.71, 0], [14.18, 0], [15.37, 3], [16.07, 3], [16.49, 1], [17.42, 0], [17.78, 3]],
  },
  {
    file: 'ma-csharp3.mp3',
    first: 'ma',
    sa: 138.701,
    start: 0.5,
    end: 4.778,
    gainDb: 5.6,
    source: { title: 'Acoustic Tanpura 7', url: 'https://freesound.org/s/153267/' },
    plucks: [[0, 1], [0.38, 0], [0.86, 2], [1.94, 1], [3.3, 3], [3.7, 0]],
  },
  {
    file: 'pa-asharp3.mp3',
    first: 'pa',
    sa: 235.782,
    start: 0.5,
    end: 27.912,
    gainDb: 4.9,
    source: { title: 'Acoustic Tanpura 10', url: 'https://freesound.org/s/155272/' },
    plucks: [[0, 0], [0.81, 1], [1.19, 3], [1.67, 2], [1.93, 3], [2.46, 0], [2.99, 0], [3.78, 1], [4.31, 2], [5.25, 3], [6.1, 0], [6.8, 1], [7.6, 0], [8.09, 3], [9.04, 0], [9.81, 2], [10.23, 1], [10.72, 3], [12.08, 0], [12.79, 2], [13.5, 1], [13.99, 2], [15.15, 0], [15.92, 3], [16.72, 3], [17.39, 3], [18.22, 0], [18.94, 3], [19.72, 1], [21.33, 0], [22.19, 2], [22.91, 3], [23.56, 3], [24.32, 0], [25.17, 1], [25.46, 3], [26.02, 3], [26.88, 0]],
  },
  {
    file: 'ma-asharp3.mp3',
    first: 'ma',
    sa: 235.484,
    start: 0.5,
    end: 30.072,
    gainDb: 5.7,
    source: { title: 'Acoustic Tanpura 12', url: 'https://freesound.org/s/155274/' },
    plucks: [[0, 3], [0.72, 3], [1.47, 0], [2.22, 1], [2.98, 2], [3.47, 3], [4.41, 0], [5.07, 1], [5.97, 3], [6.37, 3], [7.45, 0], [8.19, 2], [9.0, 3], [9.72, 3], [10.45, 0], [11.11, 1], [11.94, 2], [12.69, 3], [13.42, 0], [14.22, 1], [14.68, 2], [15.13, 1], [15.8, 3], [16.6, 0], [17.36, 2], [17.83, 1], [18.54, 2], [18.88, 3], [19.63, 0], [20.32, 1], [21.18, 3], [21.79, 3], [22.63, 0], [23.37, 2], [24.13, 1], [24.8, 3], [25.47, 0], [26.18, 2], [26.98, 3], [27.42, 3], [28.42, 0], [28.88, 1], [29.3, 0]],
  },
];

export const RECORDING_CREDIT = {
  author: 'sankalp',
  authorUrl: 'https://freesound.org/people/sankalp/',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  changes: 'trimmed, looped and re-pitched',
};

// Re-pitching a recording also speeds it up or slows it down, so only use one within this many semitones.
const MAX_SHIFT = 5;

/** The recording to use for a Sa (Hz) and first-string tuning, with the playback rate — or null if none fits. */
export function pickRecording(saHz, first) {
  let best = null;
  for (const rec of RECORDINGS) {
    if (rec.first !== first) continue;
    const shift = 12 * Math.log2(saHz / rec.sa);
    if (Math.abs(shift) <= MAX_SHIFT && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { rec, shift, rate: saHz / rec.sa };
  }
  return best;
}
