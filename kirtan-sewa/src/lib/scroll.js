let lenis = null;
export const setLenis = (instance) => {
  lenis = instance;
};
export const getLenis = () => lenis;

// Position in the page from layout alone: a section still sliding in (transformed) must not shift the target.
const pageTop = (el) => {
  let top = 0;
  for (let node = el; node; node = node.offsetParent) top += node.offsetTop;
  return top;
};

export function scrollToId(id, offset = -76) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;
  const top = Math.max(0, pageTop(el) + offset);
  if (lenis) lenis.scrollTo(top, { duration: 1.4 });
  else window.scrollTo({ top, behavior: 'smooth' });
}

export function scrollToTop(immediate = false) {
  if (lenis) lenis.scrollTo(0, { immediate });
  else window.scrollTo({ top: 0, behavior: immediate ? 'instant' : 'smooth' });
}

export const lockScroll = () => lenis?.stop();
export const unlockScroll = () => lenis?.start();
