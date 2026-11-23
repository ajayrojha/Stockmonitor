import { useState, useEffect, useCallback } from 'react';
import { fetchJsonViaProxy } from '../lib/proxyFetch';

export interface OptionsFlow {
  pcr: number | null;           // Put/Call Volume Ratio
  putVolume: number;
  callVolume: number;
  classification: string;       // 'Call Dominant' | 'Put Dominant' | 'Balanced'
  loading: boolean;
  error: string | null;
}


export const useOptionsFlow = (symbol = 'SPY') => {
  const [flow, setFlow] = useState<OptionsFlow>({
    pcr: null,
    putVolume: 0,
    callVolume: 0,
    classification: 'Balanced',
    loading: true,
    error: null,
  });

  const fetchFlow = useCallback(async () => {
    try {
      // Yahoo Finance public options endpoint (no auth required)
      const url = `https://query2.finance.yahoo.com/v7/finance/options/${symbol}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = await fetchJsonViaProxy<any>(url);

      const chain = json?.optionChain?.result?.[0]?.options?.[0];
      if (!chain) throw new Error('No options data');

      const calls: { volume?: number; openInterest?: number }[] = chain.calls ?? [];
      const puts: { volume?: number; openInterest?: number }[] = chain.puts ?? [];

      let callVolume = calls.reduce((sum, c) => sum + (c.volume ?? 0), 0);
      let putVolume = puts.reduce((sum, p) => sum + (p.volume ?? 0), 0);

      // Fallback to Open Interest if daily volume is zero (e.g. market closed)
      if (callVolume === 0 && putVolume === 0) {
        callVolume = calls.reduce((sum, c) => sum + (c.openInterest ?? 0), 0);
        putVolume = puts.reduce((sum, p) => sum + (p.openInterest ?? 0), 0);
      }

      if (callVolume === 0) throw new Error('No call volume / open interest found');

      const pcr = parseFloat((putVolume / callVolume).toFixed(2));
      const classification =
        pcr < 0.85 ? 'Call Dominant' : pcr > 1.05 ? 'Put Dominant' : 'Balanced';

      setFlow({ pcr, putVolume, callVolume, classification, loading: false, error: null });
    } catch (err) {
      setFlow(prev => {
        if (prev.pcr !== null) return { ...prev, loading: false };
        return { ...prev, loading: false, error: `Options data unavailable` };
      });
    }
  }, [symbol]);

  useEffect(() => {
    fetchFlow();
    const interval = setInterval(fetchFlow, 15000); // 15s — options volume updates ~every 15s during market hours
    return () => clearInterval(interval);
  }, [fetchFlow]);

  return flow;
};
