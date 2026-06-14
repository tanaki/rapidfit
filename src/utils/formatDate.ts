/** Convert an ISO date string (YYYY-MM-DD) to DD/MM/YYYY. */
export function formatDateFR(iso: string | undefined | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
