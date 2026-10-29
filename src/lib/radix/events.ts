// src/lib/radix/events.ts – what happened on the network, for the /charts marks.
//
// An event is tagged on the page that tells it, as `metadata.chartEvents`: a UTC day and a
// short title, several separated by semicolons ("2024-02-07 Anemone update; 2024-06-07
// Bottlenose update"). The title is the mark's tooltip and the list under a chart links the
// page. A day known only to the month (the validator subsidy's end in June 2026) is not
// written: a mark on the first of the month would assert a day nobody recorded. This module
// is pure, so client charts read it; `getNetworkEvents` in `@/lib/wiki` reads the pages.

export interface NetworkEvent {
  /** UTC day, YYYY-MM-DD. */
  date: string;
  title: string;
  href: string;
}

const EVENT = /^(\d{4}-\d{2}-\d{2})\s+(.+)$/;

/** A page's `chartEvents`, each linked to the page; a part without a whole day is skipped. */
export function parseChartEvents(value: unknown, href: string): NetworkEvent[] {
  if (typeof value !== 'string') return [];
  return value.split(';').flatMap(part => {
    const m = EVENT.exec(part.trim());
    return m ? [{ date: m[1]!, title: m[2]!, href }] : [];
  });
}

/** The events as chart markers: Unix seconds at the start of the UTC day. */
export const eventMarkers = (events: NetworkEvent[]) => events.map(e => ({ time: Date.parse(`${e.date}T00:00:00Z`) / 1000, label: e.title }));
