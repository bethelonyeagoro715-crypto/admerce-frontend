'use client';

import React, { useEffect, useState } from 'react';
import { MdArrowBack, MdArrowUpward, MdExpandMore, MdExpandLess } from 'react-icons/md';

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export function LegalScreen({
  title,
  subtitle,
  lastUpdated,
  sections,
  onBack,
  footerNote,
}: {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
  onBack: () => void;
  footerNote?: string;
}) {
  const [showToc, setShowToc] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      const pct = total > 0 ? (el.scrollTop / total) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
      setShowTop(el.scrollTop > 800);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setShowToc(false);
  };

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main style={S.root}>
      <style>{`
        .lg-row:active { background-color: #F8FAFF; }
        .lg-toc-btn:hover { background-color: #F8FAFF; }
        .lg-top:active { transform: scale(0.94); }
      `}</style>

      {/* Progress bar */}
      <div style={S.progressTrack} aria-hidden>
        <div style={{ ...S.progressBar, width: `${progress}%` }} />
      </div>

      {/* Header */}
      <header style={S.header}>
        <button onClick={onBack} style={S.iconBtn} aria-label="Back">
          <MdArrowBack size={22} color="#0B0B1A" />
        </button>
        <h1 style={S.headerTitle}>{title}</h1>
        <div style={{ minWidth: 38 }} />
      </header>

      <div style={S.body}>
        {/* Hero */}
        <div style={S.hero}>
          <h2 style={S.heroTitle}>{title}</h2>
          <p style={S.heroSub}>{subtitle}</p>
          <span style={S.heroDate}>Last updated · {lastUpdated}</span>
        </div>

        {/* TOC */}
        <div style={S.tocCard}>
          <button
            onClick={() => setShowToc((v) => !v)}
            style={S.tocHeader}
            className="lg-toc-btn"
          >
            <span style={S.tocHeaderText}>
              Contents · {sections.length} sections
            </span>
            {showToc ? (
              <MdExpandLess size={20} color="#64748B" />
            ) : (
              <MdExpandMore size={20} color="#64748B" />
            )}
          </button>
          {showToc && (
            <div style={S.tocList}>
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => jumpTo(s.id)}
                  className="lg-row"
                  style={S.tocItem}
                >
                  <span style={S.tocNum}>{i + 1}</span>
                  <span style={S.tocLabel}>{s.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sections */}
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} style={S.section}>
            <div style={S.sectionHead}>
              <span style={S.sectionNum}>{i + 1}</span>
              <h3 style={S.sectionTitle}>{s.title}</h3>
            </div>
            {s.paragraphs.map((p, j) => (
              <p key={j} style={S.paragraph}>
                {p}
              </p>
            ))}
            {s.bullets && s.bullets.length > 0 && (
              <ul style={S.bullets}>
                {s.bullets.map((b, k) => (
                  <li key={k} style={S.bulletItem}>
                    <span style={S.bulletDot} aria-hidden />
                    <span style={S.bulletText}>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {footerNote && <p style={S.footerNote}>{footerNote}</p>}
      </div>

      {showTop && (
        <button
          onClick={scrollTop}
          style={S.topBtn}
          className="lg-top"
          aria-label="Back to top"
        >
          <MdArrowUpward size={20} color="#fff" />
        </button>
      )}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    overflowX: 'hidden',
  },
  progressTrack: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'transparent',
    zIndex: 100,
    pointerEvents: 'none',
  },
  progressBar: {
    height: '100%',
    backgroundImage: 'linear-gradient(90deg, #0504AA 0%, #3D3BFF 100%)',
    transition: 'width 0.08s linear',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 14px',
    backgroundColor: 'rgba(244,245,251,0.94)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderBottom: '1px solid #EAECF3',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15.5,
    fontWeight: 700,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.2,
  },
  body: {
    padding: '20px 18px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    maxWidth: 720,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '20px 4px 8px',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.5,
    lineHeight: 1.15,
  },
  heroSub: {
    fontSize: 14.5,
    color: '#475569',
    margin: 0,
    lineHeight: 1.55,
  },
  heroDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 600,
    letterSpacing: 0.2,
  },
  tocCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
  },
  tocHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '14px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s',
  },
  tocHeaderText: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },
  tocList: {
    borderTop: '1px solid #F1F5F9',
    display: 'flex',
    flexDirection: 'column',
  },
  tocItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderBottom: '1px solid #F8FAFC',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  tocNum: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    fontSize: 11,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tocLabel: {
    fontSize: 13.5,
    fontWeight: 600,
    color: '#334155',
    letterSpacing: -0.05,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #EAECF3',
    padding: '20px 20px 18px',
    scrollMarginTop: 80,
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionNum: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
    lineHeight: 1.25,
  },
  paragraph: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 1.7,
    margin: '0 0 12px',
  },
  bullets: {
    listStyle: 'none',
    padding: 0,
    margin: '4px 0 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  bulletItem: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#0504AA',
    marginTop: 8,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 1.65,
    flex: 1,
  },
  footerNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 1.6,
    margin: '12px 0 0',
    padding: '0 8px',
  },
  topBtn: {
    position: 'fixed',
    bottom: 'calc(20px + env(safe-area-inset-bottom))',
    right: 20,
    width: 46,
    height: 46,
    borderRadius: 15,
    border: 'none',
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(5,4,170,0.34)',
    zIndex: 30,
    transition: 'transform 0.12s',
  },
};