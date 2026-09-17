import { useState, useEffect, useCallback, useRef } from 'react';

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
  // Consecutive hard-failure counter (HTTP errors, CORS failures, etc.) —
  // separate from the staleness-based rotation below, so a proxy that is
  // just outright broken doesn't get retried forever.
  const consecutiveFailures = useRef(0);

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

  // Sticky-proxy strategy: stay on the last working proxy, only rotate on failure.
  // This prevents different proxies with different cache ages from toggling the chart.
  // corsproxy.io is deliberately excluded — it now 401s on every request
  // without a paid API key (console.corsproxy.io), so it was permanently dead
  // weight in the rotation rather than an occasional fallback.
  const PROXIES = [
    'https://api.cors.lol/?url=',
    'https://api.allorigins.win/raw?url=',
  ];
  const proxyIdx = useRef(0);
  const getProxy = () => PROXIES[proxyIdx.current % PROXIES.length];
  const advanceProxy = () => { proxyIdx.current++; };

  // Most-recently-known live price, updated every time a real fetch resolves.
  // The chart itself is plotted from a point pushed every second off this
  // value (see the ticker effect below) rather than directly from the raw
  // ~5s-cadence Yahoo poll, so the chart always advances once a second even
  // between real data refreshes. Between refreshes, consecutive ticks repeat
  // the same last-known price — we don't have real sub-poll granularity to
  // show, so a flat run of points is the honest representation of that.
  const livePriceRef = useRef<number>(0);

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

  const fetchRealData = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const symbol = '%5EGSPC';
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d&_t=${Date.now()}`;
      const proxyUrl = `${getProxy()}${encodeURIComponent(url)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error('No chart data returned');
      
      const latestPrice = result.meta.regularMarketPrice;
      prevClose.current = result.meta.previousClose || latestPrice;
      
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
          // Stale/cached response — switch proxy for next poll, but keep existing state
          advanceProxy();
          return;
        }

        // ── Ordering guard ──────────────────────────────────────────────────
        // If a later poll has already been committed while this (earlier,
        // slower) request was in flight, drop this response — don't let it
        // clobber newer state that already landed.
        if (mySeq < latestAppliedSeq.current) {
          return;
        }
        latestAppliedSeq.current = mySeq;
        consecutiveFailures.current = 0;

        latestDataTime.current = incomingLatest;
        latestHistoryLength.current = newHistory.length;

        // Indicator math below still runs on the full `newHistory` (RSI/EMA/
        // Bollinger etc. need more lookback than a 10-minute window would
        // give them). `history` (the line/area/bar series) is NOT populated
        // from `newHistory` directly — it's driven by the once-a-second
        // ticker below, which reads livePriceRef. Just refresh that ref here
        // and push an immediate tick so the chart reflects new data without
        // waiting up to 1s for the next scheduled tick.
        livePriceRef.current = latestPrice;
        pushLiveTick();
        setCurrentPrice(latestPrice);

        // `barHistory` keeps the real per-minute OHLC bars (windowed to the
        // last 10 minutes) — this is what the candlestick view renders, since
        // it's the only series with genuine intra-bar high/low/open/close
        // spread. The per-second ticks above are flat by construction and
        // would render as dashes, not candles.
        const barCutoff = incomingLatest - CHART_WINDOW_MS;
        setBarHistory(newHistory.filter(d => d.time >= barCutoff));
        
        // Calculate all metrics based on the real history
        const prices = newHistory.map(h => h.price);
        const currentPriceBB = latestPrice;
        
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
          lastUpdated: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error fetching real market data:', error);
      // Retain current state on error to avoid UI breaking, but rotate off a
      // proxy that's outright failing (not just serving stale data) after a
      // couple of consecutive misses so we don't get stuck retrying it forever.
      consecutiveFailures.current++;
      if (consecutiveFailures.current >= 2) {
        advanceProxy();
        consecutiveFailures.current = 0;
      }
    }
  }, []);

  // Poll every 5s — Yahoo Finance data updates every ~15s in practice.
  // Slower polling = less proxy churn = less chance of stale-cache toggling.
  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 5000);
    return () => clearInterval(interval);
  }, [fetchRealData]);

  return { currentPrice, history, barHistory, signals, technicalDetails, predictionSuite };
};
