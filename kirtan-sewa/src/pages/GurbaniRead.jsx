import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, List } from 'lucide-react';
import { ASA_DI_VAAR_PAATH_ID, GURBANI_BOOKS, gurbaniAngPath, isGurbaniAng } from '../../shared/gurbani';
import { api } from '../lib/api';
import GurbaniText from '../components/GurbaniText';
import Modal from '../components/Modal';
import GurbaniPage from './GurbaniPage';
import { SaveAngButton } from './GurbaniPlaylists';

const READ_BACK = { to: '/gurbani/read', label: 'Back to Read' };

function useReading(load) {
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResponse({ data }); },
      (error) => { if (!controller.signal.aborted) setResponse({ error: error.message, missing: error.status === 404 }); },
    );
    return () => controller.abort();
  }, [load, attempt]);

  return {
    response,
    retry() {
      setResponse(null);
      setAttempt((count) => count + 1);
    },
  };
}

function ReadingStatus({ response, retry, message }) {
  if (!response) return <p role="status">{message}</p>;
  if (!response.error) return null;
  return <p role="alert">{response.error} {!response.missing && <button className="gurbani-text-button" type="button" onClick={retry}>Try again</button>}</p>;
}

function ReadingLines({ label, lines }) {
  const { hash, key } = useLocation();
  useEffect(() => {
    if (!/^#gurbani-line-\d+$/.test(hash)) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(hash.slice(1));
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, key, lines]);

  return (
    <article className="gurbani-shabad" aria-label={label} lang="pa-Guru">
      {lines.map((line, index) => (
        <p key={index} id={`gurbani-line-${index}`} tabIndex={-1} className="gurbani-reading-line gurmukhi gurbani-verse"><GurbaniText text={line} /></p>
      ))}
    </article>
  );
}

function ChapterPicker({ chapters, status, pageLabel, label = 'Go to chapter', onSelect }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <List size={17} aria-hidden="true" /> {label}
      </button>
      <Modal open={open} onClose={close} title={label}>
        {status}
        {chapters && (
          <ul className="gurbani-chapter-list">
            {chapters.map((chapter) => (
              <li key={`${chapter.ang || 0}:${chapter.line}`}>
                <button type="button" className="gurbani-result" onClick={() => { close(); onSelect(chapter); }}>
                  {chapter.gurmukhiTitle ? (
                    <span className="gurmukhi" lang="pa-Guru">
                      <strong>{chapter.gurmukhiTitle}</strong>
                      {chapter.gurmukhi && <> — <GurbaniText text={chapter.gurmukhi} /></>}
                    </span>
                  ) : (
                    <>
                      {chapter.title && <span>{chapter.title}</span>}
                      {chapter.gurmukhi && <span className="gurmukhi" lang="pa-Guru">{chapter.gurmukhi}</span>}
                      <span className="gurbani-result-ang">{chapter.ang ? `${pageLabel} ${chapter.ang}` : `Line ${chapter.line + 1}`}</span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

function chapterHash(line) {
  return `#gurbani-line-${line}`;
}

export function GurbaniRead() {
  const { response, retry } = useReading(api.gurbaniPaaths);
  const paaths = response?.data?.paaths;

  return (
    <GurbaniPage title="Read Gurbani" back={{ to: '/gurbani', label: 'Back to Gurbani' }}>
      <div className="gurbani-books">
        {Object.entries(GURBANI_BOOKS).map(([book, { title, lastAng, pageLabel }]) => (
          <Link key={book} className="gurbani-read-feature" to={gurbaniAngPath(book, 1)}>
            <BookOpen size={24} aria-hidden="true" />
            <span><strong>{title}</strong><span>Read all {lastAng.toLocaleString('en-IN')} {pageLabel.toLowerCase()}s</span></span>
          </Link>
        ))}
      </div>
      <section className="gurbani-read-library" aria-labelledby="gurbani-paaths-title">
        <h2 id="gurbani-paaths-title">Paaths</h2>
        <ReadingStatus response={response} retry={retry} message="Loading paaths…" />
        {paaths && (
          <ul className="gurbani-paath-list">
            {paaths.map(({ id, title, gurmukhi }) => (
              <li key={id}>
                <Link to={`/gurbani/read/paath/${id}`} className="gurbani-result">
                  <span className="gurmukhi gurbani-verse" lang="pa-Guru">{gurmukhi}</span>
                  <span className="gurbani-roman">{title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </GurbaniPage>
  );
}

export function GurbaniPaath() {
  const { id } = useParams();
  const navigate = useNavigate();
  const load = useCallback((signal) => api.gurbaniPaath(id, signal), [id]);
  const { response, retry } = useReading(load);
  const paath = response?.data;
  return (
    <GurbaniPage title={paath?.title || 'Paath'} gurmukhi={paath?.gurmukhi} back={READ_BACK} adjustableText>
      <ReadingStatus response={response} retry={retry} message="Loading paath…" />
      {paath && (
        <>
          <ReadingLines label={paath.title} lines={paath.lines} />
          <div className="gurbani-pagination gurbani-reader-footer">
            <ChapterPicker chapters={paath.chapters} label={paath.id === ASA_DI_VAAR_PAATH_ID ? 'Go to chakka' : undefined}
              onSelect={({ line }) => navigate({ hash: chapterHash(line) })} />
          </div>
        </>
      )}
    </GurbaniPage>
  );
}

function AngNavigation({ book, ang, label, footer = false, children }) {
  const { lastAng, pageLabel } = GURBANI_BOOKS[book];
  return (
    <nav className={`gurbani-pagination gurbani-ang-navigation${footer ? ' gurbani-reader-footer' : ''}`} aria-label={label}>
      {ang > 1 && <Link className="btn btn-ghost btn-sm" to={gurbaniAngPath(book, ang - 1)}>Previous {pageLabel}</Link>}
      {children}
      {ang < lastAng && <Link className="btn btn-ghost btn-sm gurbani-next-ang" to={gurbaniAngPath(book, ang + 1)}>Next {pageLabel}</Link>}
    </nav>
  );
}

export function GurbaniAng({ book }) {
  const { ang } = useParams();
  const { title, lastAng, pageLabel } = GURBANI_BOOKS[book];
  const navigate = useNavigate();
  const load = useCallback((signal) => api.gurbaniAng(ang, book, signal), [ang, book]);
  const { response, retry } = useReading(load);
  const data = response?.data;
  const loadChapters = useCallback((signal) => api.gurbaniChapters(book, signal), [book]);
  const { response: chapterResponse, retry: retryChapters } = useReading(loadChapters);

  function jumpToAng(event) {
    event.preventDefault();
    const chosenAng = Number(new FormData(event.currentTarget).get('ang'));
    if (isGurbaniAng(book, chosenAng)) navigate(gurbaniAngPath(book, chosenAng));
  }

  return (
    <GurbaniPage title={title} subtitle={data && `${pageLabel} ${data.ang} of ${lastAng}`} back={READ_BACK} adjustableText>
      <form className="gurbani-ang-form" onSubmit={jumpToAng}>
        <label htmlFor="gurbani-ang">Go to {pageLabel}</label>
        <input id="gurbani-ang" name="ang" type="number" min="1" max={lastAng} defaultValue={isGurbaniAng(book, Number(ang)) ? ang : 1} required />
        <button type="submit" className="btn btn-primary btn-sm">Go</button>
      </form>
      <ReadingStatus response={response} retry={retry} message={`Loading ${pageLabel}…`} />
      {data && (
        <>
          <AngNavigation book={book} ang={data.ang} label="Page navigation above reading">
            <SaveAngButton book={book} ang={data.ang} />
          </AngNavigation>
          <ReadingLines label={`${pageLabel} ${data.ang}`} lines={data.lines} />
          <AngNavigation book={book} ang={data.ang} label="Page navigation below reading" footer>
            <ChapterPicker chapters={chapterResponse?.data?.chapters} pageLabel={pageLabel}
              status={<ReadingStatus response={chapterResponse} retry={retryChapters} message="Loading chapters…" />}
              onSelect={({ ang: chapterAng, line }) => navigate({ pathname: gurbaniAngPath(book, chapterAng), hash: chapterHash(line) })} />
          </AngNavigation>
        </>
      )}
    </GurbaniPage>
  );
}
