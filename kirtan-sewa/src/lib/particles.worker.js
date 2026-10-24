import { createField } from './particleField';

let field = null;

self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    field = createField(data.canvas, data.options);
    return;
  }
  if (!field) return;
  if (data.type === 'resize') field.resize(data.width, data.height, data.dpr);
  else if (data.type === 'colors') field.setColors(data.colors);
  else if (data.type === 'low') field.setLow(data.low);
  else if (data.type === 'running') field.setRunning(data.running);
};
