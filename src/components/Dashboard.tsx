import { useMarketData } from '../hooks/useMarketData';
import { useMarketIndicators } from '../hooks/useMarketIndicators';
import { PriceChart } from './PriceChart';
import { Activity, BarChart3, Clock, Zap, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { NewsSection } from './NewsSection';
import { useState, useEffect } from 'react';

export const Dashboard = () => {
  const { currentPrice, history, barHistory, signals, technicalDetails, predictionSuite } = useMarketData();
  
  // Real market data sentiment hooks
  const indicators = useMarketIndicators();

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // 1-second ticker so "Xs ago" labels update live
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const age = (ts: number) => {
    if (!ts) return '';
    const s = Math.floor((now - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  };

  // Compile real-data engines consensus. NOTE: `technicalDetails.type` and
  // `predictionSuite.directionalBias` are both derived from the exact same
  // composite score in useMarketData (see techType/bias there) — they are
  // never independent signals, just two views of one number. Counting both
  // used to double-weight that one composite vote under the label
  // "Sentiment" + "Technical", which could make this consensus disagree with
  // the Predictor Suite panel (which shows that same composite score's bias
  // directly) whenever the 3 truly independent engines below outvoted it.
  // Only 4 distinct signals feed the vote now, and the Predictor Suite badge
  // is driven off this same `consensus` value, so the two panels can't
  // contradict each other anymore.
  const regressionSignal = signals.find(s => s.engine.includes('Regression')) || { engine: 'Regression', type: 'HOLD' };
  const emaSignal = signals.find(s => s.engine.includes('EMA')) || { engine: 'EMA Trend', type: 'HOLD' };
  const momentumSignal = signals.find(s => s.engine.includes('Momentum')) || { engine: 'Momentum', type: 'HOLD' };

  const allSignals = [
    regressionSignal,
    emaSignal,
    momentumSignal,
    { engine: 'Technical', type: technicalDetails.type }
  ];

  const callCount = allSignals.filter(s => s.type === 'BUY_CALL').length;
  const putCount = allSignals.filter(s => s.type === 'BUY_PUT').length;
  const consensus = callCount > putCount ? 'BULLISH' : putCount > callCount ? 'BEARISH' : 'NEUTRAL';

  // Predictor Suite panel badge shares this same consensus value (see note
  // above) instead of re-deriving its own from predictionSuite.directionalBias.
  const sentimentType = consensus === 'BULLISH' ? 'BUY_CALL' : consensus === 'BEARISH' ? 'BUY_PUT' : 'HOLD';
  const sentimentStrength = predictionSuite.confidence || 50;

  return (
    <div className="container" style={{ paddingBottom: isMobile ? '2rem' : '5rem' }}>
      <header style={{
        marginBottom: isMobile ? '1rem' : '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.5rem',
        paddingTop: isMobile ? '0.5rem' : '0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        paddingBottom: '0.75rem'
      }}>
        <h1 className="text-gradient" style={{
          fontSize: isMobile ? '1.25rem' : '3rem',
          fontWeight: 800,
          margin: 0,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap'
        }}>
          S&P 500 AI MONITOR
        </h1>

        <div className="glass" style={{
          padding: isMobile ? '0.2rem 0.6rem' : '0.5rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '0.25rem' : '0.75rem',
          fontSize: isMobile ? '0.65rem' : '0.9rem',
          whiteSpace: 'nowrap',
          borderRadius: '20px'
        }}>
          {!isMobile && <Clock size={16} className="text-secondary" />}
          <span style={{ fontWeight: 700 }}>
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </header>

      {/* 1. Recommendations / AI Engines (Top Section) */}
      <section style={{ marginBottom: isMobile ? '1.5rem' : '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem', marginBottom: isMobile ? '0.75rem' : '1.5rem', paddingLeft: '0.25rem' }}>
          <Zap size={isMobile ? 14 : 24} className="text-success" />
          <h2 style={{ fontSize: isMobile ? '0.75rem' : '1.5rem', fontWeight: 700, letterSpacing: '0.02em' }}>
            LIVE PREDICTION ENSEMBLE (10 MINUTE WINDOW)
          </h2>
        </div>

        {/* 3-Column Layout: Sentiment, Technical, Algorithmic */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
          gap: isMobile ? '1rem' : '1.5rem',
        }}>
          {/* Box 1: Sentiment Analysis Hub (Real Social + Real Option PCR) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card"
            style={{
              gridColumn: isMobile ? 'span 1' : 'span 5',
              padding: isMobile ? '1.25rem' : '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '1px solid rgba(34, 211, 238, 0.2)',
              boxShadow: '0 8px 32px rgba(34, 211, 238, 0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
            }} />

            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <span className="text-secondary" style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    PREDICTOR SUITE
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.1rem', color: '#fff' }}>
                    10-Minute S&P 500 Predictor
                  </h3>
                </div>
                <div style={{
                  background: sentimentType === 'BUY_CALL' ? 'rgba(16, 185, 129, 0.12)' : sentimentType === 'BUY_PUT' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  color: sentimentType === 'BUY_CALL' ? 'var(--success)' : sentimentType === 'BUY_PUT' ? 'var(--danger)' : 'var(--warning)',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  border: `1px solid ${sentimentType === 'BUY_CALL' ? 'rgba(16, 185, 129, 0.2)' : sentimentType === 'BUY_PUT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                  boxShadow: sentimentType === 'BUY_CALL' ? '0 0 12px var(--success-glow)' : sentimentType === 'BUY_PUT' ? '0 0 12px var(--danger-glow)' : 'none',
                  whiteSpace: 'nowrap'
                }}>
                  {sentimentType === 'BUY_CALL' ? 'BULLISH' : sentimentType === 'BUY_PUT' ? 'BEARISH' : 'NEUTRAL'} ({sentimentStrength}%)
                </div>
              </div>
 
              {/* Subtitle / Description */}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.25rem' }}>
                Algorithmic forecasting models based on real-time price trend slope, velocity, and statistical oscillators.
              </p>
 
              {/* Grid of details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* 1. Trend Regression Target */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Trend Regression Target (10m)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {predictionSuite.lastUpdated > 0 && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>{age(predictionSuite.lastUpdated)}</span>}
                      <span style={{ color: predictionSuite.regressionSlope >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {predictionSuite.loading ? 'Initializing...' : `Target: $${predictionSuite.projectedTarget.toFixed(2)}`}
                      </span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div className={predictionSuite.loading ? "pulse-bg" : ""} style={{
                      height: '100%',
                      width: predictionSuite.loading ? '100%' : `${Math.min(100, Math.max(0, 50 + (predictionSuite.regressionSlope * 1000)))}%`,
                      background: predictionSuite.regressionSlope >= 0 ? 'var(--success)' : 'var(--danger)'
                    }} />
                  </div>
                </div>
 
                {/* 2. EMA Trend Velocity */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>EMA Trend Velocity</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {predictionSuite.lastUpdated > 0 && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>{age(predictionSuite.lastUpdated)}</span>}
                      <span style={{ color: predictionSuite.emaVelocity >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {predictionSuite.loading ? 'Initializing...' : predictionSuite.emaVelocity >= 0 ? 'Bullish Acceleration' : 'Bearish Deceleration'}
                      </span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div className={predictionSuite.loading ? "pulse-bg" : ""} style={{
                      height: '100%',
                      width: predictionSuite.loading ? '100%' : `${Math.min(100, Math.max(0, 50 + (predictionSuite.emaVelocity * 500)))}%`,
                      background: 'linear-gradient(90deg, var(--danger), var(--warning), var(--success))'
                    }} />
                  </div>
                </div>
 
                {/* 3. Statistical Momentum Vector */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Momentum Vector (RSI / Stoch)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {predictionSuite.lastUpdated > 0 && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>{age(predictionSuite.lastUpdated)}</span>}
                      <span style={{ color: 'var(--text-primary)' }}>
                        {predictionSuite.loading ? 'Initializing...' : `RSI: ${predictionSuite.rsi} | Stoch: ${predictionSuite.stochK}%`}
                      </span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div className={predictionSuite.loading ? "pulse-bg" : ""} style={{
                      height: '100%',
                      width: predictionSuite.loading ? '100%' : `${(predictionSuite.rsi + predictionSuite.stochK) / 2}%`,
                      background: 'linear-gradient(90deg, var(--accent-primary), var(--success))'
                    }} />
                  </div>
                </div>
 
                {/* 4. Expected Range */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Expected 10m Range (Bollinger Bounds)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {predictionSuite.lastUpdated > 0 && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>{age(predictionSuite.lastUpdated)}</span>}
                      <span style={{ color: 'var(--text-primary)' }}>
                        {predictionSuite.loading ? 'Initializing...' : `$${predictionSuite.expectedRange.lower.toFixed(1)} - $${predictionSuite.expectedRange.upper.toFixed(1)}`}
                      </span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                    {predictionSuite.loading ? (
                      <div className="pulse-bg" style={{ height: '100%', width: '100%', background: 'rgba(255,255,255,0.1)' }} />
                    ) : (
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, ((currentPrice - predictionSuite.expectedRange.lower) / (predictionSuite.expectedRange.upper - predictionSuite.expectedRange.lower || 1)) * 100))}%`,
                        background: 'var(--accent-secondary)',
                        borderRadius: '3px'
                      }} />
                    )}
                  </div>
                </div>
 
                {/* 5. Confidence Score */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Algorithmic Consensus Confidence</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {predictionSuite.lastUpdated > 0 && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>{age(predictionSuite.lastUpdated)}</span>}
                      <span style={{ color: 'var(--text-primary)' }}>
                        {predictionSuite.loading ? 'Initializing...' : `${predictionSuite.confidence}%`}
                      </span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div className={predictionSuite.loading ? "pulse-bg" : ""} style={{
                      height: '100%',
                      width: predictionSuite.loading ? '100%' : `${predictionSuite.confidence}%`,
                      background: consensus === 'BULLISH' ? 'var(--success)' : consensus === 'BEARISH' ? 'var(--danger)' : 'rgba(255,255,255,0.1)'
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Box 2: Technical Indicators Suite */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card"
            style={{
              gridColumn: isMobile ? 'span 1' : 'span 5',
              padding: isMobile ? '1.25rem' : '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              boxShadow: '0 8px 32px rgba(251, 191, 36, 0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, var(--accent-secondary), #f97316)'
            }} />

            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <span className="text-secondary" style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    TECHNICAL OSCILLATORS
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.1rem', color: '#fff' }}>
                    Real-time Indicators
                  </h3>
                </div>
                <div style={{
                  background: technicalDetails.type === 'BUY_CALL' ? 'rgba(16, 185, 129, 0.12)' : technicalDetails.type === 'BUY_PUT' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  color: technicalDetails.type === 'BUY_CALL' ? 'var(--success)' : technicalDetails.type === 'BUY_PUT' ? 'var(--danger)' : 'var(--warning)',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  border: `1px solid ${technicalDetails.type === 'BUY_CALL' ? 'rgba(16, 185, 129, 0.2)' : technicalDetails.type === 'BUY_PUT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                  boxShadow: technicalDetails.type === 'BUY_CALL' ? '0 0 12px var(--success-glow)' : technicalDetails.type === 'BUY_PUT' ? '0 0 12px var(--danger-glow)' : 'none',
                  whiteSpace: 'nowrap'
                }}>
                  {technicalDetails.type === 'BUY_CALL' ? 'CALL' : technicalDetails.type === 'BUY_PUT' ? 'PUT' : 'HOLD'} ({technicalDetails.strength}%)
                </div>
              </div>

              {/* Subtitle / Description */}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.25rem' }}>
                {technicalDetails.prediction}
              </p>

              {/* Technical Indicator Stats Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
              }}>
                {/* RSI Indicator */}
                <div className="glass" style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 700 }}>RSI (14)</div>
                    {predictionSuite.lastUpdated > 0 && <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>{age(predictionSuite.lastUpdated)}</div>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.15rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{technicalDetails.rsi.value}</span>
                    <span style={{
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      color: technicalDetails.rsi.status === 'OVERSOLD' ? 'var(--success)' : technicalDetails.rsi.status === 'OVERBOUGHT' ? 'var(--danger)' : 'var(--text-secondary)'
                    }}>{technicalDetails.rsi.status}</span>
                  </div>
                </div>

                {/* MACD Crossover */}
                <div className="glass" style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 700 }}>MACD SPREAD</div>
                    {predictionSuite.lastUpdated > 0 && <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>{age(predictionSuite.lastUpdated)}</div>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.15rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'monospace' }}>
                      {(technicalDetails.macd.macdLine - technicalDetails.macd.signalLine).toFixed(3)}
                    </span>
                    <span style={{
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      color: technicalDetails.macd.status === 'BULLISH_CROSS' ? 'var(--success)' : 'var(--danger)'
                    }}>{technicalDetails.macd.status === 'BULLISH_CROSS' ? 'BULL CROSS' : 'BEAR CROSS'}</span>
                  </div>
                </div>

                {/* Bollinger Bands */}
                <div className="glass" style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 700 }}>BOLLINGER %B</div>
                    {predictionSuite.lastUpdated > 0 && <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>{age(predictionSuite.lastUpdated)}</div>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.15rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{technicalDetails.bollingerBands.percentB}%</span>
                    <span style={{
                      fontSize: '0.55rem',
                      fontWeight: 700,
                      color: technicalDetails.bollingerBands.percentB < 15 ? 'var(--success)' : technicalDetails.bollingerBands.percentB > 85 ? 'var(--danger)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '60px'
                    }}>{technicalDetails.bollingerBands.percentB < 15 ? 'BB SUPPORT' : technicalDetails.bollingerBands.percentB > 85 ? 'BB RESIST' : 'MID BAND'}</span>
                  </div>
                </div>

                {/* Stochastic %K */}
                <div className="glass" style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 700 }}>STOCHASTIC %K</div>
                    {predictionSuite.lastUpdated > 0 && <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>{age(predictionSuite.lastUpdated)}</div>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.15rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{technicalDetails.stochastic.value}%</span>
                    <span style={{
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      color: technicalDetails.stochastic.status === 'OVERSOLD' ? 'var(--success)' : technicalDetails.stochastic.status === 'OVERBOUGHT' ? 'var(--danger)' : 'var(--text-secondary)'
                    }}>{technicalDetails.stochastic.status}</span>
                  </div>
                </div>
              </div>

              {/* EMA Trend Cross */}
              <div style={{
                marginTop: '0.85rem',
                padding: '0.4rem 0.6rem',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.65rem'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>EMA Alignment (EMA 10/30)</span>
                <span style={{
                  fontWeight: 800,
                  color: technicalDetails.emaCross.status === 'GOLDEN_ALIGNMENT' ? 'var(--success)' : 'var(--danger)'
                }}>
                  {technicalDetails.emaCross.status === 'GOLDEN_ALIGNMENT' ? 'BULLISH' : 'BEARISH'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Box 3: AI Core Models (Algorithmic / Statistical Math Models) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card"
            style={{
              gridColumn: isMobile ? 'span 1' : 'span 2',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(10, 12, 18, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              justifyContent: 'space-between',
              minHeight: '260px'
            }}
          >
            <div>
              {/* Header */}
              <div style={{ marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase', opacity: 0.6 }}>
                  ALGORITHMIC MODELS
                </span>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0, color: 'var(--text-secondary)' }}>
                  Core Ensemble
                </h4>
              </div>

              {/* Stack of Core Models */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {signals.map((s) => {
                  const isCall = s.type === 'BUY_CALL';
                  const isPut = s.type === 'BUY_PUT';
                  return (
                    <div key={s.engine} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75px' }} title={s.engine}>
                          {s.engine.split(' (')[0]}
                        </span>
                        <span style={{
                          fontSize: '0.6rem',
                          fontWeight: 800,
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          background: isCall ? 'rgba(16, 185, 129, 0.08)' : isPut ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                          color: isCall ? 'var(--success)' : isPut ? 'var(--danger)' : 'var(--warning)',
                          border: `1px solid ${isCall ? 'rgba(16, 185, 129, 0.15)' : isPut ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`
                        }}>
                          {isCall ? 'CALL' : isPut ? 'PUT' : 'HOLD'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <div style={{ flex: 1, height: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${s.type === 'HOLD' ? 0 : s.strength}%`,
                            background: isCall ? 'var(--success)' : isPut ? 'var(--danger)' : 'var(--warning)',
                            opacity: 0.7
                          }} />
                        </div>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', opacity: 0.6, width: '22px', textAlign: 'right' }}>
                          {s.type === 'HOLD' ? '0' : s.strength}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', opacity: 0.4, lineHeight: 1.2, marginTop: '1rem' }}>
              Standard statistical pattern models. Weight: 20% aggregate weight each.
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Global Macro Indicators Widget (Real-time commodities & macro indices) */}
      <section style={{ marginBottom: isMobile ? '1.5rem' : '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem', marginBottom: isMobile ? '0.75rem' : '1.5rem', paddingLeft: '0.25rem' }}>
          <Activity size={isMobile ? 14 : 24} className="text-primary" />
          <h2 style={{ fontSize: isMobile ? '0.75rem' : '1.5rem', fontWeight: 700, letterSpacing: '0.02em' }}>
            GLOBAL MACRO INDICATORS (REAL-TIME)
          </h2>
        </div>

        {indicators.loading ? (
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Syncing global macro feeds...</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
            gap: '1rem'
          }}>
            {[
              { label: 'VIX Volatility', data: indicators.vix, color: indicators.vix && indicators.vix.price > 20 ? 'var(--danger)' : 'var(--success)' },
              { label: '10Y Treasury Yield', data: indicators.yield10y, format: (v: number) => `${v.toFixed(3)}%` },
              { label: 'US Dollar Index', data: indicators.dxy },
              { label: 'Gold Spot', data: indicators.gold, format: (v: number) => `$${v.toLocaleString()}` },
              { label: 'Bitcoin (BTC)', data: indicators.bitcoin, format: (v: number) => `$${v.toLocaleString()}` },
              { label: 'WTI Crude Oil', data: indicators.oil, format: (v: number) => `$${v.toFixed(2)}` }
            ].map((item, index) => {
              const val = item.data;
              if (!val) return null;
              
              const isPositive = val.change >= 0;
              const formattedPrice = item.format ? item.format(val.price) : val.price.toFixed(2);
              const formattedChange = `${isPositive ? '+' : ''}${val.changePercent.toFixed(2)}%`;

              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card"
                  style={{
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255,255,255,0.03)',
                    background: 'rgba(10, 12, 18, 0.3)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', opacity: 0.7 }}>
                      {item.label}
                    </span>
                    {indicators.lastUpdated > 0 && (
                      <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>
                        {age(indicators.lastUpdated)}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ marginTop: '0.4rem' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: item.color || '#fff' }}>
                      {formattedPrice}
                    </div>
                    
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: isPositive ? 'var(--success)' : 'var(--danger)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      marginTop: '0.1rem'
                    }}>
                      {isPositive ? <ArrowUpRight size={10} style={{ marginRight: '1px' }} /> : <ArrowDownRight size={10} style={{ marginRight: '1px' }} />}
                      {formattedChange}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3 & 4. Chart, News & Consensus Section */}
      <div className="dashboard-grid">
        
        {/* Market Catalyst Feed (Left Side) */}
        <div style={{ gridColumn: typeof window !== 'undefined' && window.innerWidth > 1024 ? 'span 3' : 'span 1', height: '100%' }}>
          <div className="glass-card" style={{ height: '100%', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <NewsSection />
          </div>
        </div>

        {/* Main Price Stats & Chart (Middle) */}
        <div style={{ gridColumn: typeof window !== 'undefined' && window.innerWidth > 1024 ? 'span 6' : 'span 1' }}>
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="glass-card" style={{ gridColumn: typeof window !== 'undefined' && window.innerWidth > 768 ? 'span 6' : 'span 1', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>S&P 500 INDEX (LIVE)</p>
                  <h2 style={{ fontSize: '1.75rem' }}>${currentPrice.toFixed(2)}</h2>
                </div>
                <Activity size={20} className="text-secondary" />
              </div>
            </div>
            <div className="glass-card" style={{ gridColumn: typeof window !== 'undefined' && window.innerWidth > 768 ? 'span 6' : 'span 1', padding: '1.25rem' }}>
              <div>
                <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>DATA REFRESH STATE</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.75rem' }}>Real-Time</h2>
                  <RefreshCw size={16} className="text-success spin-slow" />
                </div>
              </div>
            </div>
          </div>

          <PriceChart data={history} candleData={barHistory} />
        </div>

        {/* Market Sentiment & Meta-Info (Right Side) */}
        <div style={{ gridColumn: typeof window !== 'undefined' && window.innerWidth > 1024 ? 'span 3' : 'span 1' }}>
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
              Our multi-engine ensemble analyzes market patterns across 4 independent real-data vectors.
              The current consensus is <strong>{consensus}</strong>.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="glass" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-secondary" style={{ fontSize: '0.8rem' }}>TREND REGRESSION DRAG:</span>
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {regressionSignal.type === 'BUY_CALL' ? 'BULLISH' : regressionSignal.type === 'BUY_PUT' ? 'BEARISH' : 'NEUTRAL'} ({regressionSignal.type === 'HOLD' ? '0' : regressionSignal.strength}% Strength)
                </div>
              </div>
              <div className="glass" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-secondary" style={{ fontSize: '0.8rem' }}>RSI OSCILLATOR:</span>
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {technicalDetails.rsi.value} ({technicalDetails.rsi.status})
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <footer style={{ marginTop: '3rem', textAlign: 'center', padding: '2rem', borderTop: '1px solid var(--border-color)' }}>
        <p className="text-secondary" style={{ fontSize: '0.8rem' }}>
          Consensus compiled from 4 real live data structures. Powered directly by Yahoo Finance, Alternative.me F&G, and Reddit.
        </p>
      </footer>
    </div>
  );
};
