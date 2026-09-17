// src/lib/table-sort.ts — click-to-sort for the tables stored in article HTML.
//
// The React tables sort through `useTableSort`. These cannot: they arrive as a
// string that `dangerouslySetInnerHTML` wrote, so React never sees their rows.
// This is the same kind of pass as `activateTabGroups` and `addCopyButtons` in
// `wiki-formant/dom`, and it should move there once a second wiki wants it.
//
// The header markup matches `SortHead`: `aria-sort` on the cell and a
// `.sort-header` button inside it. Both kinds of table therefore draw their
// arrows from one stylesheet rule.

type SortKey = number | string | null;
type Direction = 'ascending' | 'descending';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthIndex = (name: string) => MONTHS.findIndex(m => m.startsWith(name.toLowerCase()));

// A dash, a question mark or "n/a" means the cell has no value. It sorts last
// in both directions, so it never lands above real values.
const BLANK = /^(?:[-–—?]|n\/?a|tb[ad])?$/i;

const DAY_FIRST = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i;
const MONTH_FIRST = /^([a-z]{3,9})\.?\s+(?:(\d{1,2})(?:st|nd|rd|th)?,?\s+)?(\d{4})/i;

/** The time a cell starts with, as ms. Accepts ISO dates, "4 Jun 2026", "June 4, 2026", "June 2026" and a bare year. */
function parseDate(s: string): number | null {
  const iso = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?(?:[ T](\d{2}):(\d{2}))?)?(?![\d,.])/.exec(s);
  if (iso) return Date.UTC(+iso[1]!, +(iso[2] ?? 1) - 1, +(iso[3] ?? 1), +(iso[4] ?? 0), +(iso[5] ?? 0));
  const d = DAY_FIRST.exec(s);
  if (d && monthIndex(d[2]!) >= 0) return Date.UTC(+d[3]!, monthIndex(d[2]!), +d[1]!, +(d[4] ?? 0), +(d[5] ?? 0), +(d[6] ?? 0));
  const m = MONTH_FIRST.exec(s);
  if (m && monthIndex(m[1]!) >= 0) return Date.UTC(+m[3]!, monthIndex(m[1]!), +(m[2] ?? 1));
  return null;
}

const MULTIPLIER: Record<string, number> = {
  k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, trillion: 1e12,
  kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 2 ** 10, mib: 2 ** 20, gib: 2 ** 30, tib: 2 ** 40,
};

// The number a cell starts with: "~$3,500", "+137%", "−0.4", "142M XRD",
// "14.00 million", "3.4 MB". A version string like "1.18.4" is not a number, so a column
// of versions falls through to the natural text order, where 1.9 comes before 1.10.
const NUMBER = /^[~≈<>≤≥]?\s*([+\-−]?)\s*[#$€£¥]?\s*(\d[\d,]*(?:\.\d+)?|\.\d+)(?![.\d])(?:\s*(%|(?:thousand|million|billion|trillion|[kmgt]i?b|bn|[kmbt])(?![a-z])))?/i;

function parseNumber(s: string): number | null {
  const n = NUMBER.exec(s);
  if (!n) return null;
  const value = parseFloat(n[2]!.replace(/,/g, '')) * (MULTIPLIER[n[3]?.toLowerCase() ?? ''] ?? 1);
  return n[1] && n[1] !== '+' ? -value : value;
}

/**
 * The column's sort keys. A column is dates if every filled cell starts with a
 * date, numbers if every one starts with a number, and text otherwise. One
 * stray value makes the whole column text, which is better than sorting it half
 * by one rule and half by another.
 */
function columnKeys(cells: string[]): SortKey[] {
  const blank = cells.map(c => BLANK.test(c));
  for (const parse of [parseDate, parseNumber]) {
    const keys = cells.map((c, i) => (blank[i] ? null : parse(c)));
    if (keys.every((k, i) => k !== null || blank[i])) return keys;
  }
  return cells.map((c, i) => (blank[i] ? null : c));
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compare(a: SortKey, b: SortKey, direction: Direction): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const order = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
  return direction === 'ascending' ? order : -order;
}

/**
 * The row whose cells label the columns: the last row of a `<thead>`, or the
 * first row when every cell in it is a `<th>`. The editor writes the second
 * form. An infobox's label/value table has neither form, so it is left alone.
 */
function headerRow(table: HTMLTableElement): HTMLTableRowElement | undefined {
  const head = table.tHead?.rows;
  if (head?.length) return head[head.length - 1];
  const first = table.rows[0];
  return first && Array.from(first.cells).every(c => c.tagName === 'TH') ? first : undefined;
}

/**
 * Make every column-headed table under `root` sortable by its headers, once.
 *
 * Pressing a header sorts by that column. Text sorts A–Z first and numbers and
 * dates largest first, the same as the /charts tables. A second press reverses
 * the order and a third restores the author's order, which is often meaningful
 * (chronological, or ranked) and otherwise could only be recovered by a reload.
 *
 * Skipped: tables with merged cells, where moving a row would break the grid;
 * tables with fewer than two rows to sort; and rows that span several `<tbody>`s.
 */
export function sortTables(root: ParentNode): void {
  for (const table of Array.from(root.querySelectorAll<HTMLTableElement>('table:not([data-sort-init])'))) {
    table.setAttribute('data-sort-init', '');
    const head = headerRow(table);
    if (!head) continue;
    const rows = Array.from(table.tBodies).flatMap(b => Array.from(b.rows)).filter(r => r !== head);
    const body = rows[0]?.parentElement;
    if (!body || rows.length < 2 || rows.some(r => r.parentElement !== body)) continue;
    if (Array.from(table.querySelectorAll<HTMLTableCellElement>('th, td')).some(c => c.colSpan > 1 || c.rowSpan > 1)) continue;

    const headers = Array.from(head.cells);
    const sortBy = (col: number, th: HTMLTableCellElement) => {
      const keys = columnKeys(rows.map(r => r.cells[col]?.textContent?.trim() ?? ''));
      const first: Direction = typeof keys.find(k => k !== null) === 'string' ? 'ascending' : 'descending';
      const current = th.getAttribute('aria-sort');
      const next = current === first ? (first === 'ascending' ? 'descending' : 'ascending') : current === 'none' ? first : null;
      for (const h of headers) if (h.hasAttribute('aria-sort')) h.setAttribute('aria-sort', 'none');
      if (next) th.setAttribute('aria-sort', next);
      const order = next
        ? rows.map((row, i) => ({ row, key: keys[i] ?? null })).sort((a, b) => compare(a.key, b.key, next)).map(x => x.row)
        : rows;
      body.append(...order);
    };

    headers.forEach((th, col) => {
      // A header with no label has nothing to press, and a link inside a
      // button would fire both.
      if (!th.textContent?.trim() || th.querySelector('a, button')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sort-header';
      // The editor wraps every cell's text in a <p>, which a button cannot hold.
      const label = th.children.length === 1 && th.firstElementChild?.tagName === 'P' ? th.firstElementChild : th;
      button.append(...Array.from(label.childNodes));
      button.onclick = () => sortBy(col, th);
      th.replaceChildren(button);
      th.scope ||= 'col';
      th.setAttribute('aria-sort', 'none');
    });
  }
}
