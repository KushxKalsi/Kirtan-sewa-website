import { createContext, useCallback, useContext, useEffect, useId, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { FolderPlus, Trash2 } from 'lucide-react';
import { GURBANI_BOOKS, gurbaniAngPath, isGurbaniAng } from '../../shared/gurbani';
import { useAuth } from '../components/AuthContext';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import GurbaniPage from './GurbaniPage';

const SaveAngContext = createContext(null);

function usePlaylistClient() {
  const { user, team } = useAuth();
  return user || team;
}

function PlaylistLogin({ entry, query }) {
  const { pathname, search, hash } = useLocation();
  const params = new URLSearchParams(search);
  if (query) {
    params.set('q', query);
    params.delete('page');
  }
  if (entry) params.set('save', `${entry.book}:${entry.ang}`);
  const next = pathname + (params.size ? `?${params}` : '') + hash;
  return <Link className="btn btn-primary btn-sm" to={`/login?${new URLSearchParams({ next })}`}>Log in</Link>;
}

function usePlaylistFolders(client) {
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    client.gurbaniFolders(controller.signal).then(
      ({ folders }) => { if (!controller.signal.aborted) setResponse({ client, folders }); },
      (error) => { if (!controller.signal.aborted) setResponse({ client, error: error.message }); },
    );
    return () => controller.abort();
  }, [client, attempt]);

  return {
    response: response?.client === client ? response : null,
    retry() {
      setResponse(null);
      setAttempt((count) => count + 1);
    },
    update(folder) {
      setResponse((current) => {
        if (current?.client !== client) return current;
        const folders = current.folders.some(({ id }) => id === folder.id)
          ? current.folders.map((item) => item.id === folder.id ? folder : item)
          : [...current.folders, folder];
        return { client, folders };
      });
    },
  };
}

function PlaylistStatus({ response, retry }) {
  if (!response) return <p role="status">Loading playlist folders…</p>;
  if (!response.error) return null;
  return <p role="alert">{response.error} <button type="button" className="gurbani-text-button" onClick={retry}>Try again</button></p>;
}

function usePlaylistAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return {
    busy,
    error,
    async run(request, done) {
      setBusy(true);
      setError('');
      try {
        const { folder } = await request();
        done(folder);
      } catch (error) {
        setError(error.message);
      } finally {
        setBusy(false);
      }
    },
  };
}

function NewPlaylistFolder({ busy, saveAng = false, onCreate }) {
  const id = useId();
  const [name, setName] = useState('');
  return (
    <form className="gurbani-folder-form" onSubmit={(event) => {
      event.preventDefault();
      if (name.trim()) onCreate(name.trim(), () => setName(''));
    }}>
      <label htmlFor={id}>New folder name</label>
      <div>
        <input id={id} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>{saveAng ? 'Create and save' : 'Create folder'}</button>
      </div>
    </form>
  );
}

function SaveAngForm({ client, entry, onSaved }) {
  const { response, retry } = usePlaylistFolders(client);
  const { busy, error, run } = usePlaylistAction();
  const selectId = useId();

  if (!response?.folders) return <PlaylistStatus response={response} retry={retry} />;
  return (
    <div className="gurbani-playlist-forms">
      {response.folders.length > 0 && (
        <form className="gurbani-folder-form" onSubmit={(event) => {
          event.preventDefault();
          const id = new FormData(event.currentTarget).get('folder');
          if (id) run(() => client.saveGurbaniAng(id, entry), onSaved);
        }}>
          <label htmlFor={selectId}>Choose a folder</label>
          <div>
            <select id={selectId} name="folder" defaultValue="" required>
              <option value="" disabled>Select a folder</option>
              {response.folders.map((folder) => {
                const saved = folder.angs.some(({ book, ang }) => book === entry.book && ang === entry.ang);
                return <option key={folder.id} value={folder.id} disabled={saved}>{folder.name}{saved ? ' (saved)' : ''}</option>;
              })}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Save Ang</button>
          </div>
        </form>
      )}
      <NewPlaylistFolder busy={busy} saveAng onCreate={(name) => run(() => client.createGurbaniFolder(name, entry), onSaved)} />
      {busy && <p role="status">Saving…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function SaveAngButton({ book, ang, query, compact = false }) {
  const open = useContext(SaveAngContext);
  const label = compact ? `Save Ang ${ang} to playlist` : 'Save Ang to playlist';
  return (
    <button type="button" aria-label={label} title={compact ? label : undefined}
      className={compact ? 'icon-btn gurbani-save-ang' : 'btn btn-ghost btn-sm'}
      onClick={() => open({ book, ang, query })}>
      <FolderPlus size={18} aria-hidden="true" />{!compact && label}
    </button>
  );
}

export function GurbaniPlaylistProvider({ children }) {
  const client = usePlaylistClient();
  const [params, setParams] = useSearchParams();
  const [target, setTarget] = useState(null);
  const toast = useToast();
  const [book, rawAng] = (params.get('save') || '').split(':');
  const ang = Number(rawAng);
  const entry = target || (isGurbaniAng(book, ang) ? { book, ang } : null);

  const close = useCallback(() => {
    setTarget(null);
    if (params.has('save')) {
      const next = new URLSearchParams(params);
      next.delete('save');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  return (
    <SaveAngContext.Provider value={setTarget}>
      {children}
      <Modal open={Boolean(entry)} onClose={close} title="Save Ang to playlist"
        subtitle={entry && `${GURBANI_BOOKS[entry.book].title} · Ang ${entry.ang}`}>
        {entry && (client ? (
          <SaveAngForm key={`${entry.book}:${entry.ang}`} client={client} entry={{ book: entry.book, ang: entry.ang }} onSaved={(folder) => {
            close();
            toast(`Ang ${entry.ang} saved to ${folder.name}`);
          }} />
        ) : (
          <div className="gurbani-playlist-forms">
            <p>Log in to save angs to your playlist folders.</p>
            <PlaylistLogin entry={entry} query={entry.query} />
          </div>
        ))}
      </Modal>
    </SaveAngContext.Provider>
  );
}

export function GurbaniPlaylists() {
  const client = usePlaylistClient();
  const { response, retry, update } = usePlaylistFolders(client);
  const { busy, error, run } = usePlaylistAction();

  return (
    <GurbaniPage title="Gurbani playlists" back={{ to: '/gurbani', label: 'Back to Gurbani' }}>
      {!client ? (
        <section className="gurbani-search-library gurbani-playlist-forms">
          <p>Log in to open your saved angs and create playlist folders.</p>
          <PlaylistLogin />
        </section>
      ) : (
        <section className="gurbani-search-library gurbani-playlist-forms" aria-label="Playlist folders">
          <PlaylistStatus response={response} retry={retry} />
          {response?.folders && (
            <>
              <NewPlaylistFolder busy={busy} onCreate={(name, reset) => run(() => client.createGurbaniFolder(name), (folder) => {
                update(folder);
                reset();
              })} />
              {busy && <p role="status">Saving…</p>}
              {error && <p role="alert">{error}</p>}
              {response.folders.length === 0 && <p>Your playlist folders will appear here.</p>}
              {response.folders.map((folder) => (
                <details className="gurbani-playlist-folder" key={folder.id}>
                  <summary>{folder.name} <span>{folder.angs.length} {folder.angs.length === 1 ? 'Ang' : 'angs'}</span></summary>
                  {folder.angs.length ? (
                    <ul className="gurbani-result-list">
                      {folder.angs.map((entry) => (
                        <li className="gurbani-shabad-result" key={`${entry.book}:${entry.ang}`}>
                          <Link className="gurbani-result" to={gurbaniAngPath(entry.book, entry.ang)}>
                            <strong>Ang {entry.ang}</strong>
                            <span className="gurbani-roman">{GURBANI_BOOKS[entry.book].title}</span>
                          </Link>
                          <button type="button" className="icon-btn" disabled={busy} aria-label={`Remove Ang ${entry.ang} from ${folder.name}`}
                            onClick={() => run(() => client.removeGurbaniAng(folder.id, entry), update)}>
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p>Save an Ang from the reader or search results.</p>}
                </details>
              ))}
            </>
          )}
        </section>
      )}
    </GurbaniPage>
  );
}
