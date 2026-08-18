import { useState, useEffect, useCallback } from 'react';

const BULLISH_WORDS = [
  'calls', 'call', 'bull', 'bullish', 'long', 'moon', 'mooning', 'ath',
  'buy', 'buying', 'green', 'squeeze', 'rally', 'rallying', 'breakout',
  'upgrade', 'beat', 'surge', 'surging', 'soar', 'soaring', 'gain',
  'gains', 'up', 'higher', 'strong', 'strength', 'bounce', 'recovery',
  'load', 'loading', 'yolo', 'all in',
];

const BEARISH_WORDS = [
  'puts', 'put', 'bear', 'bearish', 'short', 'shorting', 'crash', 'crashing',
  'dump', 'dumping', 'red', 'sell', 'selling', 'drop', 'dropping', 'recession',
  'correction', 'downgrade', 'miss', 'plunge', 'plunging', 'tank', 'tanking',
  'fear', 'collapse', 'collapsing', 'bubble', 'overvalued', 'rip', 'rekt',
  'down', 'lower', 'weak', 'weakness', 'rug', 'margin call',
];

export interface RedditSentiment {
  bullishPercent: number;
  bearishPercent: number;
  sampleSize: number;
  topPost: string;
  subreddits: string[];
  loading: boolean;
  error: string | null;
}

export const useRedditSentiment = () => {
  const [sentiment, setSentiment] = useState<RedditSentiment>({
    bullishPercent: 50,
    bearishPercent: 50,
    sampleSize: 0,
    topPost: '',
    subreddits: ['r/wallstreetbets', 'r/investing'],
    loading: true,
    error: null,
  });

  const fetchSentiment = useCallback(async () => {
    try {
      const proxy = 'https://api.cors.lol/?url=';
      const [wsbRes, investingRes] = await Promise.all([
        fetch(proxy + encodeURIComponent('https://www.reddit.com/r/wallstreetbets/hot.json?limit=50')),
        fetch(proxy + encodeURIComponent('https://www.reddit.com/r/investing/hot.json?limit=25')),
      ]);

      if (!wsbRes.ok) throw new Error('Reddit API error');
      const wsbJson = await wsbRes.json();
      const investingJson = await investingRes.json();

      const allPosts: { title: string; selftext: string; score: number }[] = [
        ...(wsbJson?.data?.children || []),
        ...(investingJson?.data?.children || []),
      ].map((c: { data: { title: string; selftext: string; score: number } }) => c.data);

      let bullish = 0;
      let bearish = 0;
      let topPost = '';
      let topScore = -Infinity;
      let validSample = 0;

      const CRYPTO_TERMS = ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'coinbase', 'doge', 'shib', 'binance'];
      const EQUITY_TERMS = ['spy', 'sp500', 's&p', 'stock', 'calls', 'puts', 'earnings', 'dividend', 'market'];

      for (const post of allPosts) {
        const text = `${post.title} ${post.selftext || ''}`.toLowerCase();
        
        // Skip crypto posts entirely
        const isCrypto = CRYPTO_TERMS.some(term => text.includes(term));
        if (isCrypto) continue;

        const hasEquity = EQUITY_TERMS.some(term => text.includes(term));
        
        const bHits = BULLISH_WORDS.filter(w => text.includes(w)).length;
        const beHits = BEARISH_WORDS.filter(w => text.includes(w)).length;
        
        const weight = hasEquity ? 2 : 1;

        if (bHits > beHits) bullish += weight;
        else if (beHits > bHits) bearish += weight;
        
        validSample++;

        if (post.score > topScore && hasEquity) { 
          topScore = post.score; 
          topPost = post.title; 
        }
      }
      
      if (!topPost && validSample > 0) topPost = allPosts[0]?.title || '';

      const total = bullish + bearish || 1;
      setSentiment({
        bullishPercent: Math.round((bullish / total) * 100),
        bearishPercent: Math.round((bearish / total) * 100),
        sampleSize: validSample,
        topPost,
        subreddits: ['r/wallstreetbets (Equity Filtered)', 'r/investing (Equity Filtered)'],
        loading: false,
        error: null,
      });
    } catch {
      setSentiment(prev => {
        if (prev.sampleSize > 0) return { ...prev, loading: false };
        return { ...prev, loading: false, error: 'Reddit API unavailable' };
      });
    }
  }, []);

  useEffect(() => {
    fetchSentiment();
    const interval = setInterval(fetchSentiment, 300000); // 5min — Reddit posts don't change second-to-second
    return () => clearInterval(interval);
  }, [fetchSentiment]);

  return sentiment;
};
