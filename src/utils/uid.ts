/** Generate a short random ID suitable for annotation element IDs. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
