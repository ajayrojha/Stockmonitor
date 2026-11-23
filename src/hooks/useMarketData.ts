import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeTicks, onStreamStatus, type StreamStatus, type PriceTick } from '../lib/yahooStream';
import { fetchJsonViaProxy, reportStaleProxy } from '../lib/proxyFetch';
import { fetchCnbcQuotes, fetchCnbcIntraday } from '../lib/cnbcQuotes';

export interface MarketData {
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  timestamp: string;
  time: number; // Epoch for filtering
}

export type SignalType = 'BUY_CALL' | 'BUY_PUT' | 'HOLD';

export interface Signal {
  engine: string;
  type: SignalType;
  strength: number; // 0 to 100
  prediction: string;
}

export interface TechnicalDetails {
  type: SignalType;
  strength: number;
  prediction: string;
  rsi: {
    value: number;
    status: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  };
  macd: {
    macdLine: number;
    signalLine: number;
    status: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
  };
  bollingerBands: {
    upper: number;
    lower: number;
    percentB: number;
    status: string;
  };
  stochastic: {
    value: number;
    status: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  };
  emaCross: {
    ema20: number;
    ema50: number;
    status: 'GOLDEN_ALIGNMENT' | 'BEARISH_ALIGNMENT' | 'NEUTRAL';
  };
}

export interface PredictionSuite {
  projectedTarget: number;
  regressionSlope: number;
  emaVelocity: number;
  confidence: number;
  expectedRange: { upper: number; lower: number };
  directionalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  stochK: number;
  loading: boolean;
  lastUpdated: number; // epoch ms
}

// ^GSPC previous close, cached per New York calendar day. It's constant for
// the whole session, so one successful fetch a day is enough to price the
// index off the SPY stream even when every CORS proxy is down/rate-limited.
// The ^GSPC/SPY ratio is cached the same way: it barely drifts intraday
// (<1bp/hour in testing), so one real ^GSPC print keeps the live price
// accurate for the rest of the day, across reloads.
const PREV_CLOSE_KEY = 'gspcPrevClose';
const RATIO_KEY = 'gspcSpyRatio';
const nyDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const loadForToday = (key: string): number => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && v.date === nyDate() && v.value > 0 ? v.value : 0;
  } catch { return 0; }
};
const saveForToday = (key: string, value: number) => {
  try { localStorage.setItem(key, JSON.stringify({ date: nyDate(), value })); } catch { /* ignore */ }
};

// Last good ^GSPC 1m chart response, shown instantly on the next page load
// (labelled stale by its age) while fresh data comes in via the proxies.
const CHART_CACHE_KEY = 'gspcChartCache';
const CHART_CACHE_MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000; // covers a long weekend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadChartCache = (): { savedAt: number; result: any } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(CHART_CACHE_KEY) || 'null');
    return v && v.result && Date.now() - v.savedAt < CHART_CACHE_MAX_AGE_MS ? v : null;
  } catch { return null; }
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const saveChartCache = (result: any) => {
  try { localStorage.setItem(CHART_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), result })); } catch { /* ignore */ }
};

// ^GSPC 1m chart in Yahoo's `chart.result[0]` shape. Primary source is CNBC
// (CORS-enabled, no proxy; bars verified identical to Yahoo's), fallback is
// Yahoo through the public CORS proxies.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchGspcChart = async (): Promise<{ result: any; viaProxy: boolean }> => {
  try {
    const [bars, quotes] = await Promise.all([fetchCnbcIntraday('.SPX'), fetchCnbcQuotes(['.SPX'])]);
    const prev = quotes['.SPX']?.previousClose;
    if (bars.length === 0 || !(prev > 0)) throw new Error('CNBC returned no bars');
    const last = bars[bars.length - 1];
    return {
      viaProxy: false,
      result: {
        meta: {
          regularMarketPrice: last.close,
          // A 1m bar's close is the last print of that minute.
          regularMarketTime: Math.floor((last.time + 60000) / 1000),
          previousClose: prev,
          chartPreviousClose: prev,
        },
        timestamp: bars.map(b => Math.floor(b.time / 1000)),
        indicators: { quote: [{
          open: bars.map(b => b.open), high: bars.map(b => b.high),
          low: bars.map(b => b.low), close: bars.map(b => b.close),
        }] },
      },
    };
  } catch (err) {
    console.warn('CNBC chart unavailable, falling back to Yahoo via proxy:', err);
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1m&range=1d&_t=${Date.now()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await fetchJsonViaProxy<any>(url);
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('No chart data returned');
    return { result, viaProxy: true };
  }
};

export const REST_POLL_STREAMING_MS = 15000;
export const REST_POLL_FALLBACK_MS = 5000;

export const useMarketData = () => {
  // Per-second live ticks (flat O=H=L=C snapshots) — smooth, continuously
  // advancing series for the area/line/bar/baseline chart types.
  const [history, setHistory] = useState<MarketData[]>([]);
  // Real Yahoo 1-minute OHLC bars, windowed to the last 10 minutes — has
  // actual intra-bar high/low/open/close spread, so it's the only series
  // that renders as real candles (wicks + bodies) rather than flat dashes.
  const [barHistory, setBarHistory] = useState<MarketData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [signals, setSignals] = useState<Signal[]>([
    { engine: 'Trend Regression Engine (10m)', type: 'HOLD', strength: 0, prediction: 'Initializing...' },
    { engine: 'EMA Trend Engine (10m)', type: 'HOLD', strength: 0, prediction: 'Initializing...' },
    { engine: 'Statistical Momentum Engine (10m)', type: 'HOLD', strength: 0, prediction: 'Initializing...' },
  ]);

  const [technicalDetails, setTechnicalDetails] = useState<TechnicalDetails>({
    type: 'HOLD',
    strength: 0,
    prediction: 'Initializing...',
    rsi: { value: 50, status: 'NEUTRAL' },
    macd: { macdLine: 0, signalLine: 0, status: 'NEUTRAL' },
    bollingerBands: { upper: 0, lower: 0, percentB: 50, status: 'Inside Bands' },
    stochastic: { value: 50, status: 'NEUTRAL' },
    emaCross: { ema20: 0, ema50: 0, status: 'NEUTRAL' },
  });

  const [predictionSuite, setPredictionSuite] = useState<PredictionSuite>({
    projectedTarget: 0,
    regressionSlope: 0,
    emaVelocity: 0,
    confidence: 0,
    expectedRange: { upper: 0, lower: 0 },
    directionalBias: 'NEUTRAL',
    rsi: 50,
    stochK: 50,
    loading: true,
    lastUpdated: 0,
  });
  
  const prevClose = useRef<number>(0);
  // Track the epoch (ms) of the most-recent candle we have committed to state.
  // We only call setHistory when incoming data is strictly fresher — this
  // prevents stale CORS-proxy cached responses from toggling the chart.
  const latestDataTime = useRef<number>(0);
  // Number of bars in the last committed history — guards against a cached
  // proxy response that shares the same latest-bar timestamp (same minute)
  // but is actually a truncated/older snapshot.
  const latestHistoryLength = useRef<number>(0);
  // Monotonic request sequence — poll N+1 can resolve before poll N over a
  // flaky proxy. We only ever commit the response from the highest sequence
  // number seen so far, so a late-arriving older response can't clobber a
  // newer one that already landed.
  const requestSeq = useRef(0);
  const latestAppliedSeq = useRef(0);

  // Helper EMA Function
  const getEMA = (data: number[], period: number) => {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };

  // Helper Linear Regression function
  const getRegressionSlope = (data: number[]) => {
    const N = data.length;
    if (N < 2) return 0;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < N; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumXX += i * i;
    }
    return (N * sumXY - sumX * sumY) / (N * sumXX - sumX * sumX);
  };

  // Chart shows only the trailing 10 minutes of bars, re-windowed on every push.
  const CHART_WINDOW_MS = 10 * 60 * 1000;

  // Most-recently-known live price, updated every time a real fetch resolves.
  // The chart itself is plotted from a point pushed every second off this
  // value (see the ticker effect below) rather than directly from the raw
  // ~5s-cadence Yahoo poll, so the chart always advances once a second even
  // between real data refreshes. Between refreshes, consecutive ticks repeat
  // the same last-known price — we don't have real sub-poll granularity to
  // show, so a flat run of points is the honest representation of that.
  const livePriceRef = useRef<number>(0);

  // ── Real-time WebSocket stream ──────────────────────────────────────────
  // Yahoo's streamer (no CORS proxy needed) pushes SPY ~once a second, but
  // ^GSPC only once as a snapshot on subscribe. So the live index price is
  // derived from SPY, which tracks the S&P 500 near-perfectly intraday:
  //   live ≈ anchorGspc × (spyNow / spyAtAnchorTime)
  // The anchor is reset every time a real ^GSPC print arrives (stream
  // snapshot or each REST poll), using the SPY price from that same moment.
  // Until one arrives, fall back to applying SPY's % change on the day to
  // ^GSPC's previous close.
  // When it's live it owns the price; the REST poll supplies 1m history.
  const spyTicks = useRef<{ time: number; price: number }[]>([]);
  const anchor = useRef<{ gspc: number; spy: number } | null>(null);
  // Latest real ^GSPC print we couldn't anchor yet (no SPY tick near it).
  const pendingPrint = useRef<{ price: number; time: number } | null>(null);
  const gspcPrevClose = useRef<number>(0);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('closed');
  const [lastTickAt, setLastTickAt] = useState<number>(0);
  const lastTickAtRef = useRef<number>(0);
  const STREAM_FRESH_MS = 15000;
  const isStreamFresh = () => Date.now() - lastTickAtRef.current < STREAM_FRESH_MS;

  const pushLiveTick = useCallback(() => {
    const price = livePriceRef.current;
    if (!price) return; // no data yet
    const prevC = prevClose.current || price;
    const now = Date.now();
    const point: MarketData = {
      price,
      open: price,
      high: price,
      low: price,
      close: price,
      change: price - prevC,
      changePercent: prevC === 0 ? 0 : ((price - prevC) / prevC) * 100,
      timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      time: now,
    };
    setHistory(prev => {
      const cutoff = now - CHART_WINDOW_MS;
      return [...prev, point].filter(d => d.time >= cutoff);
    });
  }, []);

  useEffect(() => {
    const tickInterval = setInterval(pushLiveTick, 1000);
    return () => clearInterval(tickInterval);
  }, [pushLiveTick]);

  // Fold a stream tick into the 1-minute bar series so the candlestick view
  // moves live too: extend the current minute's bar, or open a new one.
  const applyTickToBars = useCallback((price: number, tickTime: number) => {
    const minute = Math.floor(tickTime / 60000) * 60000;
    setBarHistory(prev => {
      if (prev.length === 0) return prev; // wait for REST history first
      const last = prev[prev.length - 1];
      const prevC = prevClose.current || price;
      const mk = (o: number, h: number, l: number): MarketData => ({
        price, open: o, high: h, low: l, close: price,
        change: price - prevC,
        changePercent: prevC === 0 ? 0 : ((price - prevC) / prevC) * 100,
        timestamp: new Date(minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        time: minute,
      });
      if (minute < last.time) return prev; // out-of-order tick
      const next = minute === last.time
        ? [...prev.slice(0, -1), mk(last.open, Math.max(last.high, price), Math.min(last.low, price))]
        : [...prev, mk(price, price, price)];
      const cutoff = minute - CHART_WINDOW_MS;
      return next.filter(d => d.time >= cutoff);
    });
  }, []);

  const applyLivePrice = useCallback((price: number, tickTime: number) => {
    const now = Date.now();
    lastTickAtRef.current = now;
    setLastTickAt(now);
    livePriceRef.current = price;
    setCurrentPrice(price);
    applyTickToBars(price, tickTime);
  }, [applyTickToBars]);

  // Anchor the SPY→index ratio to a real ^GSPC print at `gspcTime` (ms).
  const reanchor = useCallback((gspc: number, gspcTime: number) => {
    const buf = spyTicks.current;
    // SPY tick nearest in time to the ^GSPC print.
    let match: { time: number; price: number } | null = null;
    for (const t of buf) {
      if (!match || Math.abs(t.time - gspcTime) < Math.abs(match.time - gspcTime)) match = t;
    }
    if (!match || Math.abs(match.time - gspcTime) > 60000) {
      // No SPY tick close enough yet — retry when SPY ticks arrive.
      pendingPrint.current = { price: gspc, time: gspcTime };
      return false;
    }
    anchor.current = { gspc, spy: match.price };
    pendingPrint.current = null;
    saveForToday(RATIO_KEY, gspc / match.price);
    return true;
  }, []);

  const setGspcPrevClose = useCallback((v: number) => {
    if (!(v > 0)) return;
    gspcPrevClose.current = v;
    if (!prevClose.current) prevClose.current = v;
    saveForToday(PREV_CLOSE_KEY, v);
  }, []);

  useEffect(() => {
    if (!gspcPrevClose.current) {
      const cached = loadForToday(PREV_CLOSE_KEY);
      if (cached) { gspcPrevClose.current = cached; if (!prevClose.current) prevClose.current = cached; }
    }
    if (!anchor.current) {
      const ratio = loadForToday(RATIO_KEY);
      if (ratio) anchor.current = { gspc: ratio, spy: 1 };
    }
    // ^GSPC previous close straight from CNBC (CORS-enabled, no proxy), so
    // the SPY stream can price the index even when every proxy is down.
    // Refreshed every 30 min to pick up the new close after a day rollover.
    let cancelled = false;
    const loadPrevClose = async () => {
      try {
        const q = (await fetchCnbcQuotes(['.SPX']))['.SPX'];
        if (!cancelled && q?.previousClose > 0) setGspcPrevClose(q.previousClose);
      } catch (err) {
        console.warn('CNBC previous close unavailable:', err);
      }
    };
    loadPrevClose();
    const prevCloseTimer = setInterval(loadPrevClose, 30 * 60 * 1000);

    const offStatus = onStreamStatus(setStreamStatus);
    const offGspc = subscribeTicks('^GSPC', (tick: PriceTick) => {
      if (tick.previousClose) setGspcPrevClose(tick.previousClose);
      else if (typeof tick.change === 'number') setGspcPrevClose(tick.price - tick.change);
      const t = tick.time || Date.now();
      reanchor(tick.price, t);
      applyLivePrice(tick.price, t);
    });
    const offSpy = subscribeTicks('SPY', (tick: PriceTick) => {
      const t = tick.time || Date.now();
      const buf = spyTicks.current;
      if (buf.length && t < buf[buf.length - 1].time) return; // out of order
      buf.push({ time: t, price: tick.price });
      while (buf.length && buf[0].time < t - 10 * 60 * 1000) buf.shift();
      if (pendingPrint.current) reanchor(pendingPrint.current.price, pendingPrint.current.time);

      if (anchor.current) {
        applyLivePrice(anchor.current.gspc * (tick.price / anchor.current.spy), t);
      } else if (gspcPrevClose.current && typeof tick.change === 'number' && tick.price - tick.change > 0) {
        // No intraday ^GSPC print yet: apply SPY's % change on the day.
        applyLivePrice(gspcPrevClose.current * (tick.price / (tick.price - tick.change)), t);
      }
    });
    return () => { cancelled = true; clearInterval(prevCloseTimer); offGspc(); offSpy(); offStatus(); };
  }, [applyLivePrice, reanchor, setGspcPrevClose]);

  // Turn a Yahoo ^GSPC 1m chart `result` into chart bars + indicators.
  // `cachedAt` > 0 means it came from the localStorage cache, not the network.
  // Returns 'stale' if a proxy served an older snapshot than we already have.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processResult = useCallback((result: any, mySeq: number, cachedAt = 0): 'ok' | 'stale' => {
    const fromCache = cachedAt > 0;
    const latestPrice = result.meta.regularMarketPrice;
    prevClose.current = result.meta.previousClose || latestPrice;
    // Needed for the SPY-based fallback; valid even from a stale cached
    // proxy response, since it doesn't change during the session.
    setGspcPrevClose(result.meta.chartPreviousClose ?? result.meta.previousClose);
    
    const quotes = result.indicators.quote[0];
    const timestamps = result.timestamp || [];
    const closes = quotes.close || [];
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    
    const newHistory: MarketData[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const p = closes[i];
      if (p !== null && p !== undefined) {
        const t = timestamps[i];
        const o = opens[i] ?? p;
        const h = highs[i] ?? Math.max(o, p);
        const l = lows[i] ?? Math.min(o, p);
        newHistory.push({
          price: p,
          open: o,
          high: h,
          low: l,
          close: p,
          change: p - prevClose.current,
          changePercent: prevClose.current === 0 ? 0 : ((p - prevClose.current) / prevClose.current) * 100,
          timestamp: new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          time: t * 1000
        });
      }
    }

    // ── Freshness guard ────────────────────────────────────────────────────
    // Only commit this response to state if its most-recent candle timestamp
    // is >= the last data we already have, AND it isn't a truncated/cached
    // snapshot sharing the same latest-minute timestamp with fewer bars.
    // Stale or cached proxy responses are silently dropped so the chart
    // never toggles backward.
    if (newHistory.length > 0) {
      const incomingLatest = newHistory[newHistory.length - 1].time;
      const isOlder = incomingLatest < latestDataTime.current;
      const isTruncated = incomingLatest === latestDataTime.current && newHistory.length < latestHistoryLength.current;
      if (isOlder || isTruncated) {
        // Stale/cached proxy response — keep existing state.
        return 'stale';
      }

      // ── Ordering guard ──────────────────────────────────────────────────
      // If a later poll has already been committed while this (earlier,
      // slower) request was in flight, drop this response — don't let it
      // clobber newer state that already landed.
      if (mySeq < latestAppliedSeq.current) {
        return 'ok';
      }
      latestAppliedSeq.current = mySeq;

      latestDataTime.current = incomingLatest;
      latestHistoryLength.current = newHistory.length;

      // Indicator math below still runs on the full `newHistory` (RSI/EMA/
      // Bollinger etc. need more lookback than a 10-minute window would
      // give them). `history` (the line/area/bar series) is NOT populated
      // from `newHistory` directly — it's driven by the once-a-second
      // ticker below, which reads livePriceRef. Just refresh that ref here
      // and push an immediate tick so the chart reflects new data without
      // waiting up to 1s for the next scheduled tick.
      // When the WebSocket stream is live it's fresher than this poll
      // (which may have come through a caching proxy), so don't let the
      // REST price overwrite it.
      const streamLive = isStreamFresh();
      if (!fromCache) reanchor(latestPrice, (result.meta.regularMarketTime ?? 0) * 1000 || incomingLatest);
      if (!streamLive) {
        livePriceRef.current = latestPrice;
        pushLiveTick();
        setCurrentPrice(latestPrice);
      }

      // `barHistory` keeps the real per-minute OHLC bars (windowed to the
      // last 10 minutes) — this is what the candlestick view renders, since
      // it's the only series with genuine intra-bar high/low/open/close
      // spread. The per-second ticks above are flat by construction and
      // would render as dashes, not candles.
      const barCutoff = incomingLatest - CHART_WINDOW_MS;
      // Keep any newer bars the stream has already built past this
      // response's last candle.
      setBarHistory(prev => {
        const restBars = newHistory.filter(d => d.time >= barCutoff);
        const newerStreamBars = streamLive ? prev.filter(d => d.time > incomingLatest) : [];
        return [...restBars, ...newerStreamBars];
      });
      
      // Calculate all metrics based on the real history, with the live
      // stream price (if any) as the most recent value.
      const livePrice = streamLive && livePriceRef.current ? livePriceRef.current : latestPrice;
      const prices = newHistory.map(h => h.price);
      if (livePrice !== latestPrice) prices[prices.length - 1] = livePrice;
      const currentPriceBB = livePrice;
      
      // 1. Moving Average / Linear Regression Engine
      const slope = getRegressionSlope(prices);
      const pctSlope = latestPrice > 0 ? (slope / latestPrice) * 100 : 0;
      const regressionType: SignalType = pctSlope > 0.0003 ? 'BUY_CALL' : pctSlope < -0.0003 ? 'BUY_PUT' : 'HOLD';
      const regressionStrength = Math.min(100, Math.max(55, Math.round(50 + Math.abs(pctSlope) * 3000)));
      const regressionSignal: Signal = {
        engine: 'Trend Regression Engine (10m)',
        type: regressionType,
        strength: regressionType === 'HOLD' ? 50 : regressionStrength,
        prediction: regressionType === 'BUY_CALL' ? 'Positive linear price trajectory projected' :
                    regressionType === 'BUY_PUT' ? 'Negative linear price trajectory projected' :
                    'Neutral flat price projection'
      };

      // 2. EMA Trend Engine (10 vs 30 crossover)
      const ema10 = getEMA(prices, 10);
      const ema30 = getEMA(prices, 30);
      const emaDiff = ema10 - ema30;
      const pctEmaDiff = ema30 > 0 ? ((ema10 - ema30) / ema30) * 100 : 0;
      const emaType: SignalType = pctEmaDiff > 0.001 ? 'BUY_CALL' : pctEmaDiff < -0.001 ? 'BUY_PUT' : 'HOLD';
      const emaStrength = Math.min(100, Math.max(55, Math.round(50 + Math.abs(pctEmaDiff) * 5000)));
      const emaTrendSignal: Signal = {
        engine: 'EMA Trend Engine (10m)',
        type: emaType,
        strength: emaType === 'HOLD' ? 50 : emaStrength,
        prediction: emaType === 'BUY_CALL' ? 'EMA crossover signals bullish acceleration' :
                    emaType === 'BUY_PUT' ? 'EMA crossover signals bearish deceleration' :
                    'EMA lines converged, trend is flat'
      };

      // 3. Technical Oscillators calculation
      // RSI (14)
      const gains = newHistory.slice(-14).reduce((acc, val, i, arr) => i > 0 && val.price > arr[i-1].price ? acc + (val.price - arr[i-1].price) : acc, 0);
      const losses = newHistory.slice(-14).reduce((acc, val, i, arr) => i > 0 && val.price < arr[i-1].price ? acc + Math.abs(val.price - arr[i-1].price) : acc, 0);
      const rs = losses === 0 ? 100 : gains / losses;
      const rsiVal = Math.round(100 - (100 / (1 + rs)));
      const rsiStatus = rsiVal < 35 ? 'OVERSOLD' : rsiVal > 65 ? 'OVERBOUGHT' : 'NEUTRAL';

      // MACD (12, 26, 9)
      const macdValues: number[] = [];
      for (let idx = Math.min(26, prices.length); idx <= prices.length; idx++) {
        const subPrices = prices.slice(0, idx);
        const ema12 = getEMA(subPrices, 12);
        const ema26 = getEMA(subPrices, 26);
        macdValues.push(ema12 - ema26);
      }
      const macdLine = macdValues.length > 0 ? macdValues[macdValues.length - 1] : 0;
      const signalLine = macdValues.length > 9 ? getEMA(macdValues, 9) : macdLine * 0.92;
      const macdStatus = macdLine > signalLine ? 'BULLISH_CROSS' : 'BEARISH_CROSS';

      // Bollinger Bands (20, 2)
      const slice20 = prices.slice(-20);
      const sma20 = slice20.reduce((a, b) => a + b, 0) / (slice20.length || 1);
      const variance = slice20.reduce((a, b) => a + Math.pow(b - sma20, 2), 0) / (slice20.length || 1);
      const sd = Math.sqrt(variance);
      const bbUpper = sma20 + 2 * sd;
      const bbLower = sma20 - 2 * sd;
      const percentB = bbUpper === bbLower ? 50 : Math.round(((currentPriceBB - bbLower) / (bbUpper - bbLower)) * 100);
      const bbStatus = percentB > 95 ? 'Price At Upper Band' : percentB < 5 ? 'Price At Lower Band' : 'Price Inside Bands';

      // Stochastic (14)
      const slice14 = prices.slice(-14);
      const high14 = slice14.length > 0 ? Math.max(...slice14) : currentPriceBB;
      const low14 = slice14.length > 0 ? Math.min(...slice14) : currentPriceBB;
      const stochK = high14 === low14 ? 50 : Math.round(((currentPriceBB - low14) / (high14 - low14)) * 100);
      const stochStatus = stochK < 20 ? 'OVERSOLD' : stochK > 80 ? 'OVERBOUGHT' : 'NEUTRAL';

      // Statistical Momentum Engine Signal (Trend-aware Momentum & Oscillators)
      const isBullishTrend = ema10 > ema30 || pctSlope > 0;
      let stochType: SignalType = 'HOLD';
      let stochStrength = 50;
      let stochPrediction = 'Oscillators in neutral zone';

      if (isBullishTrend) {
        if (rsiVal < 35 || stochK < 20) {
          stochType = 'BUY_CALL';
          stochStrength = 90;
          stochPrediction = 'Oversold level in bull trend indicates prime reentry';
        } else if (rsiVal > 48 || stochK > 45) {
          stochType = 'BUY_CALL';
          stochStrength = Math.min(95, Math.max(60, Math.round((rsiVal + stochK) / 1.5)));
          stochPrediction = 'Strong bullish momentum expansion detected';
        }
      } else {
        if (rsiVal > 65 || stochK > 80) {
          stochType = 'BUY_PUT';
          stochStrength = 90;
          stochPrediction = 'Overbought level in bear trend indicates shorting opportunity';
        } else if (rsiVal < 52 || stochK < 55) {
          stochType = 'BUY_PUT';
          stochStrength = Math.min(95, Math.max(60, Math.round(100 - (rsiVal + stochK) / 2)));
          stochPrediction = 'Strong bearish momentum expansion detected';
        }
      }

      const statisticalMomentumSignal: Signal = {
        engine: 'Statistical Momentum Engine (10m)',
        type: stochType,
        strength: stochStrength,
        prediction: stochPrediction
      };

      setSignals([regressionSignal, emaTrendSignal, statisticalMomentumSignal]);

      // Composite Scoring Model (Trend-focused with Momentum confirmation)
      let score = 0;

      // Primary Trend Drivers
      if (ema10 > ema30) score += 2;
      else score -= 2;

      if (pctSlope > 0.0003) score += 2;
      else if (pctSlope < -0.0003) score -= 2;

      if (macdStatus === 'BULLISH_CROSS') score += 1.5;
      else score -= 1.5;

      if (latestPrice > ema10) score += 1;
      else score -= 1;

      // Momentum Confirmation / Context
      if (score > 0) {
        if (rsiVal > 50) score += 1;
        if (stochK > 50) score += 1;
        if (percentB > 50) score += 0.5;
        if (rsiVal < 35 && stochK < 20) score += 1.5; // Bullish dip
      } else if (score < 0) {
        if (rsiVal < 50) score -= 1;
        if (stochK < 50) score -= 1;
        if (percentB < 50) score -= 0.5;
        if (rsiVal > 65 && stochK > 80) score -= 1.5; // Bearish pull
      }

      const techType: SignalType = score >= 1.5 ? 'BUY_CALL' : score <= -1.5 ? 'BUY_PUT' : 'HOLD';
      const techStrengthVal = Math.min(100, Math.max(50, Math.round(50 + Math.abs(score) * 6)));
      const techSignal: TechnicalDetails = {
        type: techType,
        strength: techStrengthVal,
        prediction: techType === 'BUY_CALL' ? 'Technical indicators confirm active bullish trend' :
                    techType === 'BUY_PUT' ? 'Technical indicators confirm active bearish distribution' :
                    'Technical indicators are conflicting/neutral',
        rsi: { value: rsiVal, status: rsiStatus },
        macd: { macdLine, signalLine, status: macdStatus },
        bollingerBands: { upper: bbUpper, lower: bbLower, percentB, status: bbStatus },
        stochastic: { value: stochK, status: stochStatus },
        emaCross: { ema20: ema10, ema50: ema30, status: ema10 > ema30 ? 'GOLDEN_ALIGNMENT' : 'BEARISH_ALIGNMENT' }
      };

      setTechnicalDetails(techSignal);

      // 10-Minute Prediction Suite Calculations
      const bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = score >= 1.5 ? 'BULLISH' : score <= -1.5 ? 'BEARISH' : 'NEUTRAL';
      const confidenceVal = Math.min(100, Math.max(50, Math.round(50 + Math.abs(score) * 6)));
      const target = latestPrice + (slope * 10);

      setPredictionSuite({
        projectedTarget: target,
        regressionSlope: slope,
        emaVelocity: emaDiff,
        confidence: confidenceVal,
        expectedRange: { upper: bbUpper, lower: bbLower },
        directionalBias: bias,
        rsi: rsiVal,
        stochK: stochK,
        loading: false,
        lastUpdated: cachedAt || Date.now(),
      });
    }
    return 'ok';
  }, [pushLiveTick, reanchor, setGspcPrevClose]);

  const fetchRealData = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const { result, viaProxy } = await fetchGspcChart();
      if (processResult(result, mySeq) === 'stale') { if (viaProxy) reportStaleProxy(); }
      else saveChartCache(result);
    } catch (error) {
      // Keep current state; next poll retries (CNBC first, then the proxies).
      console.error('Error fetching real market data:', error);
    }
  }, [processResult]);

  // REST poll for 1m history + indicators. Every 15s while the stream is
  // live (bars only change once a minute anyway), 5s fallback without it.
  // Skipped while the tab is hidden.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let inFlight = false;
    // Paint the last saved data immediately (marked stale by its age) so the
    // dashboard isn't empty while the proxies are slow to answer.
    const cached = loadChartCache();
    if (cached) queueMicrotask(() => processResult(cached.result, ++requestSeq.current, cached.savedAt));
    const loop = async () => {
      inFlight = true;
      if (!document.hidden) await fetchRealData();
      inFlight = false;
      if (!cancelled) timer = setTimeout(loop, isStreamFresh() ? REST_POLL_STREAMING_MS : REST_POLL_FALLBACK_MS);
    };
    loop();
    // Refresh immediately when the tab comes back into view.
    const onVisible = () => { if (!document.hidden && !inFlight) { clearTimeout(timer); loop(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchRealData, processResult]);

  return { currentPrice, history, barHistory, signals, technicalDetails, predictionSuite, streamStatus, lastTickAt };
};
