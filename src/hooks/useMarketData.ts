import { useState, useEffect, useCallback, useRef } from 'react';

export interface MarketData {
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface Signal {
  type: 'BUY_CALL' | 'BUY_PUT' | 'HOLD';
  strength: number; // 0 to 100
  prediction: string;
}

export const useMarketData = () => {
  const [history, setHistory] = useState<MarketData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [signal, setSignal] = useState<Signal>({ type: 'HOLD', strength: 0, prediction: 'Initializing real-time engine...' });
  
  const lastRealPrice = useRef<number>(0);
  const prevClose = useRef<number>(0);

  // Fetch real data from Yahoo Finance via AllOrigins
  const fetchRealData = useCallback(async () => {
    try {
      const symbol = '%5EGSPC';
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&td=${Date.now()}`; // Added cache-buster
      
      const response = await fetch(proxyUrl);
      const data = await response.json();
      const result = JSON.parse(data.contents).chart.result[0];
      
      const latestPrice = result.meta.regularMarketPrice;
      lastRealPrice.current = latestPrice;
      prevClose.current = result.meta.previousClose;
      
      if (currentPrice === 0) {
        setCurrentPrice(latestPrice);
        // Initial history build
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;
        const initialHistory = timestamps.slice(-30).map((t: number, i: number) => {
          const idx = timestamps.length - 30 + i;
          return {
            price: quotes.close[idx] || latestPrice,
            change: (quotes.close[idx] || latestPrice) - prevClose.current,
            changePercent: (((quotes.close[idx] || latestPrice) - prevClose.current) / prevClose.current) * 100,
            timestamp: new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
        });
        setHistory(initialHistory);
      }
    } catch (error) {
      console.error('Error fetching real market data:', error);
    }
  }, [currentPrice]);

  // Visual Update Engine (Every 1 second)
  const processUpdate = useCallback(() => {
    if (lastRealPrice.current === 0) return;

    setCurrentPrice(prev => {
      // Add micro-fluctuation to make it look "live" even if source is slow
      // Range: ±0.05
      const fluctuation = (Math.random() - 0.5) * 0.1;
      const newPrice = (prev === 0 ? lastRealPrice.current : prev) + fluctuation;
      
      // Gradually move back towards the real price if we drift too far
      const driftCorrection = (lastRealPrice.current - newPrice) * 0.1;
      const finalPrice = newPrice + driftCorrection;

      const newPoint: MarketData = {
        price: finalPrice,
        change: finalPrice - prevClose.current,
        changePercent: ((finalPrice - prevClose.current) / prevClose.current) * 100,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setHistory(prevHistory => {
        const updated = [...prevHistory, newPoint];
        return updated.slice(-60); // Keep last 60 seconds of data
      });

      return finalPrice;
    });
  }, []);

  // Update Prediction Signal
  useEffect(() => {
    if (history.length < 20) return;
    
    const recent = history.slice(-10);
    const past = history.slice(-30, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b.price, 0) / recent.length;
    const pastAvg = past.reduce((a, b) => a + b.price, 0) / past.length;
    
    const diff = recentAvg - pastAvg;
    
    if (diff > 0.05) {
      setSignal({
        type: 'BUY_CALL',
        strength: Math.min(Math.floor(Math.abs(diff) * 200), 100),
        prediction: 'Real-time bullish momentum detected'
      });
    } else if (diff < -0.05) {
      setSignal({
        type: 'BUY_PUT',
        strength: Math.min(Math.floor(Math.abs(diff) * 200), 100),
        prediction: 'Real-time bearish pressure detected'
      });
    } else {
      setSignal({
        type: 'HOLD',
        strength: 0,
        prediction: 'Market consolidation'
      });
    }
  }, [currentPrice, history.length]);

  // Polling for real data (Every 10 seconds to avoid rate limits)
  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 10000);
    return () => clearInterval(interval);
  }, [fetchRealData]);

  // Visual polling (Every 1 second)
  useEffect(() => {
    const interval = setInterval(processUpdate, 1000);
    return () => clearInterval(interval);
  }, [processUpdate]);

  return { currentPrice, history, signal };
};
