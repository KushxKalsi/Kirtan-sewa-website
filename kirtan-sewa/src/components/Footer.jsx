import { Link } from 'react-router-dom';
import { BRAND_NAME } from '../../shared/brand';
import BrandLogo from './BrandLogo';
import { useSite } from './SiteContext';
import { useGoTo } from './useGoTo';
import { rupees } from '../lib/money';
import { canInstall, showInstall } from './InstallApp';

export default function Footer() {
  const { site } = useSite();
  const goTo = useGoTo();
  const s = site?.settings;
  const line = 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ✦ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ ✦ ';

  return (
    <footer className="footer">
      <div className="footer-marquee gurmukhi" aria-hidden="true">
        <div className="marquee-track">
          <span>{line.repeat(3)}</span>
          <span>{line.repeat(3)}</span>
        </div>
      </div>
      <div className="container footer-grid">
        <div>
          <div className="brand">
            <BrandLogo className="brand-mark" />
            <span className="brand-name">{s?.siteName || BRAND_NAME}</span>
          </div>
          <p className="footer-text">{s?.gurmukhiTagline}</p>
        </div>
        <div className="footer-links">
          <Link to="/gurbani">Gurbani</Link>
          <button onClick={() => goTo('sewa')}>Sewa</button>
          <button onClick={() => goTo('book')}>Book a date</button>
          {canInstall() && <button onClick={showInstall}>Install app</button>}
          <Link to="/account">My account</Link>
          <Link to="/login?as=team">Team login</Link>
          <Link to="/admin">Admin</Link>
        </div>
        <p className="footer-copy">
          © {new Date().getFullYear()} {s?.siteName || BRAND_NAME}. Made with sewa bhav.
        </p>
        {s?.commissionRate > 0 && (
          <p className="footer-fine">
            * A {s.commissionRate}% service commission applies to bookings above {rupees(s.commissionAbove || 0)}.
          </p>
        )}
      </div>
    </footer>
  );
}
