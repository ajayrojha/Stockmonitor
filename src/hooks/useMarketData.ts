import { useState, useEffect, useCallback, useRef } from 'react';

export interface MarketData {
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export type SignalType = 'BUY_CALL' | 'BUY_PUT' | 'HOLD';

export interface Signal {
  engine: string;
  type: SignalType;
  strength: number; // 0 to 100
  prediction: string;
}

export const useMarketData = () => {
  const [history, setHistory] = useState<MarketData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [signals, setSignals] = useState<Signal[]>([
    { engine: 'MA Engine', type: 'HOLD', strength: 0, prediction: 'Initializing...' },
    { engine: 'LSTM Model', type: 'HOLD', strength: 0, prediction: 'Initializing...' },
    { engine: 'Brain.js', type: 'HOLD', strength: 0, prediction: 'Initializing...' },
    { engine: 'Sentiment', type: 'HOLD', strength: 0, prediction: 'Initializing...' },
    { engine: 'Tech Indicators', type: 'HOLD', strength: 0, prediction: 'Initializing...' },
  ]);
  
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
        return updated.slice(-3600); // Keep last 1 hour of data at 1s intervals
      });

      return finalPrice;
    });
  }, []);

  // Update Prediction Signals (Every 1 second)
  useEffect(() => {
    if (history.length < 20) return;
    
    // 1. Moving Average Engine (Traditional)
    const recent = history.slice(-10);
    const past = history.slice(-30, -10);
    const recentAvg = recent.reduce((a, b) => a + b.price, 0) / recent.length;
    const pastAvg = past.reduce((a, b) => a + b.price, 0) / past.length;
    const diff = recentAvg - pastAvg;

    const maSignal: Signal = {
      engine: 'MA Engine',
      type: diff > 0.05 ? 'BUY_CALL' : diff < -0.05 ? 'BUY_PUT' : 'HOLD',
      strength: Math.min(Math.floor(Math.abs(diff) * 200), 100),
      prediction: diff > 0.05 ? 'Real-time bullish momentum' : diff < -0.05 ? 'Real-time bearish pressure' : 'Market consolidation'
    };

    // 2. LSTM Simulated Engine (Pattern Persistence)
    const volatility = history.slice(-10).reduce((acc, val, i, arr) => i > 0 ? acc + Math.abs(val.price - arr[i-1].price) : acc, 0) / 9;
    const trend = history.slice(-5).every((v, i, a) => i === 0 || v.price >= a[i-1].price) ? 'BUY_CALL' : 
                  history.slice(-5).every((v, i, a) => i === 0 || v.price <= a[i-1].price) ? 'BUY_PUT' : 'HOLD';
    const lstmSignal: Signal = {
      engine: 'LSTM Model',
      type: trend,
      strength: Math.min(Math.floor(volatility * 500) + 40, 95),
      prediction: trend !== 'HOLD' ? 'Neural pattern sequence identified' : 'Neutral sequence detected'
    };

    // 3. Brain.js Engine (Micro-frequency logic)
    const last3 = history.slice(-3);
    const brainsType = last3[2].price > last3[1].price && last3[1].price > last3[0].price ? 'BUY_CALL' : 
                       last3[2].price < last3[1].price && last3[1].price < last3[0].price ? 'BUY_PUT' : 'HOLD';
    const brainsSignal: Signal = {
      engine: 'Brain.js',
      type: brainsType,
      strength: 65 + Math.floor(Math.random() * 15),
      prediction: brainsType !== 'HOLD' ? 'Short-term micro-trend matched' : 'Searching for micro-patterns'
    };

    // 4. Sentiment Engine (Bias-weighted random)
    const dailyChange = currentPrice - prevClose.current;
    const sentimentSeed = Math.random();
    const sentimentType = dailyChange > 0 ? (sentimentSeed > 0.4 ? 'BUY_CALL' : 'HOLD') : (sentimentSeed > 0.4 ? 'BUY_PUT' : 'HOLD');
    const sentimentSignal: Signal = {
      engine: 'Social/News Sentiment',
      type: sentimentType,
      strength: 70 + Math.floor(Math.random() * 20),
      prediction: sentimentType === 'BUY_CALL' ? 'Bullish chatter increasing' : sentimentType === 'BUY_PUT' ? 'Negative news flow' : 'Neutral news sentiment'
    };

    // 5. Tech Indicators (RSI Simulation)
    const gains = history.slice(-14).reduce((acc, val, i, arr) => i > 0 && val.price > arr[i-1].price ? acc + (val.price - arr[i-1].price) : acc, 0);
    const losses = history.slice(-14).reduce((acc, val, i, arr) => i > 0 && val.price < arr[i-1].price ? acc + Math.abs(val.price - arr[i-1].price) : acc, 0);
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - (100 / (1 + rs));
    const techType = rsi < 35 ? 'BUY_CALL' : rsi > 65 ? 'BUY_PUT' : 'HOLD';
    const techSignal: Signal = {
      engine: 'Tech Indicators (RSI)',
      type: techType,
      strength: Math.min(Math.floor(Math.abs(rsi - 50) * 2), 100),
      prediction: rsi < 35 ? 'Oversold - Rebound expected' : rsi > 65 ? 'Overbought - Correction likely' : 'RSI in neutral zone'
    };

    setSignals([maSignal, lstmSignal, brainsSignal, sentimentSignal, techSignal]);
  }, [currentPrice, history.length]);

  // Polling for real data (Update every 5 seconds now)
  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 5000);
    return () => clearInterval(interval);
  }, [fetchRealData]);

  // Visual polling (Every 1 second)
  useEffect(() => {
    const interval = setInterval(processUpdate, 1000);
    return () => clearInterval(interval);
  }, [processUpdate]);

  return { currentPrice, history, signals };
};
