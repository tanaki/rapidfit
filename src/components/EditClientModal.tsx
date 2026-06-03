import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Client } from '../types';

interface Props {
  client: Client;
  onSave: (updates: Partial<Client> & { id: string }) => Promise<void>;
  onClose: () => void;
}

const input =
  'w-full bg-[#22223b] border border-[#3d3d5c] rounded-lg px-3 py-2 text-sm text-slate-100 ' +
  'placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';

export function EditClientModal({ client, onSave, onClose }: Props) {
  const { t } = useTranslation();

  const [nom, setNom] = useState(client.nom);
  const [prenom, setPrenom] = useState(client.prenom);
  const [email, setEmail] = useState(client.email ?? '');
  const [phone, setPhone] = useState(client.phone ?? '');
  const [birthDate, setBirthDate] = useState(client.birthDate ?? '');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Record<string, boolean> = {};
    if (!nom.trim()) e.nom = true;
    if (!prenom.trim()) e.prenom = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        id: client.id,
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        birthDate: birthDate || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#13131f] border border-[#22223b] rounded-xl shadow-2xl w-[480px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22223b]">
          <h2 className="text-base font-semibold text-slate-100">
            {t('session.editClient')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {t('session.nom')} <span className="text-red-400">*</span>
              </label>
              <input
                className={`${input} ${errors.nom ? 'border-red-500' : ''}`}
                value={nom} onChange={e => setNom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {t('session.prenom')} <span className="text-red-400">*</span>
              </label>
              <input
                className={`${input} ${errors.prenom ? 'border-red-500' : ''}`}
                value={prenom} onChange={e => setPrenom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('session.email')}</label>
              <input className={input} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('session.phone')}</label>
              <input className={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">{t('session.birthDate')}</label>
              <input
                className={`${input} [color-scheme:dark]`}
                type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#22223b] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-slate-300 hover:text-white bg-[#22223b] hover:bg-[#2d2d48] rounded-lg transition-colors"
          >
            {t('report.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {saving && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {t('session.saveClient')}
          </button>
        </div>
      </div>
    </div>
  );
}
