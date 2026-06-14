import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Client, Discipline } from '../types';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface Props {
  clients: Client[];
  /** false = premier démarrage, pas de fermeture possible */
  canClose: boolean;
  onClose?: () => void;
  onCreateClientAndSession: (
    clientData: Pick<Client, 'nom' | 'prenom' | 'email' | 'phone' | 'birthDate'>,
    sessionData: { discipline: Discipline; bikeFitDate: string; notes?: string },
  ) => Promise<void>;
  onCreateSessionForClient: (
    clientId: string,
    sessionData: { discipline: Discipline; bikeFitDate: string; notes?: string },
  ) => Promise<void>;
}

const DISCIPLINES: Discipline[] = ['route', 'gravel', 'clm', 'vtt'];

const input =
  'w-full bg-[#22223b] border border-[#3d3d5c] rounded-lg px-3 py-2 text-sm text-slate-100 ' +
  'placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';

export function NewSessionModal({
  clients, canClose, onClose,
  onCreateClientAndSession, onCreateSessionForClient,
}: Props) {
  const { t } = useTranslation();
  useEscapeKey(onClose, canClose);

  const [mode, setMode] = useState<'new-client' | 'existing-client'>(
    clients.length === 0 ? 'new-client' : 'new-client',
  );

  // Nouveau client
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // Client existant
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '');

  // Session (commun)
  const [discipline, setDiscipline] = useState<Discipline | ''>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Record<string, boolean> = {};
    if (mode === 'new-client') {
      if (!nom.trim()) e.nom = true;
      if (!prenom.trim()) e.prenom = true;
    } else {
      if (!selectedClientId) e.client = true;
    }
    if (!discipline) e.discipline = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const sessionData = {
        discipline: discipline as Discipline,
        bikeFitDate: date,
        notes: notes.trim() || undefined,
      };
      if (mode === 'new-client') {
        await onCreateClientAndSession(
          { nom: nom.trim(), prenom: prenom.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, birthDate: birthDate || undefined },
          sessionData,
        );
      } else {
        await onCreateSessionForClient(selectedClientId, sessionData);
      }
    } finally {
      setSaving(false);
    }
  };

  const disciplineLabel = (d: Discipline) => t(`session.discipline_${d}`);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={e => { if (canClose && e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="bg-[#13131f] border border-[#22223b] rounded-xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22223b] shrink-0">
          <h2 className="text-base font-semibold text-slate-100">{t('session.newSession')}</h2>
          {canClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Mode toggle — only if clients exist */}
          {clients.length > 0 && (
            <div className="flex rounded-lg overflow-hidden border border-[#3d3d5c]">
              {(['new-client', 'existing-client'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    mode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'new-client' ? t('session.newClient') : t('session.existingClient')}
                </button>
              ))}
            </div>
          )}

          {/* Infos client */}
          {mode === 'new-client' ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">
                {t('session.clientInfo')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t('session.nom')} <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={`${input} ${errors.nom ? 'border-red-500' : ''}`}
                    value={nom} onChange={e => setNom(e.target.value)}
                    placeholder="Dupont"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t('session.prenom')} <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={`${input} ${errors.prenom ? 'border-red-500' : ''}`}
                    value={prenom} onChange={e => setPrenom(e.target.value)}
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('session.email')}</label>
                  <input className={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@example.com" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('session.phone')}</label>
                  <input className={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+33 6 00 00 00 00" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('session.birthDate')}</label>
                  <input className={`${input} [color-scheme:dark]`} type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                </div>
              </div>
            </section>
          ) : (
            <section>
              <label className="block text-xs text-slate-400 mb-1">
                {t('session.selectClient')} <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className={`${input} ${errors.client ? 'border-red-500' : ''}`}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                ))}
              </select>
            </section>
          )}

          {/* Session */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">
              Session
            </h3>
            <div className="space-y-3">
              {/* Discipline */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {t('session.discipline')} <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DISCIPLINES.map(d => (
                    <button
                      key={d}
                      onClick={() => setDiscipline(d)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        discipline === d
                          ? 'bg-indigo-600 text-white'
                          : errors.discipline
                            ? 'bg-red-900/20 border border-red-500 text-slate-300'
                            : 'bg-[#22223b] text-slate-300 hover:bg-[#2d2d48]'
                      }`}
                    >
                      {disciplineLabel(d)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('session.date')}</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className={`${input} [color-scheme:dark]`}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('session.notes')}</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('session.notesPlaceholder')}
                  className={`${input} resize-none h-20`}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#22223b] shrink-0">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {saving && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {t('session.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
