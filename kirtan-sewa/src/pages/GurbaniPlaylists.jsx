import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { GURBANI_BOOKS, gurbaniAngPath, isGurbaniAng, isGurbaniShabadLine } from '../../shared/gurbani';
import { useAuth } from '../components/AuthContext';
import { GurbaniReadingDisplay } from '../components/GurbaniDisplay';
import GurbaniShabadLink from '../components/GurbaniShabadLink';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import GurbaniPage from './GurbaniPage';

const SavePlaylistContext = createContext(null);

function entryKey({ book, ang, shabadId, id }) {
  return shabadId ? `${book}:${shabadId}:${id}` : `${book}:${ang}`;
}

function entryLabel(entry) {
  return entry.shabadId ? 'Shabad' : `${GURBANI_BOOKS[entry.book].pageLabel} ${entry.ang}`;
}

function pendingEntry(value) {
  const parts = (value || '').split(':');
  const [book, target, id] = parts;
  if (parts.length === 3 && isGurbaniShabadLine(book, target, id)) return { book, shabadId: target, id };
  const ang = Number(target);
  return parts.length === 2 && isGurbaniAng(book, ang) ? { book, ang } : null;
}

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
  if (entry) params.set('save', entryKey(entry));
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
        if (current?.client !== client || !current.folders) return current;
        const folders = current.folders.some(({ id }) => id === folder.id)
          ? current.folders.map((item) => item.id === folder.id ? folder : item)
          : [...current.folders, folder];
        return { client, folders };
      });
    },
    remove(id) {
      setResponse((current) => current?.client === client && current.folders
        ? { client, folders: current.folders.filter((folder) => folder.id !== id) }
        : current);
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
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  return {
    busy,
    error,
    async run(request, done) {
      setBusy(true);
      setError('');
      try {
        const { folder } = await request();
        if (mounted.current) done(folder);
      } catch (error) {
        if (mounted.current) setError(error.message);
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
  };
}

function PlaylistNameForm({ busy, initialName = '', label = 'New folder name', buttonLabel = 'Create folder', onSubmit }) {
  const id = useId();
  const [name, setName] = useState(initialName);
  return (
    <form className="gurbani-folder-form" onSubmit={(event) => {
      event.preventDefault();
      if (name.trim()) onSubmit(name.trim(), () => setName(initialName));
    }}>
      <label htmlFor={id}>{label}</label>
      <div>
        <input id={id} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>{buttonLabel}</button>
      </div>
    </form>
  );
}

function SavePlaylistForm({ client, entry, onSaved }) {
  const { response, retry } = usePlaylistFolders(client);
  const { busy, error, run } = usePlaylistAction();
  const selectId = useId();
  const shabad = Boolean(entry.shabadId);
  const saveEntry = shabad ? client.saveGurbaniShabad : client.saveGurbaniAng;
  const key = entryKey(entry);

  if (!response?.folders) return <PlaylistStatus response={response} retry={retry} />;
  return (
    <div className="gurbani-playlist-forms">
      {response.folders.length > 0 && (
        <form className="gurbani-folder-form" onSubmit={(event) => {
          event.preventDefault();
          const id = new FormData(event.currentTarget).get('folder');
          if (id) run(() => saveEntry(id, entry), onSaved);
        }}>
          <label htmlFor={selectId}>Choose a folder</label>
          <div>
            <select id={selectId} name="folder" defaultValue="" required>
              <option value="" disabled>Select a folder</option>
              {response.folders.map((folder) => {
                const entries = shabad ? (folder.shabads || []) : folder.angs;
                const saved = entries.some((item) => entryKey(item) === key);
                return <option key={folder.id} value={folder.id} disabled={saved}>{folder.name}{saved ? ' (saved)' : ''}</option>;
              })}
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Save {shabad ? 'shabad' : GURBANI_BOOKS[entry.book].pageLabel}</button>
          </div>
        </form>
      )}
      <PlaylistNameForm busy={busy} buttonLabel="Create and save" onSubmit={(name) => run(() => client.createGurbaniFolder(name, entry), onSaved)} />
      {busy && <p role="status">Saving…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function SavePlaylistButton({ entry, label, query, compact }) {
  const open = useContext(SavePlaylistContext);
  return (
    <button type="button" aria-label={label} title={compact ? label : undefined} aria-haspopup="dialog"
      className={compact ? 'icon-btn gurbani-save-shabad' : 'btn btn-ghost btn-sm'}
      onClick={() => open({ entry, query })}>
      <FolderPlus size={18} aria-hidden="true" />{!compact && label}
    </button>
  );
}

export function SaveAngButton({ book, ang }) {
  return <SavePlaylistButton entry={{ book, ang }} label={`Save ${GURBANI_BOOKS[book].pageLabel} to playlist`} />;
}

export function SaveShabadButton({ line, query, compact = false }) {
  const { book = 'sggs', shabadId, id } = line;
  return <SavePlaylistButton entry={{ book, shabadId, id }} label="Save shabad to playlist" query={query} compact={compact} />;
}

export function GurbaniPlaylistProvider({ children }) {
  const client = usePlaylistClient();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const [target, setTarget] = useState(null);
  const toast = useToast();
  const entry = target?.entry || pendingEntry(new URLSearchParams(search).get('save'));
  const bookInfo = entry && GURBANI_BOOKS[entry.book];
  const saveLabel = entry?.shabadId ? 'shabad' : bookInfo?.pageLabel || 'page';

  const close = useCallback(() => {
    setTarget(null);
    const params = new URLSearchParams(search);
    if (!params.has('save')) return;
    params.delete('save');
    navigate({ pathname, search: params.toString(), hash }, { replace: true });
  }, [pathname, search, hash, navigate]);

  return (
    <SavePlaylistContext.Provider value={setTarget}>
      {children}
      <Modal open={Boolean(entry)} onClose={close} title={`Save ${saveLabel} to playlist`}
        subtitle={entry && (entry.shabadId ? bookInfo.title : `${bookInfo.title} · ${entryLabel(entry)}`)}>
        {entry && (client ? (
          <SavePlaylistForm key={entryKey(entry)} client={client} entry={entry} onSaved={(folder) => {
            close();
            toast(`${entryLabel(entry)} saved to ${folder.name}`);
          }} />
        ) : (
          <div className="gurbani-playlist-forms">
            <p>Log in to save to your playlist folders.</p>
            <PlaylistLogin entry={entry} query={target?.query} />
          </div>
        ))}
      </Modal>
    </SavePlaylistContext.Provider>
  );
}

function PlaylistFolder({ folder, busy, onRename, onDelete, onRemove }) {
  const [open, setOpen] = useState(false);
  const entries = [...(folder.shabads || []), ...folder.angs];
  return (
    <details className="gurbani-playlist-folder" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{folder.name} <span>{entries.length} {entries.length === 1 ? 'item' : 'items'}</span></summary>
      <div className="gurbani-folder-actions">
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onRename}>
          <Pencil size={16} aria-hidden="true" /> Rename folder
        </button>
        <button type="button" className="btn btn-ghost btn-sm danger-text" disabled={busy} onClick={onDelete}>
          <Trash2 size={16} aria-hidden="true" /> Delete folder
        </button>
      </div>
      {entries.length ? (
        <GurbaniReadingDisplay ids={open ? (folder.shabads || []).map(({ id }) => id) : []} hasRoman>
          <ul className="gurbani-result-list">
            {entries.map((entry) => (
              <li className="gurbani-shabad-result" key={entryKey(entry)}>
                {entry.shabadId ? (
                  <GurbaniShabadLink line={entry} context={{ view: 'playlists' }} />
                ) : (
                  <Link className="gurbani-result" to={gurbaniAngPath(entry.book, entry.ang)}>
                    <strong>{entryLabel(entry)}</strong>
                    <span className="gurbani-roman">{GURBANI_BOOKS[entry.book].title}</span>
                  </Link>
                )}
                <button type="button" className="icon-btn" disabled={busy}
                  aria-label={`Remove ${entry.shabadId ? `“${entry.text}”` : entryLabel(entry)} from ${folder.name}`}
                  onClick={() => onRemove(entry)}>
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </GurbaniReadingDisplay>
      ) : <p>Save a shabad from search or a page from the reader.</p>}
    </details>
  );
}

function RenamePlaylistForm({ folder, client, onRenamed }) {
  const { busy, error, run } = usePlaylistAction();
  return (
    <div className="gurbani-playlist-forms">
      <PlaylistNameForm busy={busy} initialName={folder.name} label="Folder name" buttonLabel="Save name"
        onSubmit={(name) => run(() => client.renameGurbaniFolder(folder.id, name), onRenamed)} />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function GurbaniPlaylists() {
  const client = usePlaylistClient();
  const { response, retry, update, remove } = usePlaylistFolders(client);
  const { busy, error, run } = usePlaylistAction();
  const [renaming, setRenaming] = useState(null);
  const closeRename = useCallback(() => setRenaming(null), []);

  function deleteFolder(folder) {
    if (!window.confirm(`Delete “${folder.name}” and its saved items?`)) return;
    run(() => client.deleteGurbaniFolder(folder.id), () => remove(folder.id));
  }

  function removeEntry(folder, entry) {
    const removeSaved = entry.shabadId ? client.removeGurbaniShabad : client.removeGurbaniAng;
    run(() => removeSaved(folder.id, entry), update);
  }

  return (
    <GurbaniPage title="Gurbani playlists" back={{ to: '/gurbani', label: 'Back to Gurbani' }} adjustableText>
      {!client ? (
        <section className="gurbani-search-library gurbani-playlist-forms">
          <p>Log in to open your saved shabads and pages.</p>
          <PlaylistLogin />
        </section>
      ) : (
        <section className="gurbani-search-library gurbani-playlist-forms" aria-label="Playlist folders">
          <PlaylistStatus response={response} retry={retry} />
          {response?.folders && (
            <>
              <PlaylistNameForm busy={busy} onSubmit={(name, reset) => run(() => client.createGurbaniFolder(name), (folder) => {
                update(folder);
                reset();
              })} />
              {busy && <p role="status">Saving…</p>}
              {error && <p role="alert">{error}</p>}
              {response.folders.length === 0 && <p>Your playlist folders will appear here.</p>}
              {response.folders.map((folder) => (
                <PlaylistFolder key={folder.id} folder={folder} busy={busy} onRename={() => setRenaming(folder)}
                  onDelete={() => deleteFolder(folder)} onRemove={(entry) => removeEntry(folder, entry)} />
              ))}
            </>
          )}
        </section>
      )}
      <Modal open={Boolean(renaming && client)} onClose={closeRename} title="Rename folder">
        {renaming && client && (
          <RenamePlaylistForm key={renaming.id} folder={renaming} client={client} onRenamed={(folder) => {
            update(folder);
            closeRename();
          }} />
        )}
      </Modal>
    </GurbaniPage>
  );
}
