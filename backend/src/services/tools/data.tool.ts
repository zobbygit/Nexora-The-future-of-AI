import Papa from 'papaparse';
import { HandlerResult, ToolHandler } from '../ai.service';
import { badRequest } from '../../utils/errors';
import { fence, sys, user } from './helpers';

type Row = Record<string, unknown>;
const MAX_ROWS = 50000;
const MAX_COLS = 60;

export interface ColumnStat {
  name: string; type: 'number' | 'string' | 'boolean'; nulls: number; unique: number;
  min?: number; max?: number; mean?: number; median?: number; std?: number; outliers?: number;
  top?: Array<{ value: string; count: number }>;
}
export interface ChartSpec {
  id: string; type: 'histogram' | 'bar' | 'scatter'; title: string; caption: string;
  x: string; y?: string; data: Array<Record<string, number | string>>;
}
export interface Analysis {
  rows: number; columns: number; columnStats: ColumnStat[]; correlations: Array<{ a: string; b: string; r: number }>;
  charts: ChartSpec[]; preview: Row[]; headers: string[]; duplicates: number;
}

export const parseDataset = (buf: Buffer, filename: string): Row[] => {
  const text = buf.toString('utf8').replace(/^\uFEFF/, '');
  let rows: Row[];
  if (/\.json$/i.test(filename)) {
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw badRequest('That JSON file could not be parsed.', 'INVALID_DATA'); }
    const arr = Array.isArray(json) ? json : Array.isArray((json as any)?.data) ? (json as any).data : null;
    if (!arr || !arr.every((r: unknown) => r && typeof r === 'object' && !Array.isArray(r))) {
      throw badRequest('JSON must be an array of objects.', 'INVALID_DATA');
    }
    rows = arr as Row[];
  } else {
    const parsed = Papa.parse<Row>(text, { header: true, dynamicTyping: true, skipEmptyLines: 'greedy' });
    rows = parsed.data;
  }
  if (!rows.length) throw badRequest('That file has no rows.', 'INVALID_DATA');
  return rows.slice(0, MAX_ROWS);
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const q = (sorted: number[], p: number) => {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

const pearson = (xs: number[], ys: number[]) => {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
};

export const analyze = (rows: Row[]): Analysis => {
  const headers = Object.keys(rows[0]).filter((h) => h && h !== '__parsed_extra').slice(0, MAX_COLS);
  const stats: ColumnStat[] = [];
  const numericCols: Record<string, number[]> = {};
  const charts: ChartSpec[] = [];

  for (const h of headers) {
    const values = rows.map((r) => r[h]);
    const present = values.filter((v) => v !== null && v !== undefined && v !== '');
    const nulls = values.length - present.length;
    const numbers = present.map(num).filter((n): n is number => n !== null);
    const isNumeric = present.length > 0 && numbers.length / present.length > 0.9;
    const isBool = present.length > 0 && present.every((v) => typeof v === 'boolean');
    const unique = new Set(present.map(String)).size;

    if (isNumeric) {
      const sorted = [...numbers].sort((a, b) => a - b);
      const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
      const std = Math.sqrt(numbers.reduce((a, b) => a + (b - mean) ** 2, 0) / numbers.length);
      const q1 = q(sorted, 0.25), q3 = q(sorted, 0.75), iqr = q3 - q1;
      const outliers = numbers.filter((n) => n < q1 - 1.5 * iqr || n > q3 + 1.5 * iqr).length;
      stats.push({ name: h, type: 'number', nulls, unique, min: r2(sorted[0]), max: r2(sorted[sorted.length - 1]), mean: r2(mean), median: r2(q(sorted, 0.5)), std: r2(std), outliers });
      numericCols[h] = values.map((v) => num(v) ?? NaN) as number[];
    } else {
      const counts = new Map<string, number>();
      present.forEach((v) => counts.set(String(v), (counts.get(String(v)) || 0) + 1));
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([value, count]) => ({ value: value.slice(0, 40), count }));
      stats.push({ name: h, type: isBool ? 'boolean' : 'string', nulls, unique, top });
    }
  }

  // Charts that carry meaning: distributions of the most variable numeric columns, and top categories.
  const numericStats = stats.filter((s) => s.type === 'number' && s.unique > 5)
    .sort((a, b) => (b.std! / (Math.abs(b.mean!) || 1)) - (a.std! / (Math.abs(a.mean!) || 1))).slice(0, 2);
  for (const s of numericStats) {
    const vals = numericCols[s.name].filter((v) => !Number.isNaN(v));
    const bins = 10, span = (s.max! - s.min!) || 1;
    const counts = new Array(bins).fill(0);
    vals.forEach((v) => { counts[Math.min(bins - 1, Math.floor(((v - s.min!) / span) * bins))]++; });
    charts.push({
      id: `hist-${s.name}`, type: 'histogram', title: `Distribution of ${s.name}`,
      caption: `Median ${s.median}, mean ${s.mean}${s.outliers ? `, ${s.outliers} outliers` : ''}.`, x: s.name,
      data: counts.map((c, i) => ({ label: `${r2(s.min! + (span / bins) * i)}`, count: c })),
    });
  }
  const catStats = stats.filter((s) => s.type === 'string' && s.unique >= 2 && s.unique <= 30).slice(0, 2);
  for (const s of catStats) {
    charts.push({
      id: `bar-${s.name}`, type: 'bar', title: `Top values in ${s.name}`,
      caption: `${s.unique} distinct values; "${s.top![0].value}" is most common (${s.top![0].count}).`, x: s.name,
      data: s.top!.map((t) => ({ label: t.value, count: t.count })),
    });
  }

  // Correlations
  const nCols = Object.keys(numericCols).slice(0, 8);
  const correlations: Analysis['correlations'] = [];
  for (let i = 0; i < nCols.length; i++) for (let j = i + 1; j < nCols.length; j++) {
    const pairs = numericCols[nCols[i]].map((v, k) => [v, numericCols[nCols[j]][k]]).filter(([a, b]) => !Number.isNaN(a) && !Number.isNaN(b));
    const r = pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
    if (Math.abs(r) >= 0.3) correlations.push({ a: nCols[i], b: nCols[j], r: r2(r) });
  }
  correlations.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  const best = correlations[0];
  if (best) {
    const step = Math.max(1, Math.floor(rows.length / 200));
    const pts = rows.filter((_, i) => i % step === 0).map((r) => ({ x: num(r[best.a]), y: num(r[best.b]) }))
      .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null);
    charts.push({
      id: 'scatter', type: 'scatter', title: `${best.a} vs ${best.b}`,
      caption: `Correlation r = ${best.r} — ${Math.abs(best.r) > 0.7 ? 'strong' : 'moderate'} ${best.r > 0 ? 'positive' : 'negative'} relationship.`,
      x: best.a, y: best.b, data: pts,
    });
  }

  const seen = new Set<string>();
  let duplicates = 0;
  rows.forEach((r) => { const k = JSON.stringify(headers.map((h) => r[h])); if (seen.has(k)) duplicates++; else seen.add(k); });

  return { rows: rows.length, columns: headers.length, columnStats: stats, correlations: correlations.slice(0, 6), charts, preview: rows.slice(0, 25).map((r) => Object.fromEntries(headers.map((h) => [h, r[h]]))), headers, duplicates };
};

export const dataHandler = (file: { buffer: Buffer; filename: string }, question: string): ToolHandler<Record<string, never>> => async (_i, ctx): Promise<HandlerResult> => {
  ctx.progress('Profiling dataset');
  const analysis = analyze(parseDataset(file.buffer, file.filename));
  const compact = JSON.stringify({
    rows: analysis.rows, columns: analysis.columns, duplicates: analysis.duplicates,
    columnStats: analysis.columnStats, correlations: analysis.correlations, sample: analysis.preview.slice(0, 5),
  });
  ctx.progress('Writing insights');
  const out = await ctx.route('text.generate', {
    temperature: 0.3, maxTokens: 1800,
    messages: [
      sys('You are Nexora Data Analyst. Use only the statistics provided; never invent numbers. Output Markdown with: Key findings, Data quality, Suggested next steps.'),
      user(`${question ? `Question: ${question.slice(0, 500)}\n` : ''}${fence('dataset-statistics', compact, 20000)}`),
    ],
  });
  const insights = out.result.text || '';
  const title = `Analysis — ${file.filename}`;
  return {
    output: { insights, ...analysis }, title, inputSummary: { filename: file.filename, rows: analysis.rows, columns: analysis.columns, question },
    artifact: { kind: 'data', title, mimeType: 'application/json', content: JSON.stringify({ insights, ...analysis }), meta: { filename: file.filename, rows: analysis.rows, columns: analysis.columns } },
  };
};
