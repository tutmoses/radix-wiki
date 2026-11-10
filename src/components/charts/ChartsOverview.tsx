// src/components/charts/ChartsOverview.tsx – /charts dashboard

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeftRight, BarChart3, CircleDollarSign, Layers, Lock, Newspaper, Server } from 'lucide-react';
import { JsonLd } from 'wiki-formant/react-server';
import { getNetworkStats, type NetworkStats } from '@/lib/radix/network';
import { getDexStats, getTopTokens, type TokenSummary } from '@/lib/radix/tokens';
import { getLedgerDays, type LedgerDayPoint } from '@/lib/radix/activity';
import { getWeeklySnapshots, type WeeklyPoint } from '@/lib/radix/weekly';
import { WEEKLY_PAGE } from '@/lib/week-in-review';
import { eventMarkers } from '@/lib/radix/events';
import { ACTIVITY_METRICS } from '@/lib/radix/metrics';
import { XRD_ADDRESS } from '@/lib/radix/config';
import { getLatestRecap, getNetworkEvents, getPageByAsset } from '@/lib/wiki';
import { pagePath } from '@/lib/utils';
import { SITE_REFS, SITE_URL, WIKI_LICENSE } from '@/lib/site';
import { PageHeading } from '@/components/PageHeading';
import { MetricChart, type Metric } from './MetricChart';
import { TokenChart } from './TokenChart';
import { ValidatorsTable } from './ValidatorsTable';
import { TokensTable } from './TokensTable';
import LedgerUnavailable from './LedgerUnavailable';
import StatGrid, { type Stat } from './StatGrid';
import { tokenRows, validatorRows } from './rows';
import { formatXrd, formatCompact, formatPercent, formatPriceSubscript, longDay } from './format';

const DATA_URL = `${SITE_URL}/api/charts/activity`;

const STAKING_METRICS: Metric<Exclude<keyof WeeklyPoint, 'time'>>[] = [
  { key: 'totalStake', label: 'Total stake ($XRD)' },
  { key: 'stakedShare', label: 'Share of supply staked', percent: true },
  { key: 'top10Share', label: 'Stake held by the largest 10', percent: true },
  { key: 'nakamoto', label: 'Validators holding a third' },
];

const shortDay = (time: number) => new Date(time * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The last stored day against the mean of the thirty before it. */
function lastDay(days: LedgerDayPoint[]) {
  const last = days.at(-1);
  if (!last) return null;
  const before = days.slice(-31, -1);
  const mean = before.reduce((sum, d) => sum + d.transactions, 0) / (before.length || 1);
  return { last, change: mean > 0 ? ((last.transactions - mean) / mean) * 100 : NaN };
}

function statCards(stats: NetworkStats | null, xrd: TokenSummary | undefined, days: LedgerDayPoint[]): Stat[] {
  const day = lastDay(days);
  return [
    ...(xrd ? [{
      icon: CircleDollarSign, value: `$${formatPriceSubscript(xrd.price)}`, label: '$XRD on OciSwap',
      ...(xrd.change24h !== undefined && { change: { percent: xrd.change24h, label: 'in 24h' } }),
    }] : []),
    ...(stats ? [
      { icon: Lock, value: formatXrd(stats.staking.totalStake), label: `Staked, ${formatPercent((stats.staking.totalStake / stats.xrdSupply) * 100, 1)} of supply` },
      { icon: Server, value: String(stats.staking.active), label: `Active validators, of ${stats.staking.registered} registered` },
    ] : []),
    ...(day ? [{
      icon: ArrowLeftRight, value: day.last.transactions.toLocaleString('en-US'), label: `Transactions on ${shortDay(day.last.time)}`,
      change: { percent: day.change, label: 'vs 30-day average' },
    }] : []),
    ...(stats ? [{ icon: Layers, value: formatXrd(stats.xrdSupply), label: '$XRD supply' }] : []),
  ];
}

/** The daily series as a schema.org Dataset, with the CSV and JSON it downloads as. */
function datasetLd(days: LedgerDayPoint[]) {
  const first = days[0], last = days.at(-1);
  const day = (p: LedgerDayPoint) => new Date(p.time * 1000).toISOString().slice(0, 10);
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Radix network daily activity',
    description: 'Daily totals for the Radix mainnet, summed from the Gateway transaction stream: transactions, active and new accounts, components and resources created, NFTs minted, fees, $XRD burned and royalties.',
    url: `${SITE_URL}/charts`,
    creator: SITE_REFS.organization,
    publisher: SITE_REFS.organization,
    license: WIKI_LICENSE.url,
    isAccessibleForFree: true,
    keywords: ['Radix', 'XRD', 'blockchain', 'transactions', 'on-chain data'],
    ...(first && last && { temporalCoverage: `${day(first)}/${day(last)}` }),
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${DATA_URL}?format=csv` },
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: DATA_URL },
    ],
  };
}

function Section({ id, title, link, children }: { id: string; title: string; link?: ReactNode; children: ReactNode }) {
  const heading = <h2 id={id} className="charts-section-title">{title}</h2>;
  return (
    <section className="stack-sm">
      {link ? <div className="spread">{heading}{link}</div> : heading}
      {children}
    </section>
  );
}

const viewAll = (href: string) => <Link href={href} className="charts-section-link">View all <ArrowRight size={14} /></Link>;

export default async function ChartsOverview() {
  // Token prices come from OciSwap and survive a Gateway that will not answer state
  // reads, so they are fetched apart from the ledger and still render alone.
  const [stats, tokens, days, weeks, dex, recap, xrdPage, events] = await Promise.all([
    getNetworkStats().catch(() => null),
    getTopTokens().catch(() => null),
    getLedgerDays().catch(() => []),
    getWeeklySnapshots().catch(() => []),
    getDexStats(),
    getLatestRecap().catch(() => null),
    getPageByAsset(XRD_ADDRESS).catch(() => null),
    getNetworkEvents().catch(() => []),
  ]);
  const xrd = tokens?.find(t => t.address === XRD_ADDRESS);
  const [tokenTable, validatorTable] = await Promise.all([tokens && tokenRows(tokens), stats ? validatorRows(stats) : null]);
  const first = days[0], last = days.at(-1);

  return (
    <div className="stack">
      {days.length > 0 && <JsonLd data={datasetLd(days)} />}
      <PageHeading icon={BarChart3} id="charts" title="Charts" description="Live Radix network statistics, validator directory, and ecosystem token data.">
        {recap && (
          <Link href={pagePath(recap.tagPath, recap.slug)} className="charts-recap">
            <Newspaper size={16} className="text-accent shrink-0" />
            <span><span className="text-text-muted">This week on Radix: </span>{recap.title.replace(/^Radix Week in Review:\s*/, '')}</span>
            <ArrowRight size={14} className="shrink-0" />
          </Link>
        )}
      </PageHeading>

      {stats || xrd ? <StatGrid stats={statCards(stats, xrd, days)} /> : null}
      {!stats && <LedgerUnavailable what="Live network data" />}

      {first && last && (
        <Section id="network-activity" title="Network activity">
          <MetricChart
            points={days}
            metrics={ACTIVITY_METRICS}
            param="m"
            period="day"
            compare={{ points: 30, label: 'the 30 days before' }}
            events={events}
            caption={<>
              Daily figures from {longDay(first.time)} to {longDay(last.time)}, in UTC days. A week or month point is the total of its days, so the week in progress counts only the days so far, and an account active on three days of a week counts three times. Counts cover the transactions
              people submit, not the ones the network makes for itself each round. An active account is one whose balance
              changed.
              {' '}<a href={`${DATA_URL}?format=csv`} download>Download CSV</a> · <a href={DATA_URL}>JSON</a>
            </>}
          />
        </Section>
      )}

      {xrd && (
        <Section id="xrd-price" title="$XRD price" link={
          <span className="row text-small">
            {xrdPage && <Link href={pagePath(xrdPage.tagPath, xrdPage.slug)} className="charts-section-link">{xrdPage.title}</Link>}
            <Link href={`/charts/tokens/${XRD_ADDRESS}`} className="charts-section-link">Holders and supply <ArrowRight size={14} /></Link>
          </span>
        }>
          <TokenChart resourceAddress={XRD_ADDRESS} defaultTimeframe="1y" height={300} markers={eventMarkers(events)} />
          {xrd.marketCap !== undefined && (
            <p className="text-small text-text-muted">
              Market cap ${formatCompact(xrd.marketCap)} at OciSwap&apos;s price, which is the price of its own pools; other venues quote their own.
            </p>
          )}
        </Section>
      )}

      {weeks.length > 1 && (
        <Section id="staking" title="Staking, week by week">
          <MetricChart
            points={weeks}
            metrics={STAKING_METRICS}
            param="w"
            period="week"
            compare={{ points: 1, label: 'the week before' }}
            aggregate="last"
            events={events}
            caption={<>
              One reading a week, kept on the <Link href={pagePath(WEEKLY_PAGE.tagPath, WEEKLY_PAGE.slug)}>Network Weekly</Link> page since 16 August 2026; the
              network was halted in the week of 6 September, so that week has none.
            </>}
          />
        </Section>
      )}

      {dex && (
        <Section id="dex" title="OciSwap this week">
          <StatGrid stats={[
            { icon: ArrowLeftRight, value: isFinite(dex.volume7dXrd) ? formatXrd(dex.volume7dXrd) : '—', label: 'Volume, last 7 days' },
            { icon: BarChart3, value: dex.swaps7d.toLocaleString('en-US'), label: 'Swaps, last 7 days' },
            { icon: Lock, value: formatXrd(dex.tvlXrd), label: 'Value locked' },
            { icon: Layers, value: dex.newPools7d.toLocaleString('en-US'), label: 'Pools opened, last 7 days' },
          ]} />
        </Section>
      )}

      <Section id="top-tokens" title="Top tokens" link={viewAll('/charts/tokens')}>
        <TokensTable tokens={tokenTable} limit={10} />
      </Section>

      {validatorTable && (
        <Section id="top-validators" title="Top validators" link={viewAll('/charts/validators')}>
          <ValidatorsTable validators={validatorTable} limit={10} />
        </Section>
      )}

      <p className="text-text-muted text-small">
        Data updates every 1–5 minutes, network activity once a day and the weekly figures each week. Validator, network and activity data: Radix Gateway
        {stats && <>, read at epoch {stats.epoch.toLocaleString('en-US')}, state version {stats.stateVersion.toLocaleString('en-US')}</>}.
        Token prices and exchange figures: OciSwap. Daily activity as <a href={`${DATA_URL}?format=csv`} download>CSV</a> or <a href={DATA_URL}>JSON</a>, and through the wiki&apos;s MCP server as <code>get_network_activity</code>.
      </p>
    </div>
  );
}
