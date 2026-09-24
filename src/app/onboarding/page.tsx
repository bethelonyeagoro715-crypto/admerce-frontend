'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import {
  setActiveRole,
  setIntendedRole,
  setFutureInterests,
} from '../../services/localStorage';

// ─── Types ──────────────────────────────────────────────────────────
interface OnboardingRole {
  cardIndex: number;
  title: string;
  shortTitle: string;
  emoji: string;
  color: string;
  description: string;
  blurb: string;
  route: string;
  onboardingRoute?: string;
}

interface InterestChip {
  label: string;
  emoji: string;
}

// ─── Roles — launch set ─────────────────────────────────────────────
const PRIMARY_ROLES: OnboardingRole[] = [
  {
    cardIndex: 0,
    title: "I'm Buying",
    shortTitle: 'Buying',
    emoji: '🛍️',
    color: '#FE5106',
    description:
      'Find scarce items & services near you.\nReserve, pick up, or get it delivered.',
    blurb: 'Find what you need, nearby',
    route: '/shopper/home',
  },
  {
    cardIndex: 1,
    title: "I'm Selling",
    shortTitle: 'Selling',
    emoji: '🏪',
    color: '#0504AA',
    description:
      'Open your store in 3 minutes.\nList products, manage orders, and grow.',
    blurb: 'Open your store in minutes',
    route: '/storekeeper/home',
    onboardingRoute: '/storekeeper/onboarding/personal-info',
  },
  {
    cardIndex: 2,
    title: "I'm Providing a Service",
    shortTitle: 'Service',
    emoji: '🛠️',
    color: '#690096',
    description:
      'Offer your skills – barber, tailor, tutor.\nGet paid securely via escrow.',
    blurb: 'Offer your skills, get paid safely',
    route: '/service-provider/home',
    onboardingRoute: '/service-provider/onboarding',
  },
];

const CHIPS: InterestChip[] = [
  { label: 'Groceries', emoji: '🥑' },
  { label: 'Electronics', emoji: '📱' },
  { label: 'Fashion', emoji: '👗' },
  { label: 'Services', emoji: '🛠️' },
  { label: 'Furniture', emoji: '🪑' },
  { label: 'Books', emoji: '📚' },
  { label: 'Beauty', emoji: '💅' },
  { label: 'Food', emoji: '🍲' },
];

const MARQUEE_WORDS = ['BUY', 'SELL', 'PROVIDE', 'DISCOVER', 'NEARBY'];
const MARQUEE_WORDS_2 = ['VERIFIED', 'FAST', 'SECURE', 'LOCAL', 'REAL', 'NOW'];

// ─── Animation helpers ──────────────────────────────────────────────
function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ─── KineticText ────────────────────────────────────────────────────
function KineticText({
  text,
  progress,
  wordStagger = 0.12,
  style = {},
}: {
  text: string;
  progress: number;
  wordStagger?: number;
  style?: React.CSSProperties;
}) {
  const lines = text.split('\n');
  return (
    <div style={{ ...style, display: 'flex', flexWrap: 'wrap' }}>
      {lines.map((line, li) => {
        const lineOffset = li * 0.15;
        const adjusted = clamp((progress - lineOffset) / (1 - lineOffset));
        const words = line.split(' ');
        return (
          <div
            key={li}
            style={{
              width: '100%',
              marginBottom: li < lines.length - 1 ? '8px' : 0,
            }}
          >
            {words.map((word, i) => {
              const start = i * wordStagger;
              const end = start + 0.25;
              const t = clamp((adjusted - start) / (end - start));
              const ease = easeOutBack(t);
              return (
                <span
                  key={i}
                  style={{
                    opacity: clamp(t * 2),
                    transform: `translateY(${22 * (1 - ease)}px)`,
                    display: 'inline-block',
                    marginRight: '6px',
                    marginBottom: '2px',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── ScrollReveal ───────────────────────────────────────────────────
function ScrollReveal({
  children,
  progress,
  translateY = 48,
  delay = 0,
}: {
  children: React.ReactNode;
  progress: number;
  translateY?: number;
  delay?: number;
}) {
  const t = clamp((progress - delay) / Math.max(0.0001, 1 - delay));
  const ease = easeOutCubic(t);
  return (
    <div
      style={{
        opacity: ease,
        transform: `translateY(${translateY * (1 - ease)}px)`,
      }}
    >
      {children}
    </div>
  );
}

function PulsingDot() {
  return (
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: 'white',
        animation: 'pulse 1.2s infinite alternate',
      }}
    />
  );
}

// ─── FloatingOrbs ───────────────────────────────────────────────────
function FloatingOrbs() {
  const orbs = [
    { color: '#FE5106', size: 340, top: '-5%', left: '-15%', dur: 22, delay: 0 },
    { color: '#0504AA', size: 420, top: '25%', right: '-20%', dur: 26, delay: 3 },
    { color: '#690096', size: 380, bottom: '10%', left: '-10%', dur: 30, delay: 6 },
  ];
  return (
    <>
      {orbs.map((orb, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orb.color}35 0%, ${orb.color}10 40%, transparent 70%)`,
            filter: 'blur(40px)',
            top: orb.top,
            left: orb.left,
            right: orb.right,
            bottom: orb.bottom,
            pointerEvents: 'none',
            animation: `orbFloat${i} ${orb.dur}s ease-in-out ${orb.delay}s infinite`,
            zIndex: 0,
          }}
        />
      ))}
    </>
  );
}

// ─── Marquee ────────────────────────────────────────────────────────
function Marquee({
  words,
  reverse = false,
}: {
  words: string[];
  reverse?: boolean;
}) {
  const items = [...words, ...words, ...words, ...words];
  return (
    <div
      className="adm-marquee"
      style={{
        overflow: 'hidden',
        padding: '28px 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.015)',
      }}
    >
      <div
        className="adm-marquee-track"
        style={{
          display: 'flex',
          gap: 48,
          animation: `marquee ${reverse ? '40s' : '32s'} linear infinite ${reverse ? 'reverse' : ''}`,
          whiteSpace: 'nowrap',
          willChange: 'transform',
        }}
      >
        {items.map((w, i) => (
          <span
            key={i}
            style={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: '-1.5px',
              color: '#ffffff',
              opacity: i % 3 === 1 ? 0.9 : 0.28,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 48,
            }}
          >
            {w}
            <span
              style={{
                color: 'rgba(255,255,255,0.15)',
                fontSize: 44,
                fontWeight: 300,
              }}
            >
              ·
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Counter ────────────────────────────────────────────────────────
function Counter({
  target,
  suffix = '',
  label,
  durationMs = 1400,
}: {
  target: number;
  suffix?: string;
  label: string;
  durationMs?: number;
}) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = clamp((now - start) / durationMs);
          const eased = easeOutCubic(t);
          setValue(Math.round(target * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, durationMs]);

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 42,
          fontWeight: 900,
          letterSpacing: '-1.5px',
          color: 'white',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.toLocaleString()}
        {suffix}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.4)',
          marginTop: 8,
          fontWeight: 600,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── RoleCard ───────────────────────────────────────────────────────
function RoleCard({
  role,
  isSelected,
  onTap,
}: {
  role: OnboardingRole;
  isSelected: boolean;
  onTap: () => void;
}) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const cardRef = useRef<HTMLButtonElement>(null);

  const handleMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({
      rx: (0.5 - py) * 6,
      ry: (px - 0.5) * 6,
      mx: px * 100,
      my: py * 100,
    });
  };

  const handleLeave = () => setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onTap}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      aria-pressed={isSelected}
      style={{
        position: 'relative',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        borderRadius: 22,
        background: `linear-gradient(135deg, ${role.color}, ${role.color}dd)`,
        border: isSelected ? '2px solid #fff' : '2px solid transparent',
        padding: '20px 20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        color: '#fff',
        fontFamily: 'inherit',
        boxShadow: isSelected
          ? `0 18px 60px ${role.color}90`
          : `0 10px 40px ${role.color}55`,
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${isSelected ? 1.02 : 1})`,
        transition:
          'transform 0.18s ease-out, box-shadow 0.2s, border-color 0.2s',
        overflow: 'hidden',
        isolation: 'isolate',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,0.22), transparent 45%)`,
          pointerEvents: 'none',
          transition: 'background 0.15s',
          zIndex: 1,
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <span
          style={{
            width: 56,
            height: 56,
            flex: '0 0 56px',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.22)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
          }}
          aria-hidden="true"
        >
          {role.emoji}
        </span>
        <span
          style={{
            fontSize: 22,
            opacity: isSelected ? 1 : 0.55,
            transition: 'opacity 0.2s, transform 0.2s',
            transform: isSelected ? 'scale(1.1)' : 'scale(1)',
          }}
          aria-hidden="true"
        >
          {isSelected ? '✓' : '›'}
        </span>
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 19,
            letterSpacing: '-0.3px',
            marginBottom: 4,
          }}
        >
          {role.title}
        </div>
        <div style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.4 }}>
          {role.blurb}
        </div>
      </div>
    </button>
  );
}

// ─── FeatureTile ────────────────────────────────────────────────────
function FeatureTile({
  emoji,
  title,
  body,
  accent,
}: {
  emoji: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 20,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: `${accent}22`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}
        aria-hidden="true"
      >
        {emoji}
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 16,
          color: '#fff',
          letterSpacing: '-0.2px',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: 'rgba(255,255,255,0.55)',
          lineHeight: 1.5,
        }}
      >
        {body}
      </div>
    </div>
  );
}

// ─── ExpandedRolePanel (modal) ──────────────────────────────────────
function ExpandedRolePanel({
  role,
  onContinue,
  onClose,
}: {
  role: OnboardingRole;
  onContinue: () => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);

  const pages: { heading: string; body: string }[] = [
    { heading: role.title, body: role.description },
    {
      heading: 'What you get',
      body:
        role.shortTitle === 'Selling'
          ? '• Your own store page\n• Orders & inventory in one place\n• AI-assisted listings\n• Paid on delivery, escrow-protected'
          : '• A profile buyers can find\n• Bookings & time slots\n• Secure payments via escrow\n• Chat with customers in-app',
    },
    {
      heading: "You're all set",
      body: 'Get started in seconds.\nYour local community is waiting.',
    },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={role.title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: `linear-gradient(135deg, ${role.color}, ${role.color}cc)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          border: 'none',
          color: 'white',
          fontSize: 20,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>

      <div
        style={{
          textAlign: 'center',
          color: 'white',
          maxWidth: 420,
          width: '100%',
        }}
      >
        <div
          style={{
            fontSize: 64,
            marginBottom: 20,
            animation: 'floatIn 0.5s ease-out',
          }}
          aria-hidden="true"
        >
          {role.emoji}
        </div>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            marginBottom: 20,
            letterSpacing: '-0.5px',
          }}
        >
          {pages[page].heading}
        </h2>
        <div
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            opacity: 0.92,
            whiteSpace: 'pre-line',
            minHeight: 140,
          }}
        >
          {pages[page].body}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginTop: 32,
        }}
      >
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          aria-label="Previous"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: 24,
            opacity: page === 0 ? 0.3 : 0.7,
            cursor: page === 0 ? 'default' : 'pointer',
          }}
        >
          ‹
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {pages.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === page ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: 'rgba(255,255,255,0.9)',
                opacity: i === page ? 1 : 0.4,
                transition: 'width 0.2s, opacity 0.2s',
              }}
            />
          ))}
        </div>
        <button
          onClick={() => setPage(Math.min(pages.length - 1, page + 1))}
          disabled={page === pages.length - 1}
          aria-label="Next"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: 24,
            opacity: page === pages.length - 1 ? 0.3 : 0.7,
            cursor: page === pages.length - 1 ? 'default' : 'pointer',
          }}
        >
          ›
        </button>
      </div>

      <button
        onClick={onContinue}
        style={{
          backgroundColor: 'white',
          color: role.color,
          border: 'none',
          padding: '16px 48px',
          borderRadius: 14,                      // ✅ rounded-rectangle
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer',
          width: '100%',
          maxWidth: 320,
          marginTop: 24,
          fontFamily: 'inherit',
        }}
      >
        Continue
      </button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [scrollY, setScrollY] = useState(0);
  const [modalRole, setModalRole] = useState<OnboardingRole | null>(null);
  const [isProceeding, setIsProceeding] = useState(false);

  const [vpH, setVpH] = useState(800);
  useEffect(() => {
    const measure = () => setVpH(window.innerHeight);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.loop = true;
    video.play().catch(() => {});
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const parallax = scrollY * 0.45;
  const titleP = clamp(scrollY / (vpH * 0.3));
  const gridP = clamp((scrollY - vpH * 0.5) / (vpH * 0.4));
  const chipsP = clamp((scrollY - vpH * 1.2) / (vpH * 0.5));
  const featureP = clamp((scrollY - vpH * 1.9) / (vpH * 0.5));
  const finalP = clamp((scrollY - vpH * 2.8) / (vpH * 0.5));

  const docHeight =
    typeof document !== 'undefined'
      ? document.documentElement.scrollHeight - vpH
      : 1;
  const scrollProgress = docHeight > 0 ? clamp(scrollY / docHeight) : 0;

  const handleRoleSelect = useCallback((role: OnboardingRole) => {
    setSelectedRole((prev) =>
      prev?.cardIndex === role.cardIndex ? null : role,
    );
  }, []);

  const toggleInterest = (label: string) => {
    setSelectedInterests((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label],
    );
  };

  const handleContinue = async () => {
    if (!selectedRole || isProceeding) return;
    setIsProceeding(true);

    if (selectedInterests.length > 0) setFutureInterests(selectedInterests);

    let isLoggedIn = false;
    try {
      await api.getMyProfile();
      isLoggedIn = true;
    } catch {
      isLoggedIn = false;
    }

    if (isLoggedIn) {
      await proceedToRole(selectedRole);
      return;
    }

    if (selectedRole.shortTitle === 'Buying') {
      setActiveRole('shopper');
      router.replace('/shopper/home');
      return;
    }

    setModalRole(selectedRole);
    setIsProceeding(false);
  };

  const proceedToRole = async (role: OnboardingRole) => {
    const roleKey =
      role.shortTitle === 'Buying'
        ? 'shopper'
        : role.shortTitle === 'Selling'
        ? 'storekeeper'
        : 'service-provider';

    setActiveRole(roleKey);

    let target = role.route;
    if (role.shortTitle === 'Selling') {
      try {
        const store = await api.getMyStore();
        if (!store && role.onboardingRoute) target = role.onboardingRoute;
      } catch {
        if (role.onboardingRoute) target = role.onboardingRoute;
      }
    } else if (role.shortTitle === 'Service') {
      try {
        const services = await api.getProviderServices();
        if (
          (!Array.isArray(services) || services.length === 0) &&
          role.onboardingRoute
        ) {
          target = role.onboardingRoute;
        }
      } catch {
        if (role.onboardingRoute) target = role.onboardingRoute;
      }
    }

    router.replace(target);
  };

  const handleModalContinue = () => {
    if (!modalRole) return;
    const roleKey =
      modalRole.shortTitle === 'Selling' ? 'storekeeper' : 'service-provider';
    setIntendedRole(roleKey);
    setActiveRole(roleKey);
    setModalRole(null);
    router.replace(`/login?intended_role=${roleKey}`);
  };

  return (
    <>
      <style>{CSS}</style>

      {modalRole && (
        <ExpandedRolePanel
          role={modalRole}
          onContinue={handleModalContinue}
          onClose={() => setModalRole(null)}
        />
      )}

      {/* Scroll progress bar */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          zIndex: 100,
          background: 'rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${scrollProgress * 100}%`,
            background: 'linear-gradient(90deg, #FE5106, #690096, #0504AA)',
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      <div
        style={{
          backgroundColor: '#0A0A0A',
          color: 'white',
          position: 'relative',
          overflowX: 'hidden',
        }}
      >
        {/* ── HERO ──────────────────────────────────────────────── */}
        <section
          style={{
            height: vpH * 0.85,
            overflow: 'hidden',
            position: 'relative',
            background:
              'radial-gradient(ellipse at top, #1a1a2e 0%, #0A0A0A 70%)',
          }}
        >
          <FloatingOrbs />

          {!videoFailed && (
            <video
              ref={videoRef}
              src="/admerce_video.mp4"
              style={{
                position: 'absolute',
                top: -parallax,
                left: 0,
                width: '100%',
                height: vpH * 0.85 + parallax * 2,
                objectFit: 'cover',
                opacity: 0.55,
                zIndex: 1,
              }}
              playsInline
              muted
              loop
              onError={() => setVideoFailed(true)}
            />
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.1) 40%, #0A0A0A)',
              zIndex: 2,
            }}
          />

          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '0 24px 72px',
            }}
          >
            <ScrollReveal progress={titleP} translateY={16}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 2,
                  width: 'fit-content',
                }}
              >
                <PulsingDot />
                ADMERCE
              </div>
            </ScrollReveal>

            <div style={{ marginTop: 20, maxWidth: 640 }}>
              <KineticText
                text="The Future of Local Business"
                progress={clamp((titleP - 0.05) / 0.95)}
                wordStagger={0.09}
                style={{
                  fontSize: 'clamp(38px, 8vw, 64px)',
                  fontWeight: 900,
                  lineHeight: 1.02,
                  letterSpacing: '-2px',
                }}
              />
            </div>

            <div style={{ marginTop: 16, maxWidth: 480 }}>
              <KineticText
                text="Buy · Sell · Provide"
                progress={clamp((titleP - 0.3) / 0.7)}
                wordStagger={0.08}
                style={{
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 15,
                  fontWeight: 400,
                  lineHeight: 1.5,
                }}
              />
            </div>

            <div style={{ marginTop: 36 }}>
              <ScrollReveal progress={titleP} delay={0.6}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 20,
                      height: 34,
                      borderRadius: 12,
                      border: '1.5px solid rgba(255,255,255,0.35)',
                      position: 'relative',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: 8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 3,
                        height: 6,
                        borderRadius: 2,
                        background: 'white',
                        animation: 'scrollWheel 1.6s infinite',
                      }}
                    />
                  </span>
                  Scroll to explore
                </div>
              </ScrollReveal>
            </div>
          </div>

          <div className="adm-heroStats" aria-hidden="true">
            <div
              style={{
                ...heroStatCss,
                top: '22%',
                right: '8%',
                animationDelay: '0s',
              }}
            >
              <span style={{ fontSize: 22 }}>🛍️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Buying nearby</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>In 3 taps</div>
              </div>
            </div>
            <div
              style={{
                ...heroStatCss,
                top: '46%',
                right: '14%',
                animationDelay: '1.2s',
              }}
            >
              <span style={{ fontSize: 22 }}>🏪</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Your store</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>Live in minutes</div>
              </div>
            </div>
            <div
              style={{
                ...heroStatCss,
                top: '70%',
                right: '6%',
                animationDelay: '2.4s',
              }}
            >
              <span style={{ fontSize: 22 }}>🛠️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Your service</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>Get booked today</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── MARQUEE 1 ─────────────────────────────────────────── */}
        <Marquee words={MARQUEE_WORDS} />

        {/* ── STATS ─────────────────────────────────────────────── */}
        <section
          style={{
            padding: '64px 24px 48px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            maxWidth: 720,
            margin: '0 auto',
          }}
        >
          <Counter target={3} label="Ways to start" />
          <Counter target={10} label="Categories" />
          <Counter target={5} label="Cities live" />
        </section>

        {/* ── MARQUEE 2 (reverse) ───────────────────────────────── */}
        <Marquee words={MARQUEE_WORDS_2} reverse />

        {/* ── ROLES ─────────────────────────────────────────────── */}
        <section
          style={{ padding: '64px 24px 48px', maxWidth: 720, margin: '0 auto' }}
        >
          <KineticText
            text="How do you want to use Admerce?"
            progress={gridP}
            wordStagger={0.07}
            style={{
              fontSize: 'clamp(26px, 6vw, 36px)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.8px',
            }}
          />
          <div style={{ marginTop: 10 }}>
            <ScrollReveal progress={gridP} delay={0.3}>
              <p
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 14,
                  margin: 0,
                }}
              >
                Pick one — you can switch any time.
              </p>
            </ScrollReveal>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginTop: 32,
            }}
          >
            {PRIMARY_ROLES.map((role, i) => (
              <ScrollReveal
                key={role.cardIndex}
                progress={gridP}
                delay={0.4 + i * 0.1}
              >
                <RoleCard
                  role={role}
                  isSelected={selectedRole?.cardIndex === role.cardIndex}
                  onTap={() => handleRoleSelect(role)}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ── INTERESTS ─────────────────────────────────────────── */}
        {selectedRole && (
          <section
            style={{
              padding: '24px 24px 48px',
              maxWidth: 720,
              margin: '0 auto',
              animation: 'fadeIn 0.4s ease-out',
            }}
          >
            <div
              style={{
                height: 1,
                background: 'rgba(255,255,255,0.08)',
                marginBottom: 32,
              }}
            />
            <KineticText
              text="What else interests you?"
              progress={chipsP}
              wordStagger={0.08}
              style={{
                fontSize: 'clamp(20px, 4vw, 24px)',
                fontWeight: 700,
                letterSpacing: '-0.4px',
              }}
            />
            <p
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 13.5,
                marginTop: 8,
                marginBottom: 20,
              }}
            >
              Optional — helps us personalize your feed.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CHIPS.map((chip, i) => {
                const isSelected = selectedInterests.includes(chip.label);
                return (
                  <button
                    key={chip.label}
                    onClick={() => toggleInterest(chip.label)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 24,
                      background: isSelected
                        ? 'white'
                        : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.15)'}`,
                      color: isSelected ? '#0A0A0A' : 'rgba(255,255,255,0.78)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      animation: `chipIn 0.4s ${i * 0.04}s ease-out backwards`,
                    }}
                  >
                    <span style={{ fontSize: 16 }} aria-hidden="true">
                      {chip.emoji}
                    </span>
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── FEATURE BENTO ─────────────────────────────────────── */}
        <section
          style={{
            padding: '64px 24px 32px',
            maxWidth: 720,
            margin: '0 auto',
          }}
        >
          <ScrollReveal progress={featureP}>
            <h3
              style={{
                fontSize: 'clamp(22px, 5vw, 28px)',
                fontWeight: 800,
                letterSpacing: '-0.6px',
                margin: '0 0 8px',
              }}
            >
              Built for the neighborhood.
            </h3>
            <p
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 14,
                margin: '0 0 28px',
                lineHeight: 1.5,
                maxWidth: 520,
              }}
            >
              Every role gets the same protection: money in escrow, verified
              identities, and a feed that rewards local.
            </p>
          </ScrollReveal>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}
          >
            <ScrollReveal progress={featureP} delay={0.15}>
              <FeatureTile
                emoji="🔐"
                title="Escrow-protected"
                body="Funds held until the deal is done. Every order, every service."
                accent="#16A34A"
              />
            </ScrollReveal>
            <ScrollReveal progress={featureP} delay={0.25}>
              <FeatureTile
                emoji="🧠"
                title="AI-matched"
                body="SEAI learns what you need and puts it in front of you."
                accent="#0504AA"
              />
            </ScrollReveal>
            <ScrollReveal progress={featureP} delay={0.35}>
              <FeatureTile
                emoji="✅"
                title="Verified sellers"
                body="Badge-earning process checks legal name, address, and identity."
                accent="#0F766E"
              />
            </ScrollReveal>
            <ScrollReveal progress={featureP} delay={0.45}>
              <FeatureTile
                emoji="📡"
                title="Local-first"
                body="Everything you see is within reach. No shipping, no waiting."
                accent="#FE5106"
              />
            </ScrollReveal>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────── */}
        <section
          style={{
            padding: '80px 24px 120px',
            maxWidth: 720,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <ScrollReveal progress={finalP}>
            <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">
              🌍
            </div>
            <h3
              style={{
                fontSize: 'clamp(26px, 6vw, 40px)',
                fontWeight: 900,
                letterSpacing: '-1px',
                lineHeight: 1.1,
                margin: '0 0 12px',
              }}
            >
              Your neighborhood is already here.
            </h3>
            <p
              style={{
                fontSize: 15,
                color: 'rgba(255,255,255,0.55)',
                maxWidth: 460,
                margin: '0 auto 32px',
                lineHeight: 1.6,
              }}
            >
              Pick a role above and start in under a minute.
            </p>
            {!selectedRole && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 600,
                }}
              >
                ↑ Pick a role to continue
              </div>
            )}
          </ScrollReveal>
        </section>

        {/* Sticky continue */}
        {selectedRole && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              padding: '16px 24px calc(20px + env(safe-area-inset-bottom))',
              background: 'linear-gradient(to top, #0A0A0A 70%, transparent)',
              zIndex: 10,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={handleContinue}
              disabled={isProceeding}
              style={{
                width: '100%',
                maxWidth: 640,
                padding: '16px 24px',
                borderRadius: 14,              // ✅ rounded-rectangle, not pill
                border: 'none',
                background: selectedRole.color,
                color: 'white',
                fontSize: 16,
                fontWeight: 800,
                cursor: isProceeding ? 'not-allowed' : 'pointer',
                opacity: isProceeding ? 0.6 : 1,
                boxShadow: `0 10px 40px ${selectedRole.color}77`,
                fontFamily: 'inherit',
                transition: 'opacity 0.2s, box-shadow 0.2s, transform 0.15s',
                transform: isProceeding ? 'scale(0.98)' : 'scale(1)',
              }}
            >
              {isProceeding
                ? 'Just a moment…'
                : `Continue as ${selectedRole.shortTitle}`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Extra styles ────────────────────────────────────────────────────
const heroStatCss: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  color: 'white',
  animation: 'floatY 4s ease-in-out infinite',
  zIndex: 4,
};

const CSS = `
  @keyframes pulse { from { opacity: 0.3; } to { opacity: 1; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes floatIn {
    from { opacity: 0; transform: translateY(20px) scale(0.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes floatY {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  @keyframes scrollWheel {
    0% { transform: translate(-50%, 0); opacity: 1; }
    100% { transform: translate(-50%, 12px); opacity: 0; }
  }
  @keyframes chipIn {
    from { opacity: 0; transform: translateY(8px) scale(0.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  @keyframes orbFloat0 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(60px, -40px) scale(1.15); }
  }
  @keyframes orbFloat1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-50px, 60px) scale(1.1); }
  }
  @keyframes orbFloat2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(80px, 40px) scale(1.2); }
  }

  .adm-marquee:hover .adm-marquee-track {
    animation-play-state: paused;
  }

  .adm-heroStats {
    display: none;
  }
  @media (min-width: 900px) {
    .adm-heroStats { display: block; }
  }

  @media (prefers-reduced-motion: reduce) {
    .adm-marquee-track {
      animation: none !important;
    }
    [style*="animation"] {
      animation: none !important;
    }
  }
`;