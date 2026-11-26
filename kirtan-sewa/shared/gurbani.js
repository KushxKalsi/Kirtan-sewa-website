export const GURBANI_BOOKS = {
  sggs: { title: 'Sri Guru Granth Sahib Ji', pageLabel: 'Ang', lastAng: 1430, route: 'ang' },
  dasam: { title: 'Sri Dasam Granth', pageLabel: 'Panna', lastAng: 1428, route: 'dasam' },
};

export const ASA_DI_VAAR_PAATH_ID = 13;

export function isGurbaniAng(book, ang) {
  return typeof book === 'string' && Object.hasOwn(GURBANI_BOOKS, book)
    && Number.isInteger(ang) && ang >= 1 && ang <= GURBANI_BOOKS[book].lastAng;
}

export function gurbaniAngPath(book, ang) {
  return `/gurbani/read/${GURBANI_BOOKS[book].route}/${ang}`;
}
