import { useMarketNews } from '../hooks/useMarketNews';
import { Newspaper, Flame } from 'lucide-react';
import { motion } from 'framer-motion';

export const NewsSection = () => {
  const { news, loading, getTimeAgo } = useMarketNews();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (loading && news.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p className="text-secondary">Loading market intelligence...</p>
      </div>
    );
  }

  return (
    <section style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Newspaper size={24} className="text-primary" />
          <div>
            <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.5rem', fontWeight: 700, margin: 0 }}>MARKET CATALYST FEED</h2>
            <p style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', opacity: 0.6, margin: 0, fontWeight: 700, letterSpacing: '0.05em' }}>
              AI FILTERED • HIGH IMPACT ONLY
            </p>
          </div>
        </div>
      </div>

      <div className="custom-scrollbar" style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr', 
        gap: '0.75rem',
        maxHeight: '500px',
        overflowY: 'auto',
        paddingRight: '0.5rem',
        flex: 1
      }}>
        {news.map((item, idx) => {
          const isHot = (Date.now() / 1000 - item.providerPublishTime) < 3600; // Within 1 hour
          
          return (
            <motion.a
              key={item.uuid || idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="glass-card news-card" style={{ 
                padding: '0.75rem 1rem', 
                display: 'flex', 
                flexDirection: 'column',
                gap: '0.25rem',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: 0.7 }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                      {item.publisher}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.6rem' }}>•</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.6rem' }}>
                      {getTimeAgo(item.providerPublishTime)}
                    </span>
                  </div>
                  {isHot && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'rgba(239, 68, 68, 0.12)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      <Flame size={8} className="text-danger" />
                      <span style={{ fontSize: '0.55rem', fontWeight: 900, color: 'var(--danger)' }}>HOT</span>
                    </div>
                  )}
                </div>

                <h3 style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 500, 
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {item.title}
                </h3>
              </div>
            </motion.a>
          );
        })}
      </div>
      
      <style>{`
        .news-card:hover {
          background: rgba(255, 255, 255, 0.06) !important;
          transform: translateY(-2px);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
      `}</style>
    </section>
  );
};
