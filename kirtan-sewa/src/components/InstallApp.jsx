import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share, X } from 'lucide-react';
import { isNative } from '../lib/native';
import { isIos, isStandalone } from '../lib/push';

const ANDROID_URL = import.meta.env.VITE_ANDROID_URL || '/downloads/kirtan-sewa.apk';
const IOS_URL = import.meta.env.VITE_IOS_URL || ''; // the App Store link, once the iOS app is published
const SEEN = 'sewa.installBanner';

// Chrome fires this as soon as the site is installable; it is kept so one tap on our banner opens Chrome's install dialog.
let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn());
  });
}

/** Shown as soon as the site opens in a browser (never inside the app or an installed home-screen app). */
export default function InstallApp() {
  const [target, setTarget] = useState(null);
  const [gone, setGone] = useState(() => {
    try {
      return !!sessionStorage.getItem(SEEN);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isNative || isStandalone() || gone) return;
    let apk = false;
    const pick = () => {
      if (deferred) setTarget({ kind: 'prompt', label: 'Install app' });
      else if (isIos()) setTarget(IOS_URL ? { kind: 'link', url: IOS_URL, label: 'Get the app' } : { kind: 'ios', label: 'How to install' });
      else if (apk) setTarget({ kind: 'link', url: ANDROID_URL, label: 'Download app', download: true });
      else setTarget(null);
    };
    listeners.add(pick);
    pick();
    if (!isIos() && /android/i.test(navigator.userAgent)) {
      fetch(ANDROID_URL, { method: 'HEAD' })
        .then((r) => {
          apk = r.ok && /android\.package-archive|octet-stream/.test(r.headers.get('content-type') || '');
          pick();
        })
        .catch(() => {});
    }
    return () => listeners.delete(pick);
  }, [gone]);

  const close = () => {
    try {
      sessionStorage.setItem(SEEN, '1');
    } catch {
      /* ignore */
    }
    setGone(true);
    setTarget(null);
  };

  const act = async () => {
    if (target.kind === 'prompt' && deferred) {
      const e = deferred;
      deferred = null;
      e.prompt();
      await e.userChoice.catch(() => {});
      close();
    } else if (target.kind === 'ios') {
      setTarget({ kind: 'ios-help' });
    } else close();
  };

  return (
    <AnimatePresence>
      {target && (
        <motion.div className="install-app" initial={{ y: '120%' }} animate={{ y: 0 }} exit={{ y: '120%' }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <span className="brand-mark gurmukhi">ੴ</span>
          {target.kind === 'ios-help' ? (
            <div className="install-text">
              <strong>Install on iPhone</strong>
              <span>
                Tap <Share size={12} style={{ verticalAlign: '-2px' }} /> Share, then “Add to Home Screen”
              </span>
            </div>
          ) : (
            <>
              <div className="install-text">
                <strong>Kirtan Sewa app</strong>
                <span>Install it for a faster, smoother experience</span>
              </div>
              {target.kind === 'link' ? (
                <a className="btn btn-primary btn-sm" href={target.url} download={target.download ? '' : undefined} onClick={close}>
                  <Download size={16} /> {target.label}
                </a>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={act}>
                  <Download size={16} /> {target.label}
                </button>
              )}
            </>
          )}
          <button className="icon-btn" onClick={close} aria-label="Not now">
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
