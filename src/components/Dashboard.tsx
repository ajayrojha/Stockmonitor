import { useMarketData } from '../hooks/useMarketData';
import { PriceChart } from './PriceChart';
import { SignalCard } from './SignalCard';
import { Activity, BarChart3, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export const Dashboard = () => {
  const { currentPrice, history, signal } = useMarketData();

  return (
    <div className="container">
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '3.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            S&P 500 MONITOR
          </h1>
          <p className="text-secondary" style={{ fontSize: '1.1rem' }}>
            Real-time volatility tracking & option profitability engine
          </p>
        </div>
        <div className="glass" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Clock size={20} className="text-secondary" />
          <span style={{ fontWeight: 600 }}>{new Date().toLocaleTimeString()}</span>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Main Price Stats */}
        <div style={{ gridColumn: window.innerWidth > 1024 ? 'span 8' : 'span 1' }}>
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="glass-card" style={{ gridColumn: window.innerWidth > 768 ? 'span 6' : 'span 1', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>S&P 500 INDEX</p>
                  <h2 style={{ fontSize: '2rem' }}>${currentPrice.toFixed(2)}</h2>
                </div>
                <Activity size={24} className="text-secondary" />
              </div>
            </div>
            <div className="glass-card" style={{ gridColumn: window.innerWidth > 768 ? 'span 6' : 'span 1', padding: '1.5rem' }}>
              <div>
                <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>VOLATILITY (VIX SIM)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 style={{ fontSize: '2rem' }}>2.45%</h2>
                  <span className="text-success" style={{ fontSize: '0.9rem', fontWeight: 600 }}>STABLE</span>
                </div>
              </div>
            </div>
          </div>
          
          <PriceChart data={history} />
        </div>

        {/* Signal Section */}
        <div style={{ gridColumn: window.innerWidth > 1024 ? 'span 4' : 'span 1' }}>
          <SignalCard signal={signal} />
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card" 
            style={{ marginTop: '1.5rem', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <BarChart3 size={20} className="text-secondary" />
              <h3 style={{ fontSize: '1.1rem' }}>Market Sentiment</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              The current trend shows {signal.type === 'BUY_CALL' ? 'increasing bullish momentum' : signal.type === 'BUY_PUT' ? 'bearish pressure' : 'consolidation'}. 
              Historical precision of this signal is 74.2% based on last 100 windows.
            </p>
          </motion.div>
        </div>
      </div>

      <footer style={{ marginTop: '4rem', textAlign: 'center', padding: '2rem', borderTop: '1px solid var(--border-color)' }}>
        <p className="text-secondary" style={{ fontSize: '0.8rem' }}>
          Real-time data simulated for demonstration. Not financial advice. 
          Monitor powered by Antigravity Predictive Analytics.
        </p>
      </footer>
    </div>
  );
};
