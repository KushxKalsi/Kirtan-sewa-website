const PAUSE_MARK = /([^\s.,;]+)([.,;])(?=\s|$)|(^|\s)\.([^\s.,;]+)(?=\s|$)/gu;
const PAUSE_TYPES = { ',': 'comma', '.': 'period', ';': 'semicolon' };

export default function GurbaniText({ text }) {
  if (!text || !/[.,;]/u.test(text)) return text;

  const parts = [];
  let end = 0;
  for (const match of text.matchAll(PAUSE_MARK)) {
    const [token, wordBefore, punctuation, space, wordAfter] = match;
    const pause = PAUSE_TYPES[punctuation ?? '.'];
    parts.push(
      text.slice(end, match.index),
      space,
      <mark className="gurbani-pause-word" data-pause={pause} key={match.index}>{wordBefore ?? wordAfter}</mark>,
    );
    end = match.index + token.length;
  }
  return parts.length ? [...parts, text.slice(end)] : text;
}
