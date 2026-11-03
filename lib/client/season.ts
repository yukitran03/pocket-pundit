// "Winter nights": football's own festive season (floodlit winter matches, Boxing Day fixtures).
// Pure date helpers; the client store lives in components/season/useSeason.ts.

/** On from 1 November to 6 January (local date), inclusive. */
export function inWinterNights(d: Date) {
  const m = d.getMonth();
  return m === 10 || m === 11 || (m === 0 && d.getDate() <= 6);
}

/** Whole days from `d` to this season's Boxing Day (26 December); negative once it has passed. */
export function daysToBoxingDay(d: Date) {
  const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((Date.UTC(y, 11, 26) - today) / 86_400_000);
}

/** "Boxing Day in 53 days", "Boxing Day tomorrow", "Boxing Day today", then "Festive fixtures". */
export function winterLabel(days: number) {
  if (days > 1) return `Boxing Day in ${days} days`;
  if (days === 1) return "Boxing Day tomorrow";
  if (days === 0) return "Boxing Day today";
  return "Festive fixtures";
}
