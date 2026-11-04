import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { scrollToId } from '../lib/scroll';
import { openReels } from './Reels';

/** Scroll to a section on the home page, navigating there first if needed. Posts ('gallery') opens the reels instead. */
export function useGoTo() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (id) => {
      if (id === 'gallery') {
        if (pathname === '/') openReels();
        else navigate('/', { state: { scrollTo: id, reels: true } });
        return;
      }
      if (pathname === '/') scrollToId(id);
      else navigate('/', { state: { scrollTo: id } });
    },
    [navigate, pathname],
  );
}
