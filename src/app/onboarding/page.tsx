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
  blurb: string;          // ✅ NEW — one-line tagline shown on the card
  route: string;
  onboardingRoute?: string;
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
];

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
                    marginRight: '5px',
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

// ─── RoleCard — one column, horizontal, preserves the cinematic tint ─
function RoleCard({
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
  const offsetY = (1 - t) * 60;
  const pressScale = pressed ? 0.98 : 1;

  return (
    <button
      type="button"
      onClick={onTap}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      aria-pressed={isSelected}
      style={{
        opacity: clamp(t * 1.5),
        transform: `translateY(${offsetY}px) scale(${pressScale})`,
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        borderRadius: 18,
        background: `linear-gradient(135deg, ${role.color}, ${role.color}cc)`,
        border: isSelected ? '2px solid #fff' : '2px solid transparent',
        boxShadow: `0 8px ${isSelected ? 26 : 14}px ${role.color}${isSelected ? '8c' : '47'}`,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        color: '#fff',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          width: 52,
          height: 52,
          flex: '0 0 52px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.22)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
        aria-hidden="true"
      >
        {role.emoji}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '-0.2px',
            marginBottom: 2,
          }}
        >
          {role.title}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 13,
            opacity: 0.85,
            lineHeight: 1.35,
          }}
        >
          {role.blurb}
        </span>
      </span>

      <span
        style={{
          flex: '0 0 auto',
          fontSize: 22,
          opacity: isSelected ? 1 : 0.6,
          transition: 'opacity 0.2s',
        }}
        aria-hidden="true"
      >
        {isSelected ? '✓' : '›'}
      </span>
    </button>
  );
}

// ─── ExpandedRolePanel — modal ──────────────────────────────────────
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

  // ✅ Per-role copy, not the same three lines for every role
  const pages: { heading: string; body: string }[] = [
    {
      heading: role.title,
      body: role.description,
    },
    {
      heading: 'What you get',
      body:
        role.shortTitle === 'Buying'
          ? '• Everything nearby in one feed\n• Verified sellers, escrow-protected\n• Delivery or pickup, your choice'
          : role.shortTitle === 'Selling'
          ? '• Your own store page\n• Orders & inventory in one place\n• AI-assisted listings\n• Paid on delivery, escrow-protected'
          : '• A profile buyers can find\n• Bookings & time slots\n• Secure payments via escrow\n• Chat with customers in-app',
    },
    {
      heading: "You're all set",
      body: 'Get started in seconds.\nYour local community is waiting.',
    },
  ];

  // ✅ Escape key closes the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ✅ Lock body scroll while modal is open
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

      <div style={{ textAlign: 'center', color: 'white', maxWidth: 420, width: '100%' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }} aria-hidden="true">
          {role.emoji}
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 20, letterSpacing: '-0.5px' }}>
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

      {/* Page nav */}
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
          borderRadius: 30,
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

  // ✅ vpH is state — no hydration mismatch, updates on resize
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
    video.play().catch(() => {
      /* autoplay blocked — fine, poster/frame stays */
    });
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

  const cardP = ROLES.map((_, i) => {
    const base = (scrollY - vpH * (0.5 + i * 0.15)) / (vpH * 0.4);
    return clamp((base - i * 0.04) / (1 - i * 0.04));
  });

  // ✅ Card tap just SELECTS. It does not open the modal or navigate.
  const handleRoleSelect = useCallback((role: OnboardingRole) => {
    setSelectedRole((prev) => (prev?.cardIndex === role.cardIndex ? null : role));
  }, []);

  const toggleInterest = (label: string) => {
    setSelectedInterests((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  // ✅ Continue button handler — checks auth, opens modal or proceeds
  const handleContinue = async () => {
    if (!selectedRole || isProceeding) return;
    setIsProceeding(true);

    // Persist interests regardless of which branch we take
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

    // Not logged in
    if (selectedRole.shortTitle === 'Buying') {
      // Shoppers go straight in
      setActiveRole('shopper');
      router.replace('/shopper/home');
      return;
    }
    // Selling / Service — show the marketing modal
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
        if ((!Array.isArray(services) || services.length === 0) && role.onboardingRoute) {
          target = role.onboardingRoute;
        }
      } catch {
        if (role.onboardingRoute) target = role.onboardingRoute;
      }
    }

    router.replace(target);
  };

  // ✅ Continue in the modal — for Selling / Service
  const handleModalContinue = () => {
    if (!modalRole) return;
    const roleKey = modalRole.shortTitle === 'Selling' ? 'storekeeper' : 'service-provider';
    setIntendedRole(roleKey);
    setActiveRole(roleKey);
    setModalRole(null);
    router.replace(`/login?intended_role=${roleKey}`);
  };

  return (
    <>
      <style>{`@keyframes pulse { from { opacity: 0.3; } to { opacity: 1; } }`}</style>

      {modalRole && (
        <ExpandedRolePanel
          role={modalRole}
          onContinue={handleModalContinue}
          onClose={() => setModalRole(null)}
        />
      )}

      <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', color: 'white' }}>
        {/* Video hero */}
        <div
          style={{
            height: vpH * 0.72,
            overflow: 'hidden',
            position: 'relative',
            background: 'linear-gradient(135deg, #0A0A0A, #1a1a2e)',
          }}
        >
          {!videoFailed && (
            <video
              ref={videoRef}
              src="/admerce_video.mp4"
              style={{
                position: 'absolute',
                top: -parallax,
                left: 0,
                width: '100%',
                height: vpH * 0.72 + parallax * 2,
                objectFit: 'cover',
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
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), transparent, #0A0A0A)',
            }}
          />
          <div style={{ position: 'absolute', bottom: 48, left: 24, right: 24 }}>
            <ScrollReveal progress={titleP} translateY={16}>
              <div
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 2.5,
                }}
              >
                ADMERCE
              </div>
            </ScrollReveal>
            <div style={{ marginTop: 14 }}>
              <KineticText
                text="The Future of Local Business"
                progress={clamp((titleP - 0.05) / 0.95)}
                wordStagger={0.09}
                style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1px' }}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <KineticText
                text="Buy · Sell · Provide"
                progress={clamp((titleP - 0.3) / 0.7)}
                wordStagger={0.14}
                style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 400 }}
              />
            </div>
            <div style={{ marginTop: 28 }}>
              <ScrollReveal progress={titleP} delay={0.6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PulsingDot />
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
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
            style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.6px' }}
          />
          <div style={{ marginTop: 8 }}>
            <ScrollReveal progress={gridP} delay={0.3}>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>
                Choose your role — you can switch anytime.
              </p>
            </ScrollReveal>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              marginTop: 32,
            }}
          >
            {ROLES.map((role, i) => (
              <RoleCard
                key={i}
                role={role}
                scrollProgress={cardP[i]}
                isSelected={selectedRole?.cardIndex === role.cardIndex}
                onTap={() => handleRoleSelect(role)}
              />
            ))}
          </div>
        </div>

        {/* Interest chips — only render when a role is picked */}
        {selectedRole && (
          <div style={{ padding: '0 22px 40px' }}>
            <div
              style={{
                height: 1,
                background: 'rgba(255,255,255,0.12)',
                marginBottom: 32,
              }}
            />
            <KineticText
              text="What else interests you?"
              progress={1}
              wordStagger={0.1}
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px' }}
            />
            <p
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 13.5,
                marginTop: 6,
                marginBottom: 20,
              }}
            >
              Optional — helps us personalize your feed.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CHIPS.map((chip) => {
                const isSelected = selectedInterests.includes(chip.label);
                return (
                  <button
                    key={chip.label}
                    onClick={() => toggleInterest(chip.label)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 24,
                      background: isSelected ? 'white' : 'rgba(255,255,255,0.07)',
                      border: `0.8px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.15)'}`,
                      color: isSelected ? '#0A0A0A' : 'rgba(255,255,255,0.75)',
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      cursor: 'pointer',
                      transition: 'all 0.22s',
                      fontFamily: 'inherit',
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
          </div>
        )}

        {/* ✅ Continue CTA — appears when a role is selected */}
        {selectedRole && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              padding: '16px 22px 28px',
              background: 'linear-gradient(to top, #0A0A0A 60%, transparent)',
              zIndex: 5,
            }}
          >
            <button
              onClick={handleContinue}
              disabled={isProceeding}
              style={{
                width: '100%',
                padding: '16px 24px',
                borderRadius: 32,
                border: 'none',
                background: selectedRole.color,
                color: 'white',
                fontSize: 16,
                fontWeight: 800,
                cursor: isProceeding ? 'not-allowed' : 'pointer',
                opacity: isProceeding ? 0.6 : 1,
                boxShadow: `0 8px 24px ${selectedRole.color}66`,
                fontFamily: 'inherit',
                transition: 'opacity 0.2s, box-shadow 0.2s',
              }}
            >
              {isProceeding
                ? 'Just a moment…'
                : `Continue as ${selectedRole.shortTitle}`}
            </button>
          </div>
        )}

        {/* Bottom spacer so sticky CTA doesn't cover content on scroll */}
        <div style={{ height: 60 }} />
      </div>
    </>
  );
}