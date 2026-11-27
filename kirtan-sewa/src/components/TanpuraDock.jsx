import { Link } from 'react-router-dom';
import { Music2, Square } from 'lucide-react';
import { stopTanpura, useTanpuraPlayer } from '../lib/tanpuraPlayer';

/** While the tanpura plays and its tab isn't on screen, a small player floats on every page so it can be stopped. */
export default function TanpuraDock() {
  const { playing, label, panelOpen } = useTanpuraPlayer();
  if (!playing || panelOpen) return null;
  return (
    <div className="tanpura-dock" role="region" aria-label="Tanpura playing">
      <Link to="/team?tab=tanpura" className="tanpura-dock-open" title="Open the tanpura">
        <Music2 size={16} aria-hidden="true" />
        <span>
          <strong>Tanpura</strong> {label}
        </span>
        <i className="tanpura-dock-dot" aria-hidden="true" />
      </Link>
      <button type="button" className="tanpura-dock-stop" onClick={stopTanpura} aria-label="Stop tanpura">
        <Square size={13} fill="currentColor" />
      </button>
    </div>
  );
}
