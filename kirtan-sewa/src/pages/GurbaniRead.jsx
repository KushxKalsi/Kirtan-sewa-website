import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { api } from '../lib/api';
import GurbaniPage from './GurbaniPage';

const LAST_ANG = 1430;
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
  return (
    <article className="gurbani-shabad" aria-label={label} lang="pa-Guru">
      {lines.map((line, index) => <p key={index} className="gurbani-reading-line gurmukhi gurbani-verse">{line}</p>)}
    </article>
  );
}

export function GurbaniRead() {
  const { response, retry } = useReading(api.gurbaniPaaths);
  const paaths = response?.data?.paaths;

  return (
    <GurbaniPage title="Read Gurbani" back={{ to: '/gurbani', label: 'Back to Gurbani' }}>
      <Link className="gurbani-read-feature" to="/gurbani/read/ang/1">
        <BookOpen size={24} aria-hidden="true" />
        <span><strong>Sri Guru Granth Sahib Ji</strong><span>Read all {LAST_ANG.toLocaleString('en-IN')} angs</span></span>
      </Link>
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
  const load = useCallback((signal) => api.gurbaniPaath(id, signal), [id]);
  const { response, retry } = useReading(load);
  const paath = response?.data;
  return (
    <GurbaniPage title={paath?.title || 'Paath'} gurmukhi={paath?.gurmukhi} back={READ_BACK}>
      <ReadingStatus response={response} retry={retry} message="Loading paath…" />
      {paath && <ReadingLines label={paath.title} lines={paath.lines} />}
    </GurbaniPage>
  );
}

function AngNavigation({ ang, label }) {
  return (
    <nav className="gurbani-pagination gurbani-ang-navigation" aria-label={label}>
      {ang > 1 && <Link className="btn btn-ghost btn-sm" to={`/gurbani/read/ang/${ang - 1}`}>Previous Ang</Link>}
      {ang < LAST_ANG && <Link className="btn btn-ghost btn-sm gurbani-next-ang" to={`/gurbani/read/ang/${ang + 1}`}>Next Ang</Link>}
    </nav>
  );
}

export function GurbaniAng() {
  const { ang } = useParams();
  const navigate = useNavigate();
  const load = useCallback((signal) => api.gurbaniAng(ang, signal), [ang]);
  const { response, retry } = useReading(load);
  const data = response?.data;

  function jumpToAng(event) {
    event.preventDefault();
    const chosenAng = Number(new FormData(event.currentTarget).get('ang'));
    if (Number.isInteger(chosenAng) && chosenAng >= 1 && chosenAng <= LAST_ANG) navigate(`/gurbani/read/ang/${chosenAng}`);
  }

  return (
    <GurbaniPage title="Sri Guru Granth Sahib Ji" subtitle={data && `Ang ${data.ang} of ${LAST_ANG}`} back={READ_BACK}>
      <form className="gurbani-ang-form" onSubmit={jumpToAng}>
        <label htmlFor="gurbani-ang">Go to Ang</label>
        <input id="gurbani-ang" name="ang" type="number" min="1" max={LAST_ANG} defaultValue={/^\d{1,4}$/.test(ang) ? ang : 1} required />
        <button type="submit" className="btn btn-primary btn-sm">Go</button>
      </form>
      <ReadingStatus response={response} retry={retry} message="Loading Ang…" />
      {data && (
        <>
          <AngNavigation ang={data.ang} label="Ang navigation above reading" />
          <ReadingLines label={`Ang ${data.ang}`} lines={data.lines} />
          <AngNavigation ang={data.ang} label="Ang navigation below reading" />
        </>
      )}
    </GurbaniPage>
  );
}
