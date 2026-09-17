import { useState, useEffect, useCallback } from 'react';

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: string;
  loading: boolean;
  error: string | null;
  components: {
    vix: number | null;         // Raw VIX level
    safeHaven: number | null;   // TLT vs SPY price change (bonds vs stocks)
    junkBond: number | null;    // HYG vs LQD (junk vs investment grade)
    pcr: number | null;         // SPY Put/Call Ratio
  };
}

// corsproxy.io excluded — now 401s on every request without a paid API key.
const PROXIES = [
  'https://api.cors.lol/?url=',
  'https://api.allorigins.win/raw?url=',
];
let proxyIdx = 0;
const getProxy = () => {
  const p = PROXIES[proxyIdx % PROXIES.length];
  proxyIdx++;
  return p;
};

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(v)));

const classify = (score: number): string => {
  if (score >= 75) return 'Extreme Greed';
  if (score >= 56) return 'Greed';
  if (score >= 45) return 'Neutral';
  if (score >= 26) return 'Fear';
  return 'Extreme Fear';
};

// Fetch a single ticker's real-time quote (intraday change %)
const fetchQuote = async (ticker: string): Promise<{ price: number; changePct: number } | null> => {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
    const res = await fetch(getProxy() + encodeURIComponent(url));
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price: number = meta.regularMarketPrice;
    const prev: number = meta.previousClose || meta.chartPreviousClose || price;
    const changePct = prev > 0 ? ((price - prev) / prev) * 100 : 0;
    return { price, changePct };
  } catch {
    return null;
  }
};

export const useFearGreed = () => {
  const [data, setData] = useState<FearGreedData>({
    value: 50,
    classification: 'Neutral',
    timestamp: '',
    loading: true,
    error: null,
    components: { vix: null, safeHaven: null, junkBond: null, pcr: null },
  });

  const fetchData = useCallback(async () => {
    const components: FearGreedData['components'] = { vix: null, safeHaven: null, junkBond: null, pcr: null };
    const weightedScores: { score: number; weight: number }[] = [];

    // ── Signal 1: VIX Absolute Level (25% weight) ─────────────────────────
    // VIX is the most direct measure of market fear. We use absolute level
    // with proper thresholds (not vs average, since historical data fails rate limit)
    // Historical context: VIX < 15 = extreme complacency, 15-20 = normal/greed
    // 20-25 = elevated concern, 25-30 = fear, 30+ = extreme fear
    try {
      const q = await fetchQuote('^VIX');
      if (q) {
        const vix = q.price;
        // Piecewise linear mapping calibrated to CNN's typical readings:
        // VIX 12 → 85 (Extreme Greed), VIX 17 → 60 (Greed), VIX 20 → 45 (Neutral/Fear)
        // VIX 25 → 25 (Fear), VIX 35 → 5 (Extreme Fear)
        let vixScore: number;
        if (vix <= 12) vixScore = 85;
        else if (vix <= 17) vixScore = 85 - ((vix - 12) / 5) * 25;   // 85→60
        else if (vix <= 20) vixScore = 60 - ((vix - 17) / 3) * 15;   // 60→45
        else if (vix <= 25) vixScore = 45 - ((vix - 20) / 5) * 20;   // 45→25
        else if (vix <= 35) vixScore = 25 - ((vix - 25) / 10) * 20;  // 25→5
        else vixScore = 5;

        components.vix = clamp(vixScore);
        weightedScores.push({ score: clamp(vixScore), weight: 0.25 });
      }
    } catch { /* skip */ }

    // ── Signal 2: Safe Haven Demand — TLT vs SPY intraday return (30% weight) ──
    // CNN measures stock returns vs bond returns. On fear days, money floods
    // into Treasuries (TLT up) and out of stocks (SPY down) = strong fear signal.
    // This is the most REACTIVE signal to today's market conditions.
    try {
      const [spy, tlt] = await Promise.all([
        fetchQuote('SPY'),
        fetchQuote('TLT'),
      ]);
      if (spy && tlt) {
        // If TLT is outperforming SPY, that's fear (money moving to safety)
        // Spread: SPY changePct - TLT changePct
        // +5% spread (stocks crushing bonds) = Extreme Greed (90)
        //  0% spread = Neutral (50)
        // -5% spread (bonds crushing stocks) = Extreme Fear (10)
        const spread = spy.changePct - tlt.changePct;
        const safeHavenScore = clamp(50 + spread * 8);
        components.safeHaven = safeHavenScore;
        weightedScores.push({ score: safeHavenScore, weight: 0.30 });
      }
    } catch { /* skip */ }

    // ── Signal 3: Junk Bond Demand — HYG vs LQD intraday return (25% weight) ──
    // When investors are fearful they dump high-yield (junk) bonds for safer
    // investment-grade bonds. HYG underperforming LQD = Fear.
    try {
      const [hyg, lqd] = await Promise.all([
        fetchQuote('HYG'),
        fetchQuote('LQD'),
      ]);
      if (hyg && lqd) {
        // HYG - LQD spread: positive = risk-on (greed), negative = risk-off (fear)
        // +1% HYG outperforming → Greed (80), 0% = neutral (50), -1% → Fear (20)
        const junkSpread = hyg.changePct - lqd.changePct;
        const junkScore = clamp(50 + junkSpread * 30);
        components.junkBond = junkScore;
        weightedScores.push({ score: junkScore, weight: 0.25 });
      }
    } catch { /* skip */ }

    // ── Signal 4: SPY Put/Call Ratio (20% weight) ─────────────────────────
    // Only use when we have genuine volume data (not during pre-market)
    try {
      const url = 'https://query2.finance.yahoo.com/v7/finance/options/SPY';
      const res = await fetch(getProxy() + encodeURIComponent(url));
      if (res.ok) {
        const json = await res.json();
        const chain = json?.optionChain?.result?.[0]?.options?.[0];
        const calls: { volume?: number }[] = chain?.calls ?? [];
        const puts: { volume?: number }[] = chain?.puts ?? [];
        const callVol = calls.reduce((s, c) => s + (c.volume ?? 0), 0);
        const putVol = puts.reduce((s, p) => s + (p.volume ?? 0), 0);

        if (callVol > 100 && putVol > 100) {
          const pcr = putVol / callVol;
          // PCR 0.5 → 80 (Greed), 0.9 → 50 (Neutral), 1.4 → 15 (Fear)
          const pcrScore = clamp(100 - ((pcr - 0.5) / 0.9) * 80);
          components.pcr = pcrScore;
          weightedScores.push({ score: pcrScore, weight: 0.20 });
        }
      }
    } catch { /* skip */ }

    // ── Final: weighted average of available signals ───────────────────────
    if (weightedScores.length === 0) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    // Re-normalize weights to sum to 1 based on what's available
    const totalWeight = weightedScores.reduce((s, x) => s + x.weight, 0);
    const finalScore = Math.round(
      weightedScores.reduce((s, x) => s + (x.score * (x.weight / totalWeight)), 0)
    );

    console.log(
      `[FearGreed] VIX=${components.vix} SafeHaven=${components.safeHaven} JunkBond=${components.junkBond} PCR=${components.pcr} → Final=${finalScore} (${classify(finalScore)})`
    );

    setData({
      value: finalScore,
      classification: classify(finalScore),
      timestamp: Math.floor(Date.now() / 1000).toString(),
      loading: false,
      error: null,
      components,
    });
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 1min refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  return data;
};
