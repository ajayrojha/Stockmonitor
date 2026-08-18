import { useState, useEffect, useCallback } from 'react';

export interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  thumbnail?: {
    resolutions: Array<{
      url: string;
      width: number;
      height: number;
      tag: string;
    }>;
  };
}

export const useMarketNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsSentiment, setNewsSentiment] = useState<number>(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      // Changed query to focus on Catalysts
      const symbol = 'S%26P+500+Market+Catalyst';
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${symbol}&newsCount=20`;
      const PROXIES = [
        'https://api.cors.lol/?url=',
        'https://corsproxy.io/?url=',
        'https://api.allorigins.win/raw?url=',
      ];
      let proxyIdx = 0;
      const getProxy = () => { const p = PROXIES[proxyIdx % PROXIES.length]; proxyIdx++; return p; };
      const proxyUrl = `${getProxy()}${encodeURIComponent(url)}`;
      
      const response = await fetch(proxyUrl);
      const parsedData = await response.json();
      
      if (parsedData.news) {
        const rawNews: NewsItem[] = parsedData.news;
        const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600; // 10 minutes in seconds

        // Calculate real news sentiment based on keyword analysis of all headlines
        const positiveWords = ['gain', 'rise', 'beat', 'surge', 'up', 'growth', 'bullish', 'higher', 'positive', 'strong', 'recovery', 'boost', 'climb', 'rally', 'profit', 'expansion', 'support', 'optimism', 'high', 'win', 'gains', 'lead', 'jump'];
        const negativeWords = ['drop', 'fall', 'miss', 'plunge', 'down', 'bearish', 'lower', 'negative', 'weak', 'slump', 'decline', 'fear', 'loss', 'recession', 'concern', 'worry', 'risk', 'debt', 'inflation', 'low', 'losses', 'warn', 'warning'];

        let bullishCount = 0;
        let bearishCount = 0;

        rawNews.forEach(item => {
          const title = item.title.toLowerCase();
          const bullScore = positiveWords.filter(w => title.includes(w)).length;
          const bearScore = negativeWords.filter(w => title.includes(w)).length;
          if (bullScore > bearScore) bullishCount++;
          else if (bearScore > bullScore) bearishCount++;
        });

        const total = bullishCount + bearishCount || 1;
        const sentimentScore = Math.min(95, Math.max(15, Math.round((bullishCount / total) * 100)));
        setNewsSentiment(sentimentScore);

        // Filtering Logic: remove clickbait AND items older than 10 minutes
        const filtered = rawNews.filter(item => {
          if (item.providerPublishTime < tenMinutesAgo) return false;
          const title = item.title.toLowerCase();
          const clickbaitTerms = [
            '3 stocks', '7 stocks', '5 stocks', '10 stocks', 'stocks to buy', 
            'best stocks', 'top stocks', 'dirt cheap', 'thank yourself', 
            'forget nvidia', 'better than', 'stock to own', 'millionaire maker'
          ];
          return !clickbaitTerms.some(term => title.includes(term));
        });

        // Prioritization (Catalysts first)
        const sorted = filtered.sort((a, b) => {
          const priorityTerms = ['fed', 'cpi', 'inflation', 'earnings', 'rate', 'yield', 'gdp', 'jobs', 'unemployment', 'sec'];
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();
          
          const aPriority = priorityTerms.some(term => aTitle.includes(term)) ? 1 : 0;
          const bPriority = priorityTerms.some(term => bTitle.includes(term)) ? 1 : 0;
          
          if (aPriority !== bPriority) return bPriority - aPriority;
          return b.providerPublishTime - a.providerPublishTime; // Decending by time if same priority
        });

        setNews(sorted.slice(0, 8)); // Keep top 8 high-quality items
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching market news:', err);
      setNews(prev => {
        if (prev.length === 0) setError('Failed to load market news');
        return prev;
      });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000); // 60s — news headlines update every few minutes
    return () => clearInterval(interval);
  }, [fetchNews]);

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return { news, loading, error, newsSentiment, getTimeAgo, refresh: fetchNews };
};
