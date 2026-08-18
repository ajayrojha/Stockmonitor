import { useState, useRef, useEffect } from 'react';
import type { MarketData } from '../hooks/useMarketData';
import {
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, BarChart2, Activity, Layers, Sliders } from 'lucide-react';

interface PriceChartProps {
  data: MarketData[];
  // Real per-minute OHLC bars, used for the candlestick view specifically —
  // `data` is a flat per-second tick series (O=H=L=C) and would render as
  // dashes rather than candles. Falls back to `data` if not provided.
  candleData?: MarketData[];
}

export type ChartType = 'area' | 'candlestick' | 'line' | 'bar' | 'baseline';

// ─── Pure-SVG Candlestick (crash-proof, no Recharts hacks) ───────────────────
const CandlestickSVG = ({ data }: { data: MarketData[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width || 800);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  const H = 300;
  const ML = 8, MR = 68, MT = 10, MB = 28;
  const plotW = Math.max(10, containerWidth - ML - MR);
  const plotH = H - MT - MB;

  const highs = data.map(d => d.high);
  const lows  = data.map(d => d.low);
  const rawMin = Math.min(...lows);
  const rawMax = Math.max(...highs);
  const pad = (rawMax - rawMin) * 0.08 || 5;
  const minY = rawMin - pad;
  const maxY = rawMax + pad;
  const yRange = maxY - minY || 1;

  const scaleX = (i: number) => ML + (i + 0.5) * (plotW / data.length);
  const scaleY = (p: number) => MT + plotH - ((p - minY) / yRange) * plotH;

  const candleW = Math.max(2, Math.min(12, (plotW / data.length) * 0.65));

  // Y axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => minY + (yRange / (tickCount - 1)) * i);

  // X axis ticks (show ~6 labels)
  const xStep = Math.max(1, Math.floor(data.length / 6));
  const xTicks = data
    .map((d, i) => ({ i, ts: d.timestamp }))
    .filter(({ i }) => i % xStep === 0);

  // Tooltip state
  const [hovered, setHovered] = useState<{ x: number; y: number; d: MarketData } | null>(null);

  return (
    <div ref={containerRef} style={{ width: '100%', height: `${H + 10}px`, position: 'relative', userSelect: 'none' }}>
      <svg
        width="100%"
        height={H}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Horizontal grid lines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={ML} y1={scaleY(v)}
            x2={ML + plotW} y2={scaleY(v)}
            stroke="rgba(255,255,255,0.04)"
            strokeDasharray="3 3"
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={i}
            x={ML + plotW + 4}
            y={scaleY(v) + 4}
            fill="rgba(255,255,255,0.35)"
            fontSize={9}
          >
            {v.toFixed(2)}
          </text>
        ))}

        {/* X axis labels */}
        {xTicks.map(({ i, ts }) => (
          <text
            key={i}
            x={scaleX(i)}
            y={H - 4}
            fill="rgba(255,255,255,0.35)"
            fontSize={9}
            textAnchor="middle"
          >
            {ts}
          </text>
        ))}

        {/* Candles */}
        {data.map((d, i) => {
          const isUp = d.close >= d.open;
          const color = isUp ? '#10b981' : '#ef4444';
          const cx   = scaleX(i);
          const yH   = scaleY(d.high);
          const yL   = scaleY(d.low);
          const yO   = scaleY(d.open);
          const yC   = scaleY(d.close);
          const bodyTop = Math.min(yO, yC);
          const bodyH   = Math.max(2, Math.abs(yO - yC));

          return (
            <g
              key={i}
              onMouseEnter={() => setHovered({ x: cx, y: bodyTop, d })}
            >
              {/* Wick */}
              <line x1={cx} y1={yH} x2={cx} y2={yL} stroke={color} strokeWidth={1.5} />
              {/* Body */}
              <rect
                x={cx - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={bodyH}
                fill={color}
                stroke={color}
                rx={1}
                style={{ cursor: 'crosshair' }}
              />
            </g>
          );
        })}

        {/* Hover crosshair line */}
        {hovered && (
          <line
            x1={hovered.x} y1={MT}
            x2={hovered.x} y2={MT + plotH}
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {/* Floating Tooltip */}
      {hovered && (() => {
        const d = hovered.d;
        const isUp = d.close >= d.open;
        // flip tooltip to left side if too close to right edge
        const tipLeft = hovered.x + 12 > containerWidth - 160 ? hovered.x - 170 : hovered.x + 12;
        return (
          <div style={{
            position: 'absolute',
            top: Math.max(0, hovered.y - 20),
            left: tipLeft,
            pointerEvents: 'none',
            background: 'rgba(10, 12, 18, 0.96)',
            border: `1px solid ${isUp ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            borderRadius: '10px',
            padding: '0.6rem 0.85rem',
            fontSize: '0.7rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            zIndex: 50,
            minWidth: '150px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', gap: '0.75rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{d.timestamp}</span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 800,
                padding: '0.1rem 0.35rem', borderRadius: '4px',
                background: isUp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: isUp ? '#10b981' : '#ef4444'
              }}>
                {isUp ? '+' : ''}{d.changePercent.toFixed(2)}%
              </span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '0.35rem' }}>${d.price.toFixed(2)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.2rem 0.6rem', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.35rem' }}>
              <div>O: <strong style={{ color: '#fff' }}>${d.open.toFixed(2)}</strong></div>
              <div>H: <strong style={{ color: '#10b981' }}>${d.high.toFixed(2)}</strong></div>
              <div>L: <strong style={{ color: '#ef4444' }}>${d.low.toFixed(2)}</strong></div>
              <div>C: <strong style={{ color: '#fff' }}>${d.close.toFixed(2)}</strong></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Custom rich tooltip for Recharts charts ─────────────────────────────────
const RechartsTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d: MarketData = payload[0].payload;
  if (!d) return null;
  const isUp = d.change >= 0;
  return (
    <div style={{
      background: 'rgba(10, 12, 18, 0.95)',
      border: `1px solid ${isUp ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
      borderRadius: '10px',
      padding: '0.7rem 1rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(10px)',
      fontSize: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', gap: '1rem' }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{d.timestamp}</span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 800,
          padding: '0.1rem 0.4rem', borderRadius: '4px',
          background: isUp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          color: isUp ? '#10b981' : '#ef4444',
        }}>
          {isUp ? '+' : ''}{d.changePercent.toFixed(2)}%
        </span>
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>${d.price.toFixed(2)}</div>
    </div>
  );
};

// ─── Main PriceChart component ───────────────────────────────────────────────
export const PriceChart = ({ data, candleData }: PriceChartProps) => {
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const candles = candleData && candleData.length > 0 ? candleData : data;

  if (!data || data.length === 0) {
    return (
      <div className="glass-card" style={{ height: '440px', padding: '1.5rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)' }}>Initializing S&P 500 chart feed...</span>
      </div>
    );
  }

  const firstItem = data[0];
  const lastItem  = data[data.length - 1];
  // Bullish/bearish here reflects the trend of the visible 10-minute window
  // (first bar vs. last bar currently plotted) — NOT `lastItem.change`, which
  // is price vs. *yesterday's* close. That comparison barely moves within a
  // session, so on a down day this badge would sit on BEARISH for hours
  // regardless of what the chart is actually showing. Tying it to the
  // window's own start/end keeps it honest about what's on screen.
  const isPositive  = lastItem.price >= firstItem.price;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';

  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const yPad = (maxPrice - minPrice) * 0.15 || 5;

  const chartTypesList: { id: ChartType; label: string; icon: any }[] = [
    { id: 'area',        label: 'Area',     icon: TrendingUp },
    { id: 'candlestick', label: 'Candles',  icon: BarChart2  },
    { id: 'line',        label: 'Line',     icon: Activity   },
    { id: 'bar',         label: 'Bars',     icon: Layers     },
    { id: 'baseline',    label: 'Baseline', icon: Sliders    },
  ];

  const commonProps = {
    commonXAxis: (
      <XAxis dataKey="timestamp" stroke="rgba(255,255,255,0.3)" fontSize={10}
        tickLine={false} axisLine={false} minTickGap={25} />
    ),
    commonYAxis: (
      <YAxis domain={[minPrice - yPad, maxPrice + yPad]} stroke="rgba(255,255,255,0.3)"
        fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(2)} />
    ),
    commonGrid: <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />,
  };

  return (
    <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginTop: '1.5rem' }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>Live S&P 500 Index Chart</h3>
            <span style={{
              fontSize: '0.6rem', fontWeight: 800,
              padding: '0.15rem 0.5rem', borderRadius: '6px',
              background: isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: strokeColor,
              border: `1px solid ${isPositive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              {isPositive ? '▲ BULLISH' : '▼ BEARISH'}
            </span>
          </div>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>
            Session range: ${minPrice.toFixed(2)} – ${maxPrice.toFixed(2)} &nbsp;·&nbsp; {chartType === 'candlestick' ? candles.length : data.length} bars
          </p>
        </div>

        {/* ── Chart type toolbar ──────────────────────────────────── */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.2rem', gap: '0.15rem' }}>
          {chartTypesList.map(({ id, label, icon: Icon }) => {
            const active = chartType === id;
            return (
              <button key={id} onClick={() => setChartType(id)} style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.28rem 0.6rem', borderRadius: '7px', border: 'none',
                fontSize: '0.68rem', fontWeight: active ? 800 : 500, cursor: 'pointer',
                background: active ? strokeColor : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.18s ease',
                boxShadow: active ? `0 0 12px ${isPositive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` : 'none',
              }}>
                <Icon size={12} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chart canvas ────────────────────────────────────────────── */}
      <div style={{ width: '100%' }}>
        {chartType === 'candlestick' ? (
          // Pure SVG candlestick — no Recharts involved, cannot crash.
          // Uses the real per-minute OHLC bars, not the flat per-second ticks.
          <CandlestickSVG data={candles} />
        ) : (
          <div style={{ height: '330px' }}>
            <ResponsiveContainer width="100%" height="100%">
              {(() => {
                switch (chartType) {
                  case 'area':
                    return (
                      <AreaChart data={data}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={strokeColor} stopOpacity={0}    />
                          </linearGradient>
                        </defs>
                        {commonProps.commonGrid}
                        {commonProps.commonXAxis}
                        {commonProps.commonYAxis}
                        <Tooltip content={<RechartsTooltip />} />
                        <Area type="monotone" dataKey="price" stroke={strokeColor} strokeWidth={2.5}
                          fillOpacity={1} fill="url(#areaGrad)" isAnimationActive={false} />
                      </AreaChart>
                    );

                  case 'line':
                    return (
                      <LineChart data={data}>
                        {commonProps.commonGrid}
                        {commonProps.commonXAxis}
                        {commonProps.commonYAxis}
                        <Tooltip content={<RechartsTooltip />} />
                        <Line type="monotone" dataKey="price" stroke={strokeColor} strokeWidth={2.5}
                          dot={false} activeDot={{ r: 5, fill: strokeColor, stroke: '#fff', strokeWidth: 2 }}
                          isAnimationActive={false} />
                      </LineChart>
                    );

                  case 'bar':
                    return (
                      <BarChart data={data}>
                        {commonProps.commonGrid}
                        {commonProps.commonXAxis}
                        {commonProps.commonYAxis}
                        <Tooltip content={<RechartsTooltip />} />
                        <Bar dataKey="price" fill={strokeColor} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    );

                  case 'baseline':
                    return (
                      <AreaChart data={data}>
                        <defs>
                          <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
                          </linearGradient>
                        </defs>
                        {commonProps.commonGrid}
                        {commonProps.commonXAxis}
                        {commonProps.commonYAxis}
                        <ReferenceLine y={firstItem.price} stroke="rgba(255,255,255,0.25)"
                          strokeDasharray="4 4" label={{ value: 'Open', fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                        <Tooltip content={<RechartsTooltip />} />
                        <Area type="monotone" dataKey="price" stroke={strokeColor} strokeWidth={2}
                          fill="url(#baseGrad)" isAnimationActive={false} />
                      </AreaChart>
                    );

                  default:
                    return <AreaChart data={data}><Area dataKey="price" /></AreaChart>;
                }
              })()}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
