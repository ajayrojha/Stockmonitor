import type { Signal } from '../hooks/useMarketData';
import { TrendingUp, TrendingDown, MinusCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignalCardProps {
  signal: Signal;
}

export const SignalCard = ({ signal }: SignalCardProps) => {
  const isBuyCall = signal.type === 'BUY_CALL';
  const isBuyPut = signal.type === 'BUY_PUT';
  const isHold = signal.type === 'HOLD';

  return (
    <div className={`glass-card ${isBuyCall ? 'pulse-success' : isBuyPut ? 'pulse-danger' : ''}`} style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', transition: 'all 0.5s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
        <ShieldCheck size={20} />
        <span style={{ fontSize: '0.9rem', fontWeight: 500, letterSpacing: '0.05em' }}>AI PREDICTOR ENGINE (10M)</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={signal.type}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            {isBuyCall && <TrendingUp size={48} className="text-success" />}
            {isBuyPut && <TrendingDown size={48} className="text-danger" />}
            {isHold && <MinusCircle size={48} style={{ color: 'var(--warning)' }} />}
            
            <h1 style={{ fontSize: '3rem', fontWeight: 700 }}>
              {isBuyCall ? 'CALL' : isBuyPut ? 'PUT' : 'HOLD'}
            </h1>
          </div>
          
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {signal.prediction}
          </p>

          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${signal.strength}%` }}
              style={{ 
                height: '100%', 
                background: isBuyCall ? 'var(--success)' : isBuyPut ? 'var(--danger)' : 'var(--warning)',
                boxShadow: `0 0 20px ${isBuyCall ? 'var(--success)' : isBuyPut ? 'var(--danger)' : 'var(--warning)'}`
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Signal Strength</span>
            <span>{signal.strength}%</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
