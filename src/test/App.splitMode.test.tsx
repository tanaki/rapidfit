import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('Split mode toggle', () => {
  it('bascule en mode split sans lever d\'exception', async () => {
    const user = userEvent.setup();
    render(<App />);

    const splitBtn = screen.getByRole('button', { name: /split/i });
    expect(splitBtn).toBeInTheDocument();

    // Ce clic appelait setSplitSources et paneLayers0 qui n'existaient pas
    await expect(user.click(splitBtn)).resolves.not.toThrow();
  });

  it('affiche le sélecteur de source B en mode split', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /split/i }));

    // En mode split, le sélecteur de source B apparaît dans la barre de source
    expect(screen.getAllByText('B').length).toBeGreaterThanOrEqual(1);
  });

  it('repasse en mode simple en recliquant sur Split', async () => {
    const user = userEvent.setup();
    render(<App />);

    const splitBtn = screen.getByRole('button', { name: /split/i });
    await user.click(splitBtn); // activer
    await user.click(splitBtn); // désactiver

    expect(screen.queryByText('Panneau A')).not.toBeInTheDocument();
  });
});
