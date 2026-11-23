import { useState, useEffect, useCallback } from 'react';
import { fetchJsonViaProxy } from '../lib/proxyFetch';
import { fetchCnbcQuotes } from '../lib/cnbcQuotes';

export interface IndicatorData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface MarketIndicators {
  vix: IndicatorData | null;
  yield10y: IndicatorData | null;
  dxy: IndicatorData | null;
  gold: IndicatorData | null;
  bitcoin: IndicatorData | null;
  oil: IndicatorData | null;
  loading: boolean;
  errors: Record<string, string>;
  lastUpdated: number; // epoch ms
}


const fetchYahoo = async (ticker: string, name: string): Promise<IndicatorData | null> => {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await fetchJsonViaProxy<any>(url);
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('No price');
    const change = meta.regularMarketPrice - (meta.previousClose || meta.regularMarketPrice);
    const changePct = meta.previousClose ? (change / meta.previousClose) * 100 : 0;
    return { symbol: ticker, name, price: meta.regularMarketPrice, change, changePercent: changePct };
  } catch { return null; }
};

// Order matches the destructuring in fetchAll.
const SOURCES = [
  { name: 'VIX', cnbc: '.VIX', yahoo: '^VIX' },
  { name: '10Y Yield', cnbc: 'US10Y', yahoo: '^TNX' },
  { name: 'DXY', cnbc: '.DXY', yahoo: 'DX-Y.NYB' },
  { name: 'Gold', cnbc: '@GC.1', yahoo: 'GC=F' },
  { name: 'Bitcoin', cnbc: 'BTC.CM=', yahoo: 'BTC-USD' },
  { name: 'WTI Oil', cnbc: '@CL.1', yahoo: 'CL=F' },
];

export const useMarketIndicators = () => {
  const [indicators, setIndicators] = useState<MarketIndicators>({
    vix: null,
    yield10y: null,
    dxy: null,
    gold: null,
    bitcoin: null,
    oil: null,
    loading: true,
    errors: {},
    lastUpdated: 0,
  });

  const fetchAll = useCallback(async () => {
    // CNBC first: one direct request for all six, no proxy. Anything it
    // doesn't return falls back to Yahoo through the CORS proxies.
    const cnbc = await fetchCnbcQuotes(SOURCES.map(s => s.cnbc)).catch(err => {
      console.warn('CNBC quotes unavailable, falling back to Yahoo:', err);
      return {} as Awaited<ReturnType<typeof fetchCnbcQuotes>>;
    });
    const [vix, yield10y, dxy, gold, bitcoin, oil] = await Promise.all(SOURCES.map(src => {
      const q = cnbc[src.cnbc];
      if (q) return Promise.resolve<IndicatorData>({ symbol: src.yahoo, name: src.name, price: q.last, change: q.change, changePercent: q.changePercent });
      return fetchYahoo(src.yahoo, src.name);
    }));

    setIndicators(prev => {
      const newErrors: Record<string, string> = {};
      const newVix = vix || prev.vix;
      if (!newVix) newErrors.vix = 'Unavailable';
      const newYield = yield10y || prev.yield10y;
      if (!newYield) newErrors.yield10y = 'Unavailable';
      const newDxy = dxy || prev.dxy;
      if (!newDxy) newErrors.dxy = 'Unavailable';
      const newGold = gold || prev.gold;
      if (!newGold) newErrors.gold = 'Unavailable';
      const newBtc = bitcoin || prev.bitcoin;
      if (!newBtc) newErrors.bitcoin = 'Unavailable';
      const newOil = oil || prev.oil;
      if (!newOil) newErrors.oil = 'Unavailable';

      return {
        vix: newVix,
        yield10y: newYield,
        dxy: newDxy,
        gold: newGold,
        bitcoin: newBtc,
        oil: newOil,
        loading: false,
        errors: newErrors,
        lastUpdated: Date.now(),
      };
    });
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000); // 10s — macro indicators update slowly
    return () => clearInterval(interval);
  }, [fetchAll]);

  return indicators;
};
