import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './lib/perf'; // sets the low-end class before the first paint
import App from './App';
import { initNative } from './lib/nativeInit';
import { isNative } from './lib/native';
import './styles/global.css';
import './styles/app.css';

initNative();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Registered on every visit so Chrome treats the site as installable (push notifications reuse it).
if ('serviceWorker' in navigator && !isNative && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
