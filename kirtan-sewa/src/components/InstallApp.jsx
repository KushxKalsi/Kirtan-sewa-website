import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { isNative } from '../lib/native';
import { isIos, isStandalone } from '../lib/push';

const ANDROID_URL = import.meta.env.VITE_ANDROID_URL || '/downloads/kirtan-sewa.apk';
const IOS_URL = import.meta.env.VITE_IOS_URL || ''; // the App Store link, once the iOS app is published
const SEEN = 'sewa.installBanner';

// Chrome's own "Add to Home screen / install web app" prompt is replaced by this one, which offers the real app.
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', (e) => e.preventDefault());

/** On a phone's browser: offers the Android / iOS app. Never shown inside the app or an already-installed web app. */
export default function InstallApp() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (isNative || isStandalone()) return;
    try {
      if (sessionStorage.getItem(SEEN)) return;
    } catch {
      /* ignore */
    }
    const android = /android/i.test(navigator.userAgent);
    if (isIos()) {
      if (IOS_URL) setTarget({ url: IOS_URL, label: 'Get the iPhone app' });
      return;
    }
    if (!android) return;
    // Only offer the download once the app file is really on the server.
    fetch(ANDROID_URL, { method: 'HEAD' })
      .then((r) => r.ok && /android\.package-archive|octet-stream/.test(r.headers.get('content-type') || '') && setTarget({ url: ANDROID_URL, label: 'Download the Android app', download: true }))
      .catch(() => {});
  }, []);

  const close = () => {
    try {
      sessionStorage.setItem(SEEN, '1');
    } catch {
      /* ignore */
    }
    setTarget(null);
  };

  return (
    <AnimatePresence>
      {target && (
        <motion.div className="install-app" initial={{ y: '120%' }} animate={{ y: 0 }} exit={{ y: '120%' }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 1.2 }}>
          <span className="brand-mark gurmukhi">ੴ</span>
          <div className="install-text">
            <strong>Kirtan Sewa app</strong>
            <span>Get the app for a faster, smoother experience</span>
          </div>
          <a className="btn btn-primary btn-sm" href={target.url} download={target.download ? '' : undefined} onClick={close}>
            <Download size={16} /> {target.label.replace(/^(Download|Get) the /, '')}
          </a>
          <button className="icon-btn" onClick={close} aria-label="Not now">
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
