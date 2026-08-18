import type { Signal } from '../hooks/useMarketData';
import { TrendingUp, TrendingDown, MinusCircle, ShieldCheck, Brain, Cpu, MessageSquare, LineChart as ChartIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignalCardProps {
  signal: Signal;
}

const getEngineIcon = (engine: string, size = 18) => {
  if (engine.includes('MA')) return <ChartIcon size={size} />;
  if (engine.includes('LSTM')) return <Cpu size={size} />;
  if (engine.includes('Brain')) return <Brain size={size} />;
  if (engine.includes('Sentiment')) return <MessageSquare size={size} />;
  return <ShieldCheck size={size} />;
};

export const SignalCard = ({ signal }: SignalCardProps) => {
  const isBuyCall = signal.type === 'BUY_CALL';
  const isBuyPut = signal.type === 'BUY_PUT';
  const isHold = signal.type === 'HOLD';
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className={`glass-card ${isBuyCall ? 'pulse-success' : isBuyPut ? 'pulse-danger' : ''}`} style={{ 
      padding: '0.6rem 0.75rem', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '0.4rem',
      transition: 'all 0.4s ease', 
      flex: 1,
      minWidth: isMobile ? '0' : '140px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
        {getEngineIcon(signal.engine, 12)}
        <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {signal.engine.split(' (')[0]}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${signal.engine}-${signal.type}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isBuyCall && <TrendingUp size={18} className="text-success" />}
            {isBuyPut && <TrendingDown size={18} className="text-danger" />}
            {isHold && <MinusCircle size={18} style={{ color: 'var(--warning)' }} />}
            
            <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: isBuyCall ? 'var(--success)' : isBuyPut ? 'var(--danger)' : 'var(--warning)' }}>
              {isBuyCall ? 'CALL' : isBuyPut ? 'PUT' : 'HOLD'}
            </h2>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.15rem' }}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${signal.strength}%` }}
                style={{ 
                  height: '100%', 
                  background: isBuyCall ? 'var(--success)' : isBuyPut ? 'var(--danger)' : 'var(--warning)',
                  boxShadow: `0 0 10px ${isBuyCall ? 'var(--success-glow)' : isBuyPut ? 'var(--danger-glow)' : 'var(--warning)'}`
                }} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span style={{ opacity: 0.5 }}>STR</span>
              <span style={{ color: 'var(--text-primary)' }}>{signal.strength}%</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
