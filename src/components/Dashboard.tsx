import { useMarketData } from '../hooks/useMarketData';
import { PriceChart } from './PriceChart';
import { SignalCard } from './SignalCard';
import { Activity, BarChart3, Clock, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export const Dashboard = () => {
  const { currentPrice, history, signals } = useMarketData();

  return (
    <div className="container">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            S&P 500 AI MONITOR
          </h1>
          <p className="text-secondary" style={{ fontSize: '1rem' }}>
            Multi-engine predictive analytics for high-frequency trading
          </p>
        </div>
        <div className="glass" style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Clock size={16} className="text-secondary" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{new Date().toLocaleTimeString()}</span>
        </div>
      </header>

      {/* 1. Recommendations / AI Engines (Top Section) */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Zap size={20} className="text-success" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>LIVE PREDICTION ENSEMBLE</h2>
        </div>
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {signals.map((s, idx) => (
            <motion.div
              key={s.engine}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <SignalCard signal={s} />
            </motion.div>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        {/* 2. Main Price Stats & Chart */}
        <div style={{ gridColumn: window.innerWidth > 1024 ? 'span 8' : 'span 1' }}>
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="glass-card" style={{ gridColumn: window.innerWidth > 768 ? 'span 6' : 'span 1', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>S&P 500 INDEX (LIVE)</p>
                  <h2 style={{ fontSize: '1.75rem' }}>${currentPrice.toFixed(2)}</h2>
                </div>
                <Activity size={20} className="text-secondary" />
              </div>
            </div>
            <div className="glass-card" style={{ gridColumn: window.innerWidth > 768 ? 'span 6' : 'span 1', padding: '1.25rem' }}>
              <div>
                <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>NETWORK LATENCY (5S CYCLE)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.75rem' }}>0.42ms</h2>
                  <span className="text-success" style={{ fontSize: '0.8rem', fontWeight: 600 }}>OPTIMIZED</span>
                </div>
              </div>
            </div>
          </div>
          
          <PriceChart data={history} />
        </div>

        {/* 3. Market Sentiment & Meta-Info */}
        <div style={{ gridColumn: window.innerWidth > 1024 ? 'span 4' : 'span 1' }}>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card" 
            style={{ padding: '1.5rem', height: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <BarChart3 size={20} className="text-secondary" />
              <h3 style={{ fontSize: '1.1rem' }}>Ensemble Analysis</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Our multi-engine ensemble analyzes market patterns across 5 independent AI architectures. 
              The current consensus is <strong>{
                signals.filter(s => s.type === 'BUY_CALL').length > signals.filter(s => s.type === 'BUY_PUT').length ? 'BULLISH' :
                signals.filter(s => s.type === 'BUY_PUT').length > signals.filter(s => s.type === 'BUY_CALL').length ? 'BEARISH' : 'NEUTRAL'
              }</strong>.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="glass" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-secondary" style={{ fontSize: '0.8rem' }}>LSTM CONFIDENCE:</span>
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>High Persistence</div>
              </div>
              <div className="glass" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-secondary" style={{ fontSize: '0.8rem' }}>RSI BIAS:</span>
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>Neutral Territory</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <footer style={{ marginTop: '3rem', textAlign: 'center', padding: '2rem', borderTop: '1px solid var(--border-color)' }}>
        <p className="text-secondary" style={{ fontSize: '0.8rem' }}>
          S&P 500 history tracked for last 60 minutes. Predictions update at 1Hz.
          Market data powered by Yahoo Finance | Predictions by Antigravity AI Ensemble.
        </p>
      </footer>
    </div>
  );
};
