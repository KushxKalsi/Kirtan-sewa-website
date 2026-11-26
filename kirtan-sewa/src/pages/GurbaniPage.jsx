import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Folder, History, Menu, Search, Star, X } from 'lucide-react';
import { GurbaniLanguageButton } from '../components/GurbaniDisplay';
import { readStore, writeStore } from '../lib/storage';

const TEXT_SIZE_KEY = 'sewa.gurbani.textSize';
const TEXT_SIZES = [100, 115, 130, 145, 160];

function GurbaniNavigation({ onNavigate }) {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const searchPage = pathname === '/gurbani/search';
  const view = params.get('view');
  const searchParams = new URLSearchParams();
  for (const key of ['q', 'page']) {
    if (params.has(key)) searchParams.set(key, params.get(key));
  }
  const active = searchPage ? (view === 'history' || view === 'favourites' ? view : 'search') : pathname.split('/')[2];
  const filterLink = (view) => {
    const next = new URLSearchParams(searchParams);
    if (view) next.set('view', view);
    return { pathname: '/gurbani/search', search: next.toString() };
  };

  return (
    <nav className="gurbani-sidebar-links" aria-label="Gurbani library">
      {[
        ['read', 'Read', BookOpen, '/gurbani/read'],
        ['search', 'Search', Search, filterLink()],
        ['history', 'History', History, filterLink('history')],
        ['playlists', 'Playlists', Folder, '/gurbani/playlists'],
        ['favourites', 'Favourites', Star, filterLink('favourites')],
      ].map(([id, label, Icon, to]) => (
        <Link key={id} to={to} onClick={onNavigate} aria-current={active === id ? 'page' : undefined}>
          <Icon size={18} aria-hidden="true" /> {label}
        </Link>
      ))}
      <GurbaniLanguageButton sidebar onOpen={onNavigate} />
    </nav>
  );
}

export default function GurbaniPage({ title, gurmukhi, subtitle, back, adjustableText = false, children }) {
  const [sizeIndex, setSizeIndex] = useState(() => Math.max(0, TEXT_SIZES.indexOf(readStore(TEXT_SIZE_KEY, 100))));
  const textSize = TEXT_SIZES[sizeIndex];
  const drawer = useRef(null);
  const closeDrawer = () => drawer.current?.close();

  function changeTextSize(next) {
    setSizeIndex(next);
    writeStore(TEXT_SIZE_KEY, TEXT_SIZES[next]);
  }

  return (
    <main className="page gurbani-page" style={adjustableText ? { '--gurbani-text-scale': textSize / 100 } : undefined}>
      <div className="container gurbani-layout">
        <aside className="gurbani-sidebar"><GurbaniNavigation /></aside>
        <dialog ref={drawer} className="gurbani-drawer" aria-label="Gurbani library" onClick={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
          <div className="gurbani-drawer-inner">
            <header><strong>Gurbani</strong><button type="button" className="icon-btn" aria-label="Close Gurbani sidebar" onClick={closeDrawer}><X size={20} aria-hidden="true" /></button></header>
            <GurbaniNavigation onNavigate={closeDrawer} />
          </div>
        </dialog>
        <div className="gurbani-container">
          <div className="gurbani-topbar">
            <button type="button" className="btn btn-ghost btn-sm gurbani-sidebar-toggle" aria-label="Open Gurbani sidebar" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}>
              <Menu size={20} aria-hidden="true" />
            </button>
            {back && <Link className="gurbani-back" to={back.to}>{back.label}</Link>}
            <GurbaniLanguageButton />
          </div>
          <header className="gurbani-header">
            {gurmukhi && <p className="gurmukhi" lang="pa-Guru">{gurmukhi}</p>}
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </header>
          {adjustableText && (
            <div className="gurbani-text-size" role="group" aria-label="Gurbani text size">
              <span>Text size</span>
              <button className="btn btn-ghost btn-sm" type="button" aria-label="Decrease text size" disabled={sizeIndex === 0} onClick={() => changeTextSize(sizeIndex - 1)}>A−</button>
              <span className="gurbani-text-size-value" aria-live="polite">{textSize}%</span>
              <button className="btn btn-ghost btn-sm" type="button" aria-label="Increase text size" disabled={sizeIndex === TEXT_SIZES.length - 1} onClick={() => changeTextSize(sizeIndex + 1)}>A+</button>
            </div>
          )}
          {children}
          <p className="gurbani-credit">Gurbani and reading editions from <a href="https://github.com/shabados/database/releases/tag/4.8.7">Shabad OS</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>
        </div>
      </div>
    </main>
  );
}
