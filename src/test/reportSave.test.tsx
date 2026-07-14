import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n';
import { ReportModal } from '../components/ReportModal';
import { DEFAULT_REPORT } from '../types';
import type { Client, Session, CompanySettings, ReportData } from '../types';

const client = { id: 'c', nom: 'Dupont', prenom: 'Jean', createdAt: new Date().toISOString(), folderPath: '/x' } as Client;
const session = { id: 's', clientId: 'c', discipline: 'route', bikeFitDate: new Date().toISOString(), createdAt: new Date().toISOString(), folderPath: '/x' } as Session;
const company = {} as CompanySettings;

describe('ReportModal — sauvegarde', () => {
  it("ne sauvegarde PAS à l'ouverture sans édition (garde anti-écrasement)", async () => {
    const onSave = vi.fn();
    render(
      <ReportModal captures={[]} client={client} session={session} company={company}
        initialData={{ ...DEFAULT_REPORT, motif: 'contenu existant' }} onClose={() => {}} onSave={onSave} />,
    );
    // Au-delà du débounce (800 ms) : aucune écriture ne doit partir sans changement.
    await new Promise(r => setTimeout(r, 1000));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sauvegarde le texte réellement saisi', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ReportModal captures={[]} client={client} session={session} company={company}
        initialData={DEFAULT_REPORT} onClose={() => {}} onSave={onSave} />,
    );
    // Cible un textarea lié à `data` (ex. motif), pas les champs poids/taille
    // qui sont un état local séparé.
    const textarea = screen.getAllByRole('textbox').find(b => b.tagName === 'TEXTAREA')!;
    await user.type(textarea, 'abc123');
    await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 2000 });
    const saved = onSave.mock.calls.at(-1)![0] as ReportData;
    expect(Object.values(saved).some(v => typeof v === 'string' && v.includes('abc123'))).toBe(true);
  });

  it('sauvegarde au démontage même si le débounce n\'a pas eu le temps (fermeture rapide)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { unmount } = render(
      <ReportModal captures={[]} client={client} session={session} company={company}
        initialData={DEFAULT_REPORT} onClose={() => {}} onSave={onSave} />,
    );
    const textarea = screen.getAllByRole('textbox').find(b => b.tagName === 'TEXTAREA')!;
    await user.type(textarea, 'urgent');
    // Ferme AVANT les 800 ms du débounce : le flush au démontage doit persister.
    unmount();
    expect(onSave).toHaveBeenCalled();
    const saved = onSave.mock.calls.at(-1)![0] as ReportData;
    expect(Object.values(saved).some(v => typeof v === 'string' && v.includes('urgent'))).toBe(true);
  });
});
