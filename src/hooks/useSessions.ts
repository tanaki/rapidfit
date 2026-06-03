import { useState, useEffect, useCallback } from 'react';
import type { Client, Session, Discipline } from '../types';
import { uid } from '../utils/canvas';

interface SessionsState {
  clients: Client[];
  sessionsByClient: Record<string, Session[]>;
  activeClient: Client | null;
  activeSession: Session | null;
  isLoading: boolean;
}

type ElectronAPI = {
  sessionsList: () => Promise<{ clients: Client[]; sessionsByClient: Record<string, Session[]> }>;
  sessionsCreateClient: (c: Client) => Promise<Client>;
  sessionsCreateSession: (s: Session) => Promise<Session>;
  sessionsSaveCapture: (p: { sessionFolderPath: string; filename: string; buffer: Uint8Array }) => Promise<string>;
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

  return {
    ...state,
    createClient,
    createSession,
    setActiveSession,
    saveCapture,
    reload: load,
  };
}
