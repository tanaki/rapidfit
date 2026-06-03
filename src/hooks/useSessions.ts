import { useState, useEffect, useCallback } from 'react';
import type { Client, Session, Discipline, Capture, Recording, PersistedSessionState } from '../types';
import { uid } from '../utils/canvas';

interface DiskFile { name: string; path: string; createdAt: string; duration: number; }

/**
 * Encode a local file path for use as an HTTP request path.
 * Each segment is encoded individually so slashes are preserved as separators.
 * e.g. /Users/nico/My File.png → /Users/nico/My%20File.png
 */
function encodeFilePath(filePath: string): string {
  return filePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
}

interface SessionsState {
  clients: Client[];
  sessionsByClient: Record<string, Session[]>;
  activeClient: Client | null;
  activeSession: Session | null;
  isLoading: boolean;
}

type ElectronAPI = {
  getFileServerPort: () => Promise<number>;
  sessionsList: () => Promise<{ clients: Client[]; sessionsByClient: Record<string, Session[]> }>;
  sessionsCreateClient: (c: Client) => Promise<Client>;
  sessionsCreateSession: (s: Session) => Promise<Session>;
  sessionsUpdateClient: (c: Client) => Promise<Client>;
  sessionsSaveCapture: (p: { sessionFolderPath: string; filename: string; buffer: Uint8Array }) => Promise<string>;
  sessionsSaveRecording: (p: { sessionFolderPath: string; filename: string; buffer: Uint8Array; duration: number }) => Promise<string>;
  sessionsSaveState: (p: { sessionFolderPath: string; state: PersistedSessionState }) => Promise<void>;
  sessionsLoadState: (sessionFolderPath: string) => Promise<PersistedSessionState | null>;
  sessionsDeleteSession: (p: { sessionFolderPath: string }) => Promise<void>;
  sessionsDeleteClient: (p: { clientId: string; folderPath: string }) => Promise<void>;
  sessionsListCaptures: (sessionFolderPath: string) => Promise<DiskFile[]>;
  sessionsListRecordings: (sessionFolderPath: string) => Promise<DiskFile[]>;
  sessionsGetLast: () => Promise<{ clientId: string; sessionId: string } | null>;
  sessionsSetLast: (d: { clientId: string; sessionId: string } | null) => Promise<void>;
};

function getAPI(): ElectronAPI | null {
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI ?? null;
}

export function useSessions() {
  const [state, setState] = useState<SessionsState>({
    clients: [],
    sessionsByClient: {},
    activeClient: null,
    activeSession: null,
    isLoading: true,
  });

  // Port du serveur HTTP local (Electron main process) qui sert les fichiers.
  // 0 tant qu'on n'est pas en mode Electron ou que le port n'est pas encore connu.
  const [fileServerPort, setFileServerPort] = useState(0);

  useEffect(() => {
    getAPI()?.getFileServerPort().then(p => setFileServerPort(p));
  }, []);

  const load = useCallback(async () => {
    const api = getAPI();
    if (!api) {
      // Mode web sans Electron — démarrage sans session
      setState(s => ({ ...s, isLoading: false }));
      return;
    }

    const { clients, sessionsByClient } = await api.sessionsList();
    const last = await api.sessionsGetLast();

    let activeClient: Client | null = null;
    let activeSession: Session | null = null;

    if (last) {
      activeClient = clients.find(c => c.id === last.clientId) ?? null;
      activeSession = sessionsByClient[last.clientId]?.find(s => s.id === last.sessionId) ?? null;
    }

    setState({ clients, sessionsByClient, activeClient, activeSession, isLoading: false });
  }, []);

  useEffect(() => { load(); }, [load]);

  const createClient = useCallback(async (
    data: Pick<Client, 'nom' | 'prenom'> & Partial<Omit<Client, 'id' | 'createdAt' | 'folderPath'>>,
  ): Promise<Client> => {
    const api = getAPI();
    const draft: Client = {
      nom: data.nom,
      prenom: data.prenom,
      email: data.email,
      phone: data.phone,
      birthDate: data.birthDate,
      weight: data.weight,
      height: data.height,
      id: uid(),
      createdAt: new Date().toISOString(),
      folderPath: '',
    };

    if (api) {
      const saved = await api.sessionsCreateClient(draft);
      setState(s => ({
        ...s,
        clients: [...s.clients, saved],
        sessionsByClient: { ...s.sessionsByClient, [saved.id]: [] },
      }));
      return saved;
    }

    // Mode web : stockage mémoire uniquement
    setState(s => ({
      ...s,
      clients: [...s.clients, draft],
      sessionsByClient: { ...s.sessionsByClient, [draft.id]: [] },
    }));
    return draft;
  }, []);

  const createSession = useCallback(async (
    clientId: string,
    data: { discipline: Discipline; bikeFitDate: string; notes?: string },
  ): Promise<Session> => {
    const api = getAPI();
    const draft: Session = {
      id: uid(),
      clientId,
      discipline: data.discipline,
      bikeFitDate: data.bikeFitDate,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      folderPath: '',
    };

    const saved = api ? await api.sessionsCreateSession(draft) : draft;

    setState(s => ({
      ...s,
      sessionsByClient: {
        ...s.sessionsByClient,
        [clientId]: [saved, ...(s.sessionsByClient[clientId] ?? [])],
      },
    }));

    return saved;
  }, []);

  const updateClient = useCallback(async (
    updates: Partial<Omit<Client, 'id' | 'createdAt' | 'folderPath'>> & { id: string },
  ): Promise<Client> => {
    const api = getAPI();
    const existing = state.clients.find(c => c.id === updates.id)!;
    const updated: Client = { ...existing, ...updates };
    const saved = api ? await api.sessionsUpdateClient(updated) : updated;
    setState(s => ({
      ...s,
      clients: s.clients.map(c => c.id === saved.id ? saved : c),
      activeClient: s.activeClient?.id === saved.id ? saved : s.activeClient,
    }));
    return saved;
  }, [state.clients]);

  const setActiveSession = useCallback(async (client: Client, session: Session) => {
    setState(s => ({ ...s, activeClient: client, activeSession: session }));
    await getAPI()?.sessionsSetLast({ clientId: client.id, sessionId: session.id });
  }, []);

  const saveCapture = useCallback(async (
    session: Session, blob: Blob, filename: string,
  ): Promise<void> => {
    const api = getAPI();
    if (!api || !session.folderPath) return;
    const buffer = new Uint8Array(await blob.arrayBuffer());
    await api.sessionsSaveCapture({ sessionFolderPath: session.folderPath, filename, buffer });
  }, []);

  const saveRecording = useCallback(async (
    session: Session, blob: Blob, filename: string, duration: number,
  ): Promise<void> => {
    const api = getAPI();
    if (!api || !session.folderPath) return;
    const buffer = new Uint8Array(await blob.arrayBuffer());
    await api.sessionsSaveRecording({ sessionFolderPath: session.folderPath, filename, buffer, duration });
  }, []);

  const saveSessionState = useCallback(async (
    folderPath: string, state: PersistedSessionState,
  ): Promise<void> => {
    const api = getAPI();
    if (!api || !folderPath) return;
    await api.sessionsSaveState({ sessionFolderPath: folderPath, state });
  }, []);

  const loadSessionState = useCallback(async (
    folderPath: string,
  ): Promise<PersistedSessionState | null> => {
    const api = getAPI();
    if (!api || !folderPath) return null;
    return api.sessionsLoadState(folderPath);
  }, []);

  const deleteSession = useCallback(async (session: Session): Promise<boolean> => {
    const api = getAPI();
    if (api && session.folderPath) {
      await api.sessionsDeleteSession({ sessionFolderPath: session.folderPath });
    }
    let wasActive = false;
    setState(s => {
      const remaining = (s.sessionsByClient[session.clientId] ?? []).filter(x => x.id !== session.id);
      wasActive = s.activeSession?.id === session.id;
      return {
        ...s,
        sessionsByClient: { ...s.sessionsByClient, [session.clientId]: remaining },
        activeSession:  wasActive ? null : s.activeSession,
        activeClient:   wasActive && remaining.length === 0 ? null : s.activeClient,
      };
    });
    return wasActive;
  }, []);

  const deleteClient = useCallback(async (client: Client): Promise<boolean> => {
    const api = getAPI();
    if (api) {
      await api.sessionsDeleteClient({ clientId: client.id, folderPath: client.folderPath });
    }
    let wasActive = false;
    setState(s => {
      wasActive = s.activeClient?.id === client.id;
      const newSBC = { ...s.sessionsByClient };
      delete newSBC[client.id];
      return {
        ...s,
        clients: s.clients.filter(c => c.id !== client.id),
        sessionsByClient: newSBC,
        activeClient:  wasActive ? null : s.activeClient,
        activeSession: wasActive ? null : s.activeSession,
      };
    });
    return wasActive;
  }, []);

  const loadSessionAssets = useCallback(async (
    session: Session,
  ): Promise<{ captures: Capture[]; recordings: Recording[] }> => {
    const api = getAPI();
    if (!api || !session.folderPath) return { captures: [], recordings: [] };

    // Resolve the file server port — use cached value or fetch it fresh.
    // We fetch here (not only in the useEffect) to avoid a race condition where
    // loadSessionAssets is called before the port useState has been updated.
    let port = fileServerPort;
    if (!port) {
      port = await api.getFileServerPort();
      setFileServerPort(port);
    }

    const buildUrl = (filePath: string) =>
      `http://127.0.0.1:${port}${encodeFilePath(filePath)}`;

    const [captureFiles, recordingFiles] = await Promise.all([
      api.sessionsListCaptures(session.folderPath),
      api.sessionsListRecordings(session.folderPath),
    ]);

    const captures: Capture[] = captureFiles.map(f => ({
      id: f.name,
      name: f.name,
      url: buildUrl(f.path),
      createdAt: new Date(f.createdAt),
    }));

    const recordings: Recording[] = recordingFiles.map(f => ({
      id: f.name,
      name: f.name,
      url: buildUrl(f.path),
      createdAt: new Date(f.createdAt),
      duration: f.duration,
    }));

    return { captures, recordings };
  }, [fileServerPort]);

  return {
    ...state,
    createClient,
    updateClient,
    createSession,
    setActiveSession,
    saveCapture,
    saveRecording,
    saveSessionState,
    loadSessionState,
    deleteSession,
    deleteClient,
    loadSessionAssets,
    reload: load,
  };
}
