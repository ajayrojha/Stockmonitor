import type { Signal } from '../hooks/useMarketData';
import { TrendingUp, TrendingDown, MinusCircle, ShieldCheck, Brain, Cpu, MessageSquare, LineChart as ChartIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignalCardProps {
  signal: Signal;
}

const getEngineIcon = (engine: string) => {
  if (engine.includes('MA')) return <ChartIcon size={18} />;
  if (engine.includes('LSTM')) return <Cpu size={18} />;
  if (engine.includes('Brain')) return <Brain size={18} />;
  if (engine.includes('Sentiment')) return <MessageSquare size={18} />;
  return <ShieldCheck size={18} />;
};

export const SignalCard = ({ signal }: SignalCardProps) => {
  const isBuyCall = signal.type === 'BUY_CALL';
  const isBuyPut = signal.type === 'BUY_PUT';
  const isHold = signal.type === 'HOLD';

  return (
    <div className={`glass-card ${isBuyCall ? 'pulse-success' : isBuyPut ? 'pulse-danger' : ''}`} style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.5s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        {getEngineIcon(signal.engine)}
        <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{signal.engine}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${signal.engine}-${signal.type}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            {isBuyCall && <TrendingUp size={28} className="text-success" />}
            {isBuyPut && <TrendingDown size={28} className="text-danger" />}
            {isHold && <MinusCircle size={28} style={{ color: 'var(--warning)' }} />}
            
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              {isBuyCall ? 'CALL' : isBuyPut ? 'PUT' : 'HOLD'}
            </h2>
          </div>
          
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', minHeight: '2.5rem' }}>
            {signal.prediction}
          </p>

          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${signal.strength}%` }}
              style={{ 
                height: '100%', 
                background: isBuyCall ? 'var(--success)' : isBuyPut ? 'var(--danger)' : 'var(--warning)',
                boxShadow: `0 0 10px ${isBuyCall ? 'var(--success)' : isBuyPut ? 'var(--danger)' : 'var(--warning)'}`
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            <span>Strength</span>
            <span>{signal.strength}%</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
