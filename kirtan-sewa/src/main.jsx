import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './lib/perf'; // sets the low-end class before the first paint
import App from './App';
import { initNative } from './lib/nativeInit';
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
