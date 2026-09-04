'use client';

import { useState, useEffect, useRef } from 'react';
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
  emoji: string;
  color: string;
  description: string;
  route: string;
  onboardingRoute?: string;
  requiresAuth: boolean;
}

interface InterestChip {
  label: string;
  emoji: string;
}

// ─── Constants ──────────────────────────────────────────────────────
const ROLES: OnboardingRole[] = [
  {
    cardIndex: 0,
    title: "I'm Buying",
    emoji: '🛍️',
    color: '#FE5106',
    description:
      'Find scarce items & services near you.\nReserve, pick up, or get it delivered.',
    route: '/shopper/home',
    requiresAuth: true,
  },
  {
    cardIndex: 1,
    title: "I'm Selling",
    emoji: '🏪',
    color: '#0504AA',
    description:
      'Open your store in 3 minutes.\nList products, manage orders, and grow.',
    route: '/storekeeper/home',
    onboardingRoute: '/storekeeper/onboarding/personal-info',
    requiresAuth: true,
  },
  {
    cardIndex: 2,
    title: "I'm Providing a Service",
    emoji: '🛠️',
    color: '#690096',
    description:
      'Offer your skills – barber, tailor, tutor.\nGet paid securely via escrow.',
    route: '/service-provider/home',
    onboardingRoute: '/service-provider/onboarding',
    requiresAuth: true,
  },
];

const CHIPS: InterestChip[] = [
  { label: 'Groceries', emoji: '🥑' },
  { label: 'Electronics', emoji: '📱' },
  { label: 'Fashion', emoji: '👗' },
  { label: 'Services', emoji: '🛠️' },
  { label: 'Furniture', emoji: '🪑' },
  { label: 'Books', emoji: '📚' },
];

// ─── Helper functions ───────────────────────────────────────────────
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

// ─── Sub-components ────────────────────────────────────────────────

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
  const renderLine = (line: string, lineProgress: number) => {
    const words = line.split(' ');
    return words.map((word, i) => {
      const start = i * wordStagger;
      const end = start + 0.25;
      const t = clamp((lineProgress - start) / (end - start));
      const ease = easeOutBack(t);
      return (
        <span
          key={i}
          style={{
            opacity: clamp(t * 2),
            transform: `translateY(${22 * (1 - ease)}px)`,
            display: 'inline-block',
            marginRight: '5px',
            marginBottom: '2px',
          }}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <div style={{ ...style, display: 'flex', flexWrap: 'wrap' }}>
      {lines.map((line, li) => {
        const lineOffset = li * 0.15;
        const adjusted = clamp((progress - lineOffset) / (1 - lineOffset));
        return (
          <div key={li} style={{ width: '100%', marginBottom: li < lines.length - 1 ? '8px' : 0 }}>
            {renderLine(line, adjusted)}
          </div>
        );
      })}
    </div>
  );
}

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
  const t = clamp((progress - delay) / (1 - delay));
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

// ─── CinematicRoleCard ────────────────────────────────────────────
function CinematicRoleCard({
  role,
  scrollProgress,
  isSelected,
  onTap,
}: {
  role: OnboardingRole;
  scrollProgress: number;
  isSelected: boolean;
  onTap: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const t = easeOutBack(clamp(scrollProgress));
  const rotation = (1 - t) * 0.06 * (role.cardIndex % 2 === 0 ? 1 : -1);
  const offsetY = (1 - t) * 80;
  const scale = 0.7 + 0.3 * t;
  const pressScale = pressed ? 0.93 : 1;

  return (
    <div
      onClick={onTap}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        opacity: clamp(t * 1.5),
        transform: `translateY(${offsetY}px) scale(${scale * pressScale}) rotateZ(${rotation}rad)`,
        transition: 'transform 0.25s',
        cursor: 'pointer',
        height: '140px',
        borderRadius: '22px',
        background: `linear-gradient(135deg, ${role.color}, ${role.color}cc)`,
        border: isSelected ? '2.5px solid white' : 'none',
        boxShadow: `0 8px ${isSelected ? '26px' : '14px'} ${role.color}${isSelected ? '8c' : '47'}`,
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: 'white',
        marginBottom: '14px',
      }}
    >
      <div style={{ fontSize: '34px' }}>{role.emoji}</div>
      <div>
        <div style={{ fontWeight: 800, fontSize: '14.5px', letterSpacing: '-0.2px' }}>
          {role.title}
        </div>
        {role.requiresAuth && (
          <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '4px' }}>🔒</div>
        )}
      </div>
    </div>
  );
}

// ─── ExpandedRolePanel (modal) ────────────────────────────────────
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
  const pages = [
    role.description,
    `Why ${role.title}?\n\n• Fast & secure\n• Local trust\n• AI-powered`,
    'Get started in seconds.\nYour local community is waiting.',
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: `linear-gradient(135deg, ${role.color}, ${role.color}cc)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>

      {/* Page content */}
      <div style={{ textAlign: 'center', color: 'white', maxWidth: '400px' }}>
        <div style={{ fontSize: '72px', marginBottom: '24px' }}>{role.emoji}</div>
        <h2 style={{ fontSize: '34px', fontWeight: 900, marginBottom: '32px' }}>
          {role.title}
        </h2>
        <div style={{ fontSize: '18px', lineHeight: 1.6, opacity: 0.9, marginBottom: '32px', whiteSpace: 'pre-line' }}>
          {pages[page]}
        </div>
      </div>

      {/* Page nav + Continue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: 'auto', marginBottom: '24px' }}>
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '24px',
            opacity: page === 0 ? 0.3 : 0.7,
            cursor: page === 0 ? 'default' : 'pointer',
          }}
        >
          ‹
        </button>
        <span style={{ color: 'white', fontSize: '14px', opacity: 0.7 }}>
          {page + 1}/{pages.length}
        </span>
        <button
          onClick={() => setPage(Math.min(pages.length - 1, page + 1))}
          disabled={page === pages.length - 1}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '24px',
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
          borderRadius: '30px',
          fontSize: '17px',
          fontWeight: 'bold',
          cursor: 'pointer',
          width: '100%',
          maxWidth: '300px',
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
  const videoRef = useRef<HTMLVideoElement>(null);

  // Modal state
  const [modalRole, setModalRole] = useState<OnboardingRole | null>(null);

  // Video auto‑play
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.loop = true;
      video.play().catch(() => {});
    }
  }, []);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const vpH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const parallax = scrollY * 0.45;

  const titleP = clamp(scrollY / (vpH * 0.3));
  const gridP = clamp((scrollY - vpH * 0.5) / (vpH * 0.4));
  const chipsP = clamp((scrollY - vpH * 1.2) / (vpH * 0.5));

  const cardP = ROLES.map((_, i) => {
    const base = (scrollY - vpH * (0.5 + i * 0.15)) / (vpH * 0.4);
    return clamp((base - i * 0.04) / (1 - i * 0.04));
  });

  // --- Role tap logic (modal for ALL unauthenticated users) ---
  const handleRoleTap = async (role: OnboardingRole) => {
    setSelectedRole(role);

    // Check if user is logged in
    let isLoggedIn = false;
    try {
      await api.getMyProfile();
      isLoggedIn = true;
    } catch {
      isLoggedIn = false;
    }

    // If logged in, proceed directly (no modal)
    if (isLoggedIn) {
      await proceedToRole(role);
      return;
    }

    // Not logged in → show ExpandedRolePanel for ALL roles
    setModalRole(role);
  };

  const proceedToRole = async (role: OnboardingRole) => {
    const roleKey =
      role.title === "I'm Buying"
        ? 'shopper'
        : role.title === "I'm Selling"
        ? 'storekeeper'
        : 'service-provider';

    setActiveRole(roleKey);
    if (selectedInterests.length > 0) {
      setFutureInterests(selectedInterests);
    }

    let target = role.route;
    if (role.title === "I'm Selling") {
      try {
        const store = await api.getMyStore();
        if (!store && role.onboardingRoute) target = role.onboardingRoute;
      } catch {
        if (role.onboardingRoute) target = role.onboardingRoute;
      }
    } else if (role.title === "I'm Providing a Service") {
      try {
        const services = await api.getProviderServices();
        if ((!Array.isArray(services) || services.length === 0) && role.onboardingRoute) {
          target = role.onboardingRoute;
        }
      } catch {
        if (role.onboardingRoute) target = role.onboardingRoute;
      }
    }

    router.replace(target);
  };

  // Modal: on Continue
  const handleModalContinue = async () => {
    if (!modalRole) return;

    // For "I'm Buying" – go directly to shopper home (no login required)
    if (modalRole.title === "I'm Buying") {
      setActiveRole('shopper');
      if (selectedInterests.length > 0) {
        setFutureInterests(selectedInterests);
      }
      setModalRole(null);
      router.replace('/shopper/home');
      return;
    }

    // For Selling / Service Provider – store intended role and redirect to login
    const roleKey =
      modalRole.title === "I'm Selling" ? 'storekeeper' : 'service-provider';
    setIntendedRole(roleKey);
    setActiveRole(roleKey);
    setModalRole(null);
    router.replace(`/login?intended_role=${roleKey}`);
  };

  const toggleInterest = (label: string) => {
    setSelectedInterests((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (
    <>
      <style>{`@keyframes pulse { from { opacity: 0.3; } to { opacity: 1; } }`}</style>

      {/* Modal overlay */}
      {modalRole && (
        <ExpandedRolePanel
          role={modalRole}
          onContinue={handleModalContinue}
          onClose={() => setModalRole(null)}
        />
      )}

      <div style={{ backgroundColor: '#0A0A0A', minHeight: '200vh', color: 'white' }}>
        {/* Video hero */}
        <div style={{ height: `${vpH * 0.72}px`, overflow: 'hidden', position: 'relative' }}>
          <video
            ref={videoRef}
            src="/admerce_video.mp4"
            style={{
              position: 'absolute',
              top: -parallax,
              left: 0,
              width: '100%',
              height: `${vpH * 0.72 + parallax * 2}px`,
              objectFit: 'cover',
            }}
            playsInline
            muted
            loop
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), transparent, #0A0A0A)',
            }}
          />
          <div style={{ position: 'absolute', bottom: '48px', left: '24px', right: '24px' }}>
            <ScrollReveal progress={titleP} translateY={16}>
              <div
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '2.5px',
                }}
              >
                ADMERCE
              </div>
            </ScrollReveal>
            <div style={{ marginTop: '14px' }}>
              <KineticText
                text="The Future of Local Business"
                progress={clamp((titleP - 0.05) / 0.95)}
                wordStagger={0.09}
                style={{ fontSize: '38px', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1px' }}
              />
            </div>
            <div style={{ marginTop: '12px' }}>
              <KineticText
                text="Buy · Sell · Provide"
                progress={clamp((titleP - 0.3) / 0.7)}
                wordStagger={0.14}
                style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: 400 }}
              />
            </div>
            <div style={{ marginTop: '28px' }}>
              <ScrollReveal progress={titleP} delay={0.6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PulsingDot />
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>
                    Scroll to get started
                  </span>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>

        {/* Role cards */}
        <div style={{ padding: '40px 22px' }}>
          <KineticText
            text="How do you want to use Admerce?"
            progress={gridP}
            wordStagger={0.07}
            style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.6px' }}
          />
          <div style={{ marginTop: '8px' }}>
            <ScrollReveal progress={gridP} delay={0.3}>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', margin: 0 }}>
                Choose your role — you can switch anytime.
              </p>
            </ScrollReveal>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '14px',
              marginTop: '32px',
            }}
          >
            {ROLES.map((role, i) => (
              <CinematicRoleCard
                key={i}
                role={role}
                scrollProgress={cardP[i]}
                isSelected={selectedRole === role}
                onTap={() => handleRoleTap(role)}
              />
            ))}
          </div>
        </div>

        {/* Interest chips */}
        <div
          style={{
            padding: '0 22px 80px',
            opacity: selectedRole ? 1 : 0,
            pointerEvents: selectedRole ? 'auto' : 'none',
            transition: 'opacity 0.4s',
          }}
        >
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.12)', marginBottom: '32px' }} />
          <KineticText
            text="What else interests you?"
            progress={chipsP}
            wordStagger={0.1}
            style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.4px' }}
          />
          <div style={{ marginTop: '6px' }}>
            <ScrollReveal progress={chipsP} delay={0.2}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13.5px' }}>
              
              </p>
            </ScrollReveal>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px' }}>
            {CHIPS.map((chip, i) => {
              const isSelected = selectedInterests.includes(chip.label);
              const chipP = clamp((chipsP - i * 0.06) / 0.6);
              return (
                <ScrollReveal key={i} progress={chipP} translateY={30}>
                  <button
                    onClick={() => toggleInterest(chip.label)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '24px',
                      background: isSelected ? 'white' : 'rgba(255,255,255,0.07)',
                      border: `0.8px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.15)'}`,
                      color: isSelected ? '#0A0A0A' : 'rgba(255,255,255,0.75)',
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      cursor: 'pointer',
                      transition: 'all 0.22s',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{chip.emoji}</span>
                    {chip.label}
                  </button>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}