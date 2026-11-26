import { useState } from 'react';
import { Link } from 'react-router-dom';
import { readStore, writeStore } from '../lib/storage';

const TEXT_SIZE_KEY = 'sewa.gurbani.textSize';
const TEXT_SIZES = [100, 115, 130, 145, 160];

export default function GurbaniPage({ title, gurmukhi, subtitle, back, adjustableText = false, children }) {
  const [sizeIndex, setSizeIndex] = useState(() => Math.max(0, TEXT_SIZES.indexOf(readStore(TEXT_SIZE_KEY, 100))));
  const textSize = TEXT_SIZES[sizeIndex];

  function changeTextSize(next) {
    setSizeIndex(next);
    writeStore(TEXT_SIZE_KEY, TEXT_SIZES[next]);
  }

  return (
    <main className="page gurbani-page" style={adjustableText ? { '--gurbani-text-scale': textSize / 100 } : undefined}>
      <div className="container gurbani-container">
        {back && <Link className="gurbani-back" to={back.to}>{back.label}</Link>}
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
        <p className="gurbani-credit">Gurbani text from <a href="https://github.com/shabados/database/releases/tag/4.8.7">Shabad OS</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>
      </div>
    </main>
  );
}
