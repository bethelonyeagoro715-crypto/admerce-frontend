'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { SettingsShell, SettingsSection } from '../../../../components/settings/SettingsUI';
import {
  MdInfo,
  MdCode,
  MdOpenInNew,
  MdFavorite,
  MdPolicy,
  MdGavel,
  MdDescription,
  MdShare,
  MdStar,
} from 'react-icons/md';
import { alertDialog } from '../../../../components/ui/dialogs';

const APP_VERSION = '1.0.0';
const BUILD = '2026.09.28';
const COMMIT = 'dev';

export default function AboutPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}`);
    }
  };

  const share = async () => {
    const text = 'Check out Admerce — buy, sell, and deliver hyperlocal.';
    const url =
      typeof window !== 'undefined' ? window.location.origin : '';
    try {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function'
      ) {
        await navigator.share({ title: 'Admerce', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      await alertDialog({
        title: 'Link copied',
        body: 'Share it with friends.',
        kind: 'success',
      });
    } catch {
      await alertDialog({
        title: 'Share',
        body: url,
      });
    }
  };

  const rate = async () => {
    await alertDialog({
      title: 'Thanks!',
      body: 'Rating opens in the store listing after launch.',
      kind: 'success',
    });
  };

  const openUrl = async (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <SettingsShell title="About" onBack={goBack}>
      <style>{`
        .ab-row:active { background-color: #F8FAFF; }
        .ab-cta:active { transform: scale(0.98); }
      `}</style>

      {/* Logo hero */}
      <div style={css.hero}>
        <div style={css.logoWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/admerce_symbol.png"
            alt="Admerce"
            style={css.logo}
          />
        </div>
        <div style={css.appName}>Admerce</div>
        <div style={css.appTag}>Hyperlocal commerce for Nigeria</div>
        <div style={css.versionChip}>
          <MdInfo size={12} color="#0504AA" />
          <span>Version {APP_VERSION}</span>
        </div>
      </div>

      {/* CTA row */}
      <div style={css.ctaRow}>
        <button onClick={rate} style={css.ctaBtn} className="ab-cta">
          <MdStar size={20} color="#D97706" />
          <span style={css.ctaText}>Rate us</span>
        </button>
        <button onClick={share} style={css.ctaBtn} className="ab-cta">
          <MdShare size={20} color="#0504AA" />
          <span style={css.ctaText}>Share app</span>
        </button>
      </div>

      {/* Legal */}
      <SettingsSection label="Legal">
        <Row
          icon={<MdDescription size={18} color="#475569" />}
          iconBg="#F1F5F9"
          label="Terms and conditions"
          onClick={() => router.push(`/settings/${roleSlug}/legal/terms`)}
        />
        <Row
          icon={<MdPolicy size={18} color="#475569" />}
          iconBg="#F1F5F9"
          label="Privacy policy"
          onClick={() => router.push(`/settings/${roleSlug}/legal/privacy`)}
        />
        <Row
          icon={<MdGavel size={18} color="#475569" />}
          iconBg="#F1F5F9"
          label="Open-source licenses"
          onClick={() => router.push(`/settings/${roleSlug}/legal/licenses`)}
        />
      </SettingsSection>

      {/* Build info */}
      <SettingsSection label="Build">
        <InfoRow label="Version" value={APP_VERSION} />
        <InfoRow label="Build date" value={BUILD} />
        <InfoRow label="Commit" value={COMMIT} />
        <InfoRow label="Platform" value="Web (PWA)" />
      </SettingsSection>

      {/* Links */}
      <SettingsSection label="More">
        <Row
          icon={<MdCode size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="Open-source projects"
          onClick={() => openUrl('https://github.com/bethelonyeagoro715-crypto')}
        />
        <Row
          icon={<MdOpenInNew size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Developer website"
          onClick={() => openUrl('https://admerce-web-app-ashy.vercel.app')}
        />
      </SettingsSection>

      {/* Credits */}
      <div style={css.credits}>
        <div style={css.creditsIcon}>
          <MdFavorite size={20} color="#DC2626" />
        </div>
        <p style={css.creditsText}>
          Built in Owerri with care. Thank you for using Admerce.
        </p>
        <p style={css.creditsSmall}>
          © {new Date().getFullYear()} Admerce. All rights reserved.
        </p>
      </div>
    </SettingsShell>
  );
}

function Row({
  icon,
  iconBg,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="ab-row" style={css.row}>
      <span style={{ ...css.rowIcon, backgroundColor: iconBg }}>{icon}</span>
      <span style={css.rowLabel}>{label}</span>
      <MdOpenInNew size={16} color="#CBD5E1" />
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={css.infoRow}>
      <span style={css.infoLabel}>{label}</span>
      <span style={css.infoValue}>{value}</span>
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 20px 18px',
    textAlign: 'center',
  },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(5,4,170,0.10)',
    marginBottom: 14,
  },
  logo: { width: 60, height: 60, objectFit: 'contain' },
  appName: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  appTag: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center',
  },
  versionChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    borderRadius: 999,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    fontSize: 11.5,
    fontWeight: 800,
    letterSpacing: 0.2,
  },
  ctaRow: {
    display: 'flex',
    gap: 10,
  },
  ctaBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '14px 12px',
    borderRadius: 16,
    border: '1px solid #EAECF3',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.12s',
  },
  ctaText: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '13px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: 600,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '13px 16px',
    borderBottom: '1px solid #F1F5F9',
  },
  infoLabel: { fontSize: 14, color: '#64748B', fontWeight: 500 },
  infoValue: {
    fontSize: 13.5,
    color: '#0B0B1A',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  credits: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 20px 8px',
    textAlign: 'center',
  },
  creditsIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  creditsText: {
    fontSize: 13.5,
    color: '#475569',
    margin: '0 0 8px',
    lineHeight: 1.55,
    maxWidth: 300,
  },
  creditsSmall: {
    fontSize: 11.5,
    color: '#94A3B8',
    margin: 0,
  },
};