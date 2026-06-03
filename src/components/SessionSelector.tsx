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
  onSelect, onNewSession, onEditClient,
}: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ageStr = activeClient?.birthDate
    ? ` — ${t('session.age', { n: calcAge(activeClient.birthDate) })}`
    : '';
  const label = activeClient && activeSession
    ? `${activeClient.prenom} ${activeClient.nom}${ageStr} — ${disciplineLabel(activeSession.discipline, i18n.language)} — ${formatDate(activeSession.bikeFitDate, i18n.language)}`
    : t('session.noSession');

  const totalSessions = clients.reduce((n, c) => n + (sessionsByClient[c.id]?.length ?? 0), 0);

  return (
    <>
      <div ref={ref} className="relative flex items-center gap-2">
        {/* Current session pill */}
        <button
          onClick={() => totalSessions > 0 && setOpen(o => !o)}
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

        {/* New session button */}
        <button
          onClick={onNewSession}
          className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          {t('session.newSession')}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 mt-1 w-[380px] bg-[#13131f] border border-[#22223b] rounded-xl shadow-2xl z-[500] max-h-[420px] overflow-y-auto">
            {clients.map(client => {
              const sessions = sessionsByClient[client.id] ?? [];
              if (sessions.length === 0) return null;
              return (
                <div key={client.id}>
                  {/* Client header — ✏ apparaît au hover */}
                  <div className="group flex items-center justify-between px-3 py-2 border-b border-[#22223b] sticky top-0 bg-[#13131f]">
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                      {client.prenom} {client.nom}
                      {client.birthDate && (
                        <span className="text-indigo-300/60 font-normal normal-case tracking-normal ml-1.5">
                          · {calcAge(client.birthDate)} {i18n.language === 'fr' ? 'ans' : 'y.o.'}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingClient(client); setOpen(false); }}
                      title={t('session.editClient')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded hover:bg-[#3d3d5c] text-slate-400 hover:text-white text-sm"
                    >
                      ✏
                    </button>
                  </div>

                  {/* Sessions */}
                  {sessions.map(session => {
                    const isActive = session.id === activeSession?.id;
                    return (
                      <button
                        key={session.id}
                        onClick={() => { onSelect(client, session); setOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-left transition-colors hover:bg-[#22223b] ${
                          isActive ? 'bg-indigo-900/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                          {!isActive && <span className="w-1.5 h-1.5 shrink-0" />}
                          <span className="text-xs text-slate-300">
                            {disciplineLabel(session.discipline, i18n.language)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {formatDate(session.bikeFitDate, i18n.language)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit client modal — rendu en dehors du dropdown pour éviter les z-index conflicts */}
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
