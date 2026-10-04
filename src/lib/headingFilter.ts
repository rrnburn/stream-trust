/** Detects provider placeholder "heading" rows like "### UK SPORTS ###" that aren't real streams. */
export function isHeadingPlaceholder(title?: string | null): boolean {
  const t = (title || '').trim();
  if (!t) return false;
  return /^#+.*#+$/.test(t) || /^[-=*~_]{3,}.*[-=*~_]{3,}$/.test(t) || /^[#\-*=_~\s]+$/.test(t);
}
