import { type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export const Stat = ({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: string; tone?: 'ok' | 'bad' | 'warn'; icon?: ReactNode }) => (
  <div className="surface p-5"><div className="flex items-start justify-between"><p className="text-[13px] font-semibold text-fg-mute">{label}</p>{icon && <span className="text-violet-300 [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>}</div>
    <p className={cn('mt-2 text-3xl font-extrabold tracking-tight', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn', tone === 'ok' && 'text-ok')}>{value}</p>{sub && <p className="mt-1 text-xs text-fg-mute">{sub}</p>}</div>
);

export const DataTable = ({ head, rows, loading, empty = 'Nothing to show.', onRow }: { head: string[]; rows: ReactNode[][]; loading?: boolean; empty?: string; onRow?: (i: number) => void }) => (
  <div className="surface overflow-hidden p-0">
    {loading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div> : !rows.length ? <p className="px-6 py-14 text-center text-sm text-fg-mute">{empty}</p> : (
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-fg-mute"><tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} onClick={onRow ? () => onRow(i) : undefined} className={cn('border-t border-line transition', onRow && 'cursor-pointer hover:bg-white/[0.04]')}>{r.map((c, j) => <td key={j} className="px-4 py-3 text-fg-soft">{c}</td>)}</tr>)}</tbody></table></div>)}
  </div>
);

export const chartTip = { contentStyle: { background: '#131728', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }, cursor: { fill: 'rgba(255,255,255,.04)' } };
export const axis = { tick: { fill: '#8b90a8', fontSize: 11 }, stroke: 'transparent' };
export const shortDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
