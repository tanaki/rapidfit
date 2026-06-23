import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Client, Session, Discipline } from '../types';
import { EditClientModal } from './EditClientModal';

interface Props {
  clients: Client[];
  sessionsByClient: Record<string, Session[]>;
  activeClient: Client | null;
  activeSession: Session | null;
  onSelect: (client: Client, session: Session) => void;
  onNewSession: () => void;
  onEditClient: (updates: Partial<Client> & { id: string }) => Promise<void>;
  onDeleteSession: (session: Session) => Promise<void>;
  onDeleteClient: (client: Client) => Promise<void>;
}

function disciplineLabel(d: Discipline, lang: string) {
  const map: Record<Discipline, Record<string, string>> = {
    route:  { fr: 'Route',  en: 'Road'  },
    gravel: { fr: 'Gravel', en: 'Gravel' },
    clm:    { fr: 'CLM',    en: 'TT'    },
    vtt:    { fr: 'VTT',    en: 'MTB'   },
  };
  return map[d]?.[lang] ?? d.toUpperCase();
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const notYet =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (notYet) age--;
  return age;
}

export function SessionSelector({
  clients, sessionsByClient, activeClient, activeSession,
  onSelect, onNewSession, onEditClient, onDeleteSession, onDeleteClient,
}: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearchMode(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (searchMode) searchRef.current?.focus();
  }, [searchMode]);

  const exitSearch = () => {
    setSearchMode(false);
    setSearchQuery('');
  };

  const toggleOpen = () => {
    if (totalSessions === 0) return;
    const next = !open;
    setOpen(next);
    // Si pas de client actif, entrer directement en mode recherche
    if (next && !activeClient) {
      setSearchMode(true);
    } else if (!next) {
      setSearchMode(false);
      setSearchQuery('');
    }
  };

  const totalSessions = clients.reduce((n, c) => n + (sessionsByClient[c.id]?.length ?? 0), 0);
  const activeSessions = activeClient ? (sessionsByClient[activeClient.id] ?? []) : [];

  const filteredClients = searchQuery.trim()
    ? clients.filter(c => {
        const q = searchQuery.toLowerCase();
        return (
          `${c.prenom} ${c.nom}`.toLowerCase().includes(q) ||
          `${c.nom} ${c.prenom}`.toLowerCase().includes(q)
        );
      })
    : clients;

  const handleSelectClient = (client: Client) => {
    const sessions = sessionsByClient[client.id] ?? [];
    if (sessions.length === 0) return;
    onSelect(client, sessions[0]);
    exitSearch();
    setOpen(false);
  };

  const ageStr = activeClient?.birthDate
    ? ` — ${t('session.age', { n: calcAge(activeClient.birthDate) })}`
    : '';
  const label = activeClient && activeSession
    ? `${activeClient.prenom} ${activeClient.nom}${ageStr} — ${disciplineLabel(activeSession.discipline, i18n.language)} — ${formatDate(activeSession.bikeFitDate, i18n.language)}`
    : t('session.noSession');

  const ageLabel = (client: Client) =>
    client.birthDate
      ? ` · ${calcAge(client.birthDate)} ${i18n.language === 'fr' ? 'ans' : 'y.o.'}`
      : '';

  return (
    <>
      <div ref={ref} className="relative flex items-center gap-2">

        {/* Pill — session active */}
        <button
          onClick={toggleOpen}
          className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border transition-colors ${
            open
              ? 'bg-[#2d2d48] border-indigo-500 text-slate-100'
              : 'bg-[#22223b] border-[#3d3d5c] text-slate-300 hover:bg-[#2d2d48]'
          } ${totalSessions === 0 ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
        >
          <span className="max-w-[280px] truncate">{label}</span>
          {totalSessions > 0 && (
            <span className="text-slate-500 text-[10px]">{open ? '▲' : '▼'}</span>
          )}
        </button>

        {/* Bouton nouvelle session */}
        <button
          onClick={onNewSession}
          className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          {t('session.newSession')}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 mt-1 w-[380px] bg-[#13131f] border border-[#22223b] rounded-xl shadow-2xl z-[500]">

            {/* En-tête client — clic sur le nom → mode recherche */}
            <div className="group flex items-center gap-2 px-3 py-2 border-b border-[#22223b]">
              {searchMode ? (
                <>
                  <span className="text-slate-500 text-xs shrink-0">↳</span>
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && exitSearch()}
                    placeholder={i18n.language === 'fr' ? 'Rechercher un client…' : 'Search client…'}
                    className="flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500 min-w-0"
                  />
                  <button
                    onClick={exitSearch}
                    className="shrink-0 text-slate-500 hover:text-slate-300 text-xs leading-none"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs font-semibold text-indigo-400 uppercase tracking-wider truncate">
                    {activeClient
                      ? `${activeClient.prenom} ${activeClient.nom}${ageLabel(activeClient)}`
                      : '—'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Loupe — toujours visible */}
                    <button
                      onClick={() => setSearchMode(true)}
                      title={i18n.language === 'fr' ? 'Rechercher un autre client' : 'Search another client'}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#3d3d5c] text-slate-400 hover:text-white text-sm"
                    >
                      🔍
                    </button>
                    {/* ✏ et 🗑 — apparaissent au hover */}
                    {activeClient && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingClient(activeClient); setOpen(false); }}
                          title={t('session.editClient')}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#3d3d5c] text-slate-400 hover:text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✏
                        </button>
                        <button
                          onClick={async e => {
                            e.stopPropagation();
                            const msg = t('session.deleteClientConfirm', {
                              prenom: activeClient.prenom, nom: activeClient.nom,
                            });
                            if (!window.confirm(msg)) return;
                            setOpen(false);
                            await onDeleteClient(activeClient);
                          }}
                          title={t('session.deleteClient')}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-900/50 text-slate-500 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Contenu : résultats de recherche OU sessions du client actif */}
            <div className="max-h-[360px] overflow-y-auto">
              {searchMode ? (
                filteredClients.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    {i18n.language === 'fr' ? 'Aucun client trouvé' : 'No client found'}
                  </div>
                ) : (
                  filteredClients.map(client => {
                    const sessions = sessionsByClient[client.id] ?? [];
                    const isActive = client.id === activeClient?.id;
                    return (
                      <button
                        key={client.id}
                        onClick={() => handleSelectClient(client)}
                        disabled={sessions.length === 0}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[#22223b] disabled:opacity-40 disabled:cursor-default ${
                          isActive ? 'bg-indigo-900/20' : ''
                        }`}
                      >
                        <span className={`text-xs ${isActive ? 'text-indigo-300' : 'text-slate-300'}`}>
                          {client.prenom} {client.nom}
                          {client.birthDate && (
                            <span className="text-slate-500 ml-1.5">{ageLabel(client)}</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-600 shrink-0 ml-2">
                          {sessions.length} session{sessions.length > 1 ? 's' : ''}
                        </span>
                      </button>
                    );
                  })
                )
              ) : (
                activeSessions.map(session => {
                  const isActive = session.id === activeSession?.id;
                  return (
                    <div
                      key={session.id}
                      className={`group/row flex items-center px-4 py-2 transition-colors hover:bg-[#22223b] ${
                        isActive ? 'bg-indigo-900/30' : ''
                      }`}
                    >
                      <button
                        onClick={() => { onSelect(activeClient!, session); setOpen(false); }}
                        className="flex-1 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-indigo-400' : ''}`} />
                          <span className="text-xs text-slate-300">
                            {disciplineLabel(session.discipline, i18n.language)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mr-2">
                          {formatDate(session.bikeFitDate, i18n.language)}
                        </span>
                      </button>
                      <button
                        onClick={async e => {
                          e.stopPropagation();
                          const msg = t('session.deleteSessionConfirm', {
                            date: formatDate(session.bikeFitDate, i18n.language),
                            discipline: disciplineLabel(session.discipline, i18n.language),
                          });
                          if (!window.confirm(msg)) return;
                          setOpen(false);
                          await onDeleteSession(session);
                        }}
                        title={t('session.deleteSession')}
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded hover:bg-red-900/50 text-slate-500 hover:text-red-400 text-xs shrink-0"
                      >
                        🗑
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onSave={async updates => { await onEditClient(updates); setEditingClient(null); }}
          onClose={() => setEditingClient(null)}
        />
      )}
    </>
  );
}
