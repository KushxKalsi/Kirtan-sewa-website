import { Link } from 'react-router-dom';
import { GurbaniReadingExtras } from './GurbaniDisplay';
import GurbaniText from './GurbaniText';

export default function GurbaniShabadLink({ line, context, onClick, previewScript }) {
  const search = new URLSearchParams(context);
  search.set('line', line.id);
  if (line.book === 'dasam') search.set('book', line.book);
  return (
    <Link className="gurbani-result" to={`/gurbani/shabad/${line.shabadId}?${search}`} onClick={onClick}>
      <span className="gurbani-result-ang">
        {line.book === 'dasam' ? `${previewScript ? 'Dasam' : 'Sri Dasam Granth'} · Panna` : 'Ang'} {line.ang}
      </span>
      {previewScript !== 'roman' && <span lang="pa-Guru" className="gurmukhi gurbani-verse"><GurbaniText text={line.text} /></span>}
      {previewScript !== 'gurmukhi' && <span className="gurbani-roman" lang="pa-Latn"><GurbaniText text={line.roman} /></span>}
      <GurbaniReadingExtras id={line.id} roman={line.roman} romanShown={previewScript !== 'gurmukhi'} />
    </Link>
  );
}
