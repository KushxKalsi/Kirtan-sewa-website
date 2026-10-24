import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { scrollToId } from '../lib/scroll';

/** Scroll to a section on the home page, navigating there first if needed. */
export function useGoTo() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (id) => {
      if (pathname === '/') scrollToId(id);
      else navigate('/', { state: { scrollTo: id } });
    },
    [navigate, pathname],
  );
}
