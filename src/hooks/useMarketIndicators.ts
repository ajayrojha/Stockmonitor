import { useState, useEffect, useCallback } from 'react';

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

// corsproxy.io excluded — now 401s on every request without a paid API key.
const PROXIES = [
  'https://api.cors.lol/?url=',
  'https://api.allorigins.win/raw?url=',
];
let proxyIdx = 0;
const getProxy = () => { const p = PROXIES[proxyIdx % PROXIES.length]; proxyIdx++; return p; };

const fetchYahoo = async (ticker: string, name: string): Promise<IndicatorData | null> => {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
  try {
    const res = await fetch(getProxy() + encodeURIComponent(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('No price');
    const change = meta.regularMarketPrice - (meta.previousClose || meta.regularMarketPrice);
    const changePct = meta.previousClose ? (change / meta.previousClose) * 100 : 0;
    return { symbol: ticker, name, price: meta.regularMarketPrice, change, changePercent: changePct };
  } catch { return null; }
};

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
    const [vix, yield10y, dxy, gold, bitcoin, oil] = await Promise.all([
      fetchYahoo('^VIX', 'VIX'),
      fetchYahoo('^TNX', '10Y Yield'),
      fetchYahoo('DX-Y.NYB', 'DXY'),
      fetchYahoo('GC=F', 'Gold'),
      fetchYahoo('BTC-USD', 'Bitcoin'),
      fetchYahoo('CL=F', 'WTI Oil'),
    ]);

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
