import { isNative, platform } from './native';

/** One-time setup inside the Android / iOS app: status bar, splash screen, Android back button. */
export async function initNative() {
  if (!isNative) return;
  document.documentElement.classList.add('native', `native-${platform}`);
  try {
    const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
      import('@capacitor/app'),
    ]);
    // The app is dark by default; the status bar follows the theme set on <html>.
    const sync = () => StatusBar.setStyle({ style: document.documentElement.dataset.theme === 'light' ? Style.Light : Style.Dark }).catch(() => {});
    sync();
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // Android: the back button goes back in the app's history, and leaves the app from the first screen.
    App.addListener('backButton', ({ canGoBack }) => (canGoBack ? window.history.back() : App.exitApp()));
    // Hide the native splash once the web page has painted (the site's own preloader takes over).
    requestAnimationFrame(() => SplashScreen.hide().catch(() => {}));
  } catch {
    /* plugins unavailable: the app still works */
  }
}
