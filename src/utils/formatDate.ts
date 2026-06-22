/** Convert an ISO date string (YYYY-MM-DD) to DD/MM/YYYY. */
export function formatDateFR(iso: string | undefined | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Generate a sortable file-name timestamp: YYYY-MM-DD_HHhMMmSS */
export function fileTimestamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}h${p(date.getMinutes())}m${p(date.getSeconds())}`;
}
