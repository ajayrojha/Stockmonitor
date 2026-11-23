// CNBC's public quote service. It sends `Access-Control-Allow-Origin: *`, so
// the browser can call it directly — no CORS proxy, no API key — and it
// answers in ~0.2s with many symbols per request.
//
// Caveat: index "last" prices (e.g. .SPX) can lag by many minutes, so this
// is used for previous closes and slow-moving indicators, not for the live
// S&P price (that comes from the Yahoo SPY stream).

export interface CnbcQuote {
  symbol: string;
  last: number;
  previousClose: number;
  change: number;
  changePercent: number;
  time: number; // epoch ms of the last trade
}

const ENDPOINT = 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol';

// "6,910.39" / "+4.35%" / "4.946%" → number
const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(/[,%+]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/** Fetch quotes for several CNBC symbols in one request. Missing/invalid symbols are omitted. */
export async function fetchCnbcQuotes(symbols: string[]): Promise<Record<string, CnbcQuote>> {
  const params = new URLSearchParams({
    symbols: symbols.join('|'),
    requestMethod: 'itv',
    noform: '1',
    partnerId: '2',
    fund: '1',
    exthrs: '1',
    output: 'json',
  });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CNBC HTTP ${res.status}`);
  const json = await res.json();
  const raw = json?.FormattedQuoteResult?.FormattedQuote;
  const list: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const out: Record<string, CnbcQuote> = {};
  for (const q of list) {
    const symbol = String(q.symbol ?? '');
    const last = num(q.last);
    const previousClose = num(q.previous_day_closing);
    if (!symbol || !Number.isFinite(last)) continue;
    const change = num(q.change);
    const changePercent = num(q.change_pct);
    out[symbol] = {
      symbol,
      last,
      previousClose,
      change: Number.isFinite(change) ? change : 0,
      changePercent: Number.isFinite(changePercent) ? changePercent : 0,
      time: Date.parse(String(q.last_time ?? '')) || 0,
    };
  }
  return out;
}

/**
 * Today's 1-minute bars for a CNBC symbol (e.g. ".SPX"), oldest first.
 * Verified identical to Yahoo's ^GSPC 1m closes; CNBC omits the bar still in
 * progress, so the latest bar is the last *completed* minute.
 */
export async function fetchCnbcIntraday(symbol: string): Promise<{ time: number; open: number; high: number; low: number; close: number }[]> {
  const res = await fetch(`https://ts-api.cnbc.com/harmony/app/charts/1D.json?symbol=${encodeURIComponent(symbol)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`CNBC bars HTTP ${res.status}`);
  const json = await res.json();
  const raw: Record<string, unknown>[] = json?.barData?.priceBars ?? [];
  return raw
    .map(b => ({ time: Number(b.tradeTimeinMills), open: num(b.open), high: num(b.high), low: num(b.low), close: num(b.close) }))
    .filter(b => b.time > 0 && Number.isFinite(b.close))
    .sort((a, b) => a.time - b.time);
}
