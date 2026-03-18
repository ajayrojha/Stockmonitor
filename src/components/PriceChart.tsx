import type { MarketData } from '../hooks/useMarketData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PriceChartProps {
  data: MarketData[];
}

export const PriceChart = ({ data }: PriceChartProps) => {
  return (
    <div className="glass-card" style={{ height: '400px', padding: '1.5rem', marginTop: '1.5rem' }}>
      <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Live S&P 500 Index</h3>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="timestamp" 
            stroke="var(--text-secondary)" 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            stroke="var(--text-secondary)" 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => val.toFixed(0)}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(16, 20, 28, 0.9)', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              backdropFilter: 'blur(8px)'
            }} 
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
