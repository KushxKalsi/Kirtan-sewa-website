import { RENDER_RATE, renderString } from './tanpuraVoice';

// Renders tanpura strings off the main thread, so the page never stutters while a new scale is prepared.
self.onmessage = ({ data }) => {
  const samples = renderString(data.freq, data.variant);
  self.postMessage({ id: data.id, samples, rate: RENDER_RATE }, [samples.buffer]);
};
