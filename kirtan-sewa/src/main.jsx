import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './lib/perf'; // sets the low-end class before the first paint
import { startTranslation } from './lib/lang';
import App from './App';
import './styles/global.css';
import './styles/app.css';

startTranslation(); // Punjabi / Hindi: loads the translator before React touches the page

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
