// scripts/wir-draft.mjs — the skeleton for a week's recap.
//
// The rubrics that make a series legible were absent because producing them by hand
// every Sunday is work, and the essay is the part that wants the attention. This
// builds the frame from what the database already knows: the ledger reading, the
// repository reading, the wiki pages that actually changed this week, and empty
// blocks for the parts only a person can write.
//
//   node scripts/wir-draft.mjs [--week YYYY-MM-DD] [--out <file>]
//
// Writes a block array to scripts/_wir-draft-<week>.json. Fill in the TODOs, run
// `node scripts/wir-lint.mjs --file <that file>`, then publish it with insertPages.
// Nothing here touches the database.

import fs from 'node:fs';
import { uid, content, infobox, argOf, weekKey, weekStart, gapDays, fmt, compact, delta, withClient, readPage } from './wiki-utils.ts';
import { WEEKLY_PAGE } from '../src/lib/week-in-review.ts';

const TODO = 'TODO';

await withClient(async (client) => {
  const week = weekKey(argOf('--week'));
  const since = weekStart(week);

  const state = (await readPage(client, WEEKLY_PAGE.tagPath, WEEKLY_PAGE.slug))?.metadata?.state ?? {};
  const snaps = state.snapshots || [];
  const i = snaps.findIndex((s) => s.week === week);
  const snap = i >= 0 ? snaps[i] : null;
  const prior = i > 0 ? snaps[i - 1] : null;
  const wow = (now, was) => delta(now, was, { gapDays: gapDays(week, prior?.week) });
  const devs = state.dev || [];
  const d = devs.findIndex((x) => x.week === week);
  const dev = d >= 0 ? devs[d] : null;
  const devPrior = d > 0 ? devs[d - 1] : null;

  // Pages that actually changed in the window. These are the internal links the
  // recap was failing to carry, and they are already sitting in the database.
  const { rows: touched } = await client.query(
    `SELECT id, title, "tagPath" AS tag_path, slug, "updatedAt" AS updated_at, "createdAt" AS created_at
       FROM "WikiPage"
      WHERE "siteId" = '' AND "tagPath" <> '' AND "tagPath" <> 'blog' AND "updatedAt" >= $1
      ORDER BY "updatedAt" DESC LIMIT 12`,
    [`${since}T00:00:00Z`],
  );
  const pagePath = (p) => `/${[p.tag_path, p.slug].filter(Boolean).join('/')}`;

  const blocks = [];

  // --- infobox: exactly two rows (the rail drops to display:block under 17rem)
  blocks.push(infobox(
    `<table><tbody>` +
    `<tr><th>Week of</th><td>${since} to ${week}</td></tr>` +
    `<tr><th>Top story</th><td>${TODO}: one sentence.</td></tr>` +
    `</tbody></table>`));

  // --- the essay
  blocks.push(content(`<p>${TODO}: the cold open. One scene, then the throughline for the week.</p>`));
  blocks.push(content(`<h2>${TODO} first themed section</h2><p>${TODO}</p>`));
  blocks.push(content(`<h2>${TODO} second themed section</h2><p>${TODO}</p>`));

  // --- quote of the week, as a real block rather than prose
  blocks.push({
    id: uid(), type: 'testimonial',
    quote: `${TODO}: one thing somebody actually said this week, verbatim.`,
    author: `${TODO} name`,
    role: 'in the Radix Telegram',
  });

  // --- what the wiki gained, from the rows themselves
  blocks.push(content(
    `<h2>This week on the wiki</h2>` +
    `<p>${TODO}: one paragraph on the article most worth reading, and why this week.</p>` +
    (touched.length
      ? `<p>Pages edited in the seven days to ${week}:</p>`
      : `<p>No article changed this week.</p>`)));
  if (touched.length) {
    blocks.push({ id: uid(), type: 'list', source: 'chosen', pages: touched.map((p) => p.id), show: 'links' });
  }

  // --- the ledger table, second to last before Sources; wir-figure greps this heading
  if (snap) {
    const oci = snap.ociswap || {};
    const row = (label, value, change) =>
      `<tr><th>${label}</th><td>${value}</td><td>${change || ''}</td></tr>`;
    blocks.push(content(
      `<h2>The week on the ledger</h2>` +
      `<p>Read live from the Radix Gateway at epoch ${fmt(snap.epoch)}, state version ${fmt(snap.stateVersion)}, on ${week}.</p>` +
      `<table><tbody>` +
      `<tr><th>Reading</th><th>Value</th><th>Week on week</th></tr>` +
      row('Staked XRD', `${compact(snap.totalStake)} XRD`, wow(snap.totalStake, prior?.totalStake)) +
      row('Share of supply', snap.xrdSupply ? `${((snap.totalStake / snap.xrdSupply) * 100).toFixed(1)}%` : '—', '') +
      row('Validators holding a third of stake', `${snap.nakamoto}`, wow(snap.nakamoto, prior?.nakamoto)) +
      row('Top ten share', `${snap.top10Share}%`, wow(snap.top10Share, prior?.top10Share)) +
      row('Ociswap seven-day volume', `${compact(oci.volume7dXrd)} XRD`, wow(oci.volume7dXrd, prior?.ociswap?.volume7dXrd)) +
      (dev ? row('Commits across tracked repositories', fmt(dev.commits), delta(dev.commits, devPrior?.commits, { gapDays: gapDays(week, devPrior?.week) })) : '') +
      `</tbody></table>` +
      `<p>${TODO}: spend at least one of these numbers in the prose above.</p>`));
  } else {
    blocks.push(content(
      `<h2>The week on the ledger</h2>` +
      `<p>No reading was captured for this week. Run <code>node scripts/network-snapshot.mjs capture</code>.</p>`));
  }

  // --- concentration watch: a named threshold, checked every week
  if (snap) {
    blocks.push(content(
      `<h2>Concentration watch</h2>` +
      `<p>${snap.nakamoto} validators hold a third of all staked XRD, and the largest ten hold ${snap.top10Share}%. ` +
      `A third is the threshold that matters: below it, a colluding group can stall the network. ` +
      `${TODO}: one sentence on whether the number moved and why.</p>`));
  }

  // --- forward look and the record
  blocks.push(content(
    `<h2>What to watch</h2><ul>` +
    `<li>${TODO}: a dated thing that should happen, and the check that will settle it.</li>` +
    `<li>${TODO}</li>` +
    `</ul>`));
  blocks.push(content(
    `<h2>Corrections</h2><p>${TODO}: what this series got wrong and has now fixed, or "Nothing this week."</p>`));

  // --- everything the essay could not carry
  blocks.push({
    id: uid(), type: 'linkGrid',
    intro: 'Everything else this week, in one place.',
    groups: [
      { id: uid(), heading: 'Protocol and tooling', links: [{ label: `${TODO}`, href: 'https://' }] },
      { id: uid(), heading: 'Ecosystem and dApps', links: [{ label: `${TODO}`, href: 'https://' }] },
      { id: uid(), heading: 'Governance', links: [{ label: `${TODO}`, href: 'https://' }] },
    ],
  });

  // --- sources as a first-class citation block
  blocks.push({
    id: uid(), type: 'references',
    title: 'Sources',
    items: [{ id: uid(), text: `${TODO}: publisher, title, date.`, url: 'https://' }],
  });

  const out = argOf('--out') || `scripts/_wir-draft-${week}.json`;
  fs.writeFileSync(out, JSON.stringify(blocks, null, 2));
  console.log(`wrote ${out}  (${blocks.length} blocks)`);
  console.log(`  ledger reading: ${snap ? `epoch ${fmt(snap.epoch)}` : 'MISSING'}`);
  console.log(`  repository reading: ${dev ? `${fmt(dev.commits)} commits` : 'MISSING'}`);
  console.log(`  wiki pages touched this week: ${touched.length}`);
  for (const p of touched.slice(0, 8)) console.log(`    ${pagePath(p)}  ${p.title}`);
  console.log(`\nFill the TODOs, then: node scripts/wir-lint.mjs --file ${out}`);
});
