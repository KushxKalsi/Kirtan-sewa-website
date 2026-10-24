import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { lockScroll, unlockScroll } from '../lib/scroll';

export default function Modal({ open, onClose, title, subtitle, wide, size, children }) {
  useEffect(() => {
    if (!open) return;
    lockScroll();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => {
      unlockScroll();
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`modal ${wide ? 'wide' : ''} ${size || ''}`}
            data-lenis-prevent
            initial={mobile ? { y: '100%' } : { opacity: 0, y: 40, scale: 0.94 }}
            animate={mobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={mobile ? { y: '100%' } : { opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            {onClose && (
              <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            )}
            {title && <h3>{title}</h3>}
            {subtitle && <p className="modal-sub">{subtitle}</p>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
