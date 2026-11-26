export const GURBANI_BOOKS = {
  sggs: { title: 'Sri Guru Granth Sahib Ji', gurmukhi: 'ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ', pageLabel: 'Ang', lastAng: 1430, route: 'ang' },
  dasam: { title: 'Sri Dasam Granth', gurmukhi: 'ਸ੍ਰੀ ਦਸਮ ਗ੍ਰੰਥ', pageLabel: 'Panna', lastAng: 1428, route: 'dasam' },
};

export const GURBANI_DISPLAY = {
  pa: { label: 'ਪੰਜਾਬੀ', name: 'Punjabi', lang: 'pa-Guru', translation: true },
  en: { label: 'English', name: 'English', lang: 'en', translation: true },
  es: { label: 'Español', name: 'Spanish', lang: 'es', translation: true },
  roman: { label: 'Roman', name: 'Roman', lang: 'pa-Latn' },
  deva: { label: 'देवनागरी', name: 'Devanagari', lang: 'pa-Deva' },
  shah: { label: 'شاہ مکھی', name: 'Shahmukhi', lang: 'pa-Arab', rtl: true },
};
export const GURBANI_DISPLAY_LIMIT = 2200;

export const ASA_DI_VAAR_PAATH_ID = 13;

function isGurbaniBook(book) {
  return typeof book === 'string' && Object.hasOwn(GURBANI_BOOKS, book);
}

export function isGurbaniAng(book, ang) {
  return isGurbaniBook(book)
    && Number.isInteger(ang) && ang >= 1 && ang <= GURBANI_BOOKS[book].lastAng;
}

export function isGurbaniShabadLine(book, shabadId, lineId) {
  return isGurbaniBook(book)
    && typeof shabadId === 'string' && /^[a-z0-9]{3}$/i.test(shabadId)
    && typeof lineId === 'string' && /^[a-z0-9]{4}$/i.test(lineId);
}

export function gurbaniAngPath(book, ang) {
  return `/gurbani/read/${GURBANI_BOOKS[book].route}/${ang}`;
}
