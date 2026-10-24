let lenis = null;
export const setLenis = (instance) => {
  lenis = instance;
};
export const getLenis = () => lenis;

export function scrollToId(id, offset = -76) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.4 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' });
}

export function scrollToTop(immediate = false) {
  if (lenis) lenis.scrollTo(0, { immediate });
  else window.scrollTo({ top: 0, behavior: immediate ? 'instant' : 'smooth' });
}

export const lockScroll = () => lenis?.stop();
export const unlockScroll = () => lenis?.start();
