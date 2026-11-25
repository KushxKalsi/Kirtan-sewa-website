import { Link } from 'react-router-dom';

export default function GurbaniPage({ title, gurmukhi, subtitle, back, children }) {
  return (
    <main className="page gurbani-page">
      <div className="container gurbani-container">
        {back && <Link className="gurbani-back" to={back.to}>{back.label}</Link>}
        <header className="gurbani-header">
          {gurmukhi && <p className="gurmukhi" lang="pa-Guru">{gurmukhi}</p>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </header>
        {children}
        <p className="gurbani-credit">Gurbani text from <a href="https://github.com/shabados/database/releases/tag/4.8.7">Shabad OS</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>
      </div>
    </main>
  );
}
