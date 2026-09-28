'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  MdArrowBack,
  MdChevronRight,
  MdPhone,
  MdSecurity,
  MdDevices,
  MdNotifications,
  MdShield,
  MdPalette,
  MdCreditCard,
  MdLocationOn,
  MdStarOutline,
  MdHelpOutline,
  MdGavel,
  MdInfo,
  MdDeleteForever,
  MdSwapHoriz,
  MdArrowForward,
} from 'react-icons/md';

// ─── Shell ─────────────────────────────────────────────────────
export function SettingsShell({
  title,
  onBack,
  action,
  children,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '';
  const roleSlug = detectRoleSlug(pathname);
  const activeKey = detectActiveKey(pathname);

  const goToProfile = () => {
    if (typeof window === 'undefined') return;
    const slug = roleSlug === 'service-provider' ? 'service-provider' : roleSlug;
    window.location.href = `/${slug}/profile`;
  };

  return (
    <main className="st-shell">
      <style>{SHELL_CSS}</style>

      <div className="st-layout">
        {/* Desktop sidebar */}
        <aside className="st-sidebar">
          <div className="st-sidebar-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/admerce_symbol.png"
              alt=""
              className="st-sidebar-logo"
            />
            <div style={{ minWidth: 0 }}>
              <div className="st-sidebar-title">Settings</div>
              <div className="st-sidebar-role">
                {roleLabelFromSlug(roleSlug)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={goToProfile}
            className="st-sidebar-back"
          >
            <MdArrowBack size={16} color="#64748B" />
            <span>Back to profile</span>
          </button>

          <nav className="st-nav">
            {buildNav(roleSlug).map((group) => (
              <div key={group.label} className="st-nav-group">
                <div className="st-nav-label">{group.label}</div>
                {group.items.map((item) => {
                  const active = item.match
                    ? item.match.some((m) => pathname.startsWith(m))
                    : pathname === item.href ||
                      pathname.startsWith(item.href + '/');
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`st-nav-item${active ? ' is-active' : ''}${
                        item.danger ? ' is-danger' : ''
                      }`}
                    >
                      <span className="st-nav-icon">{item.icon}</span>
                      <span className="st-nav-text">{item.label}</span>
                      {active && <MdChevronRight size={16} color="#0504AA" />}
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main column */}
        <div className="st-main">
          <header className="st-header">
            <div className="st-header-inner">
              <button
                onClick={onBack}
                className="st-icon-btn st-back-mobile"
                aria-label="Back"
              >
                <MdArrowBack size={22} color="#0B0B1A" />
              </button>
              <h1 className="st-title">{title}</h1>
              <div className="st-action">{action}</div>
            </div>
          </header>

          <div className="st-body">
            <div className="st-body-inner">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Sidebar nav data ──────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: string[];
  danger?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildNav(roleSlug: string): NavGroup[] {
  const base = `/settings/${roleSlug}`;
  const groups: NavGroup[] = [
    {
      label: 'Account',
      items: [
        {
          href: `${base}/account/contact`,
          label: 'Phone & email',
          icon: <MdPhone size={16} color="#0891B2" />,
          match: [`${base}/account/contact`],
        },
        {
          href: `${base}/account/2fa`,
          label: 'Two-factor auth',
          icon: <MdSecurity size={16} color="#16A34A" />,
          match: [`${base}/account/2fa`],
        },
        {
          href: `${base}/account/sessions`,
          label: 'Active sessions',
          icon: <MdDevices size={16} color="#D97706" />,
          match: [`${base}/account/sessions`],
        },
      ],
    },
    {
      label: 'Preferences',
      items: [
        {
          href: `${base}/notifications`,
          label: 'Notifications',
          icon: <MdNotifications size={16} color="#0504AA" />,
        },
        {
          href: `${base}/privacy`,
          label: 'Privacy',
          icon: <MdShield size={16} color="#0891B2" />,
          match: [`${base}/privacy`],
        },
        {
          href: `${base}/appearance`,
          label: 'Appearance',
          icon: <MdPalette size={16} color="#7E22CE" />,
          match: [`${base}/appearance`],
        },
      ],
    },
    {
      label: 'Payments',
      items: [
        {
          href: `/${roleSlug}/wallet/cards`,
          label: 'Payment methods',
          icon: <MdCreditCard size={16} color="#7E22CE" />,
        },
        {
          href: '/wallet-pin-setup',
          label: 'Wallet PIN',
          icon: <MdSecurity size={16} color="#16A34A" />,
        },
      ],
    },
  ];

  if (roleSlug === 'shopper') {
    groups.push({
      label: 'Discovery',
      items: [
        {
          href: `${base}/discovery`,
          label: 'Discovery',
          icon: <MdLocationOn size={16} color="#D97706" />,
        },
      ],
    });
  }

  if (roleSlug === 'storekeeper' || roleSlug === 'service-provider') {
    groups.push({
      label: 'Business',
      items: [
        {
          href: `${base}/preferences`,
          label:
            roleSlug === 'storekeeper'
              ? 'Store preferences'
              : 'Booking & availability',
          icon: <MdStarOutline size={16} color="#D97706" />,
        },
      ],
    });
  }

  groups.push({
    label: 'Support',
    items: [
      {
        href: `${base}/help`,
        label: 'Help center',
        icon: <MdHelpOutline size={16} color="#0504AA" />,
      },
    ],
  });

  groups.push({
    label: 'Legal',
    items: [
      {
        href: `${base}/legal/terms`,
        label: 'Terms & conditions',
        icon: <MdGavel size={16} color="#475569" />,
        match: [`${base}/legal/terms`],
      },
      {
        href: `${base}/legal/privacy`,
        label: 'Privacy policy',
        icon: <MdShield size={16} color="#475569" />,
        match: [`${base}/legal/privacy`],
      },
      {
        href: `${base}/legal/licenses`,
        label: 'Licenses',
        icon: <MdGavel size={16} color="#475569" />,
        match: [`${base}/legal/licenses`],
      },
    ],
  });

  groups.push({
    label: 'About',
    items: [
      {
        href: `${base}/about`,
        label: 'About Admerce',
        icon: <MdInfo size={16} color="#475569" />,
      },
      {
        href: '/onboarding?mode=switch',
        label: 'Switch role',
        icon: <MdSwapHoriz size={16} color="#16A34A" />,
      },
    ],
  });

  groups.push({
    label: 'Danger zone',
    items: [
      {
        href: `${base}/account/delete`,
        label: 'Delete account',
        icon: <MdDeleteForever size={16} color="#DC2626" />,
        match: [`${base}/account/delete`],
        danger: true,
      },
    ],
  });

  return groups;
}

function roleLabelFromSlug(slug: string): string {
  const map: Record<string, string> = {
    shopper: 'Shopper',
    storekeeper: 'Storekeeper',
    'service-provider': 'Service Provider',
    courier: 'Courier',
    flipper: 'Flipper',
    admin: 'Admin',
  };
  return map[slug] || 'Settings';
}

function detectRoleSlug(pathname: string): string {
  const m = pathname.match(/^\/settings\/([^/]+)/);
  return m ? m[1] : 'shopper';
}

function detectActiveKey(pathname: string): string {
  return pathname;
}

// ─── Section ───────────────────────────────────────────────────
export function SettingsSection({
  label,
  children,
  footer,
}: {
  label?: string;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <section style={S.section}>
      {label && <h3 style={S.sectionLabel}>{label}</h3>}
      <div style={S.card}>{children}</div>
      {footer && <p style={S.sectionFooter}>{footer}</p>}
    </section>
  );
}

// ─── Tappable row ──────────────────────────────────────────────
export function SettingsRow({
  icon,
  iconBg = '#EEF0FF',
  label,
  subtitle,
  value,
  badge,
  danger,
  onClick,
  disabled,
}: {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  subtitle?: string;
  value?: string;
  badge?: number;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const tappable = !!onClick && !disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="st-row"
      style={{
        ...S.row,
        cursor: disabled ? 'default' : tappable ? 'pointer' : 'default',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon && (
        <span style={{ ...S.rowIconWrap, backgroundColor: iconBg }}>{icon}</span>
      )}
      <span style={S.rowBody}>
        <span style={{ ...S.rowLabel, color: danger ? '#DC2626' : '#0B0B1A' }}>
          {label}
        </span>
        {subtitle && <span style={S.rowSubtitle}>{subtitle}</span>}
      </span>
      {badge != null && badge > 0 && (
        <span style={S.rowBadge}>{badge > 99 ? '99+' : badge}</span>
      )}
      {value && <span style={S.rowValue}>{value}</span>}
      {tappable && <MdChevronRight size={18} color="#CBD5E1" />}
    </button>
  );
}

// ─── Toggle row ────────────────────────────────────────────────
export function SettingsToggle({
  icon,
  iconBg = '#EEF0FF',
  label,
  subtitle,
  value,
  onChanged,
  disabled,
}: {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  subtitle?: string;
  value: boolean;
  onChanged: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="st-row"
      style={{ ...S.row, cursor: 'default', opacity: disabled ? 0.6 : 1 }}
    >
      {icon && (
        <span style={{ ...S.rowIconWrap, backgroundColor: iconBg }}>{icon}</span>
      )}
      <span style={S.rowBody}>
        <span style={S.rowLabel}>{label}</span>
        {subtitle && <span style={S.rowSubtitle}>{subtitle}</span>}
      </span>
      <Switch value={value} onChange={onChanged} disabled={disabled} />
    </div>
  );
}

// ─── Slider row ────────────────────────────────────────────────
export function SettingsSlider({
  icon,
  iconBg = '#EEF0FF',
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChanged,
}: {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChanged: (v: number) => void;
}) {
  return (
    <div className="st-row" style={S.sliderWrap}>
      <div style={S.sliderHeader}>
        {icon && (
          <span style={{ ...S.rowIconWrap, backgroundColor: iconBg }}>
            {icon}
          </span>
        )}
        <span style={S.rowLabel}>{label}</span>
        <span style={S.sliderValue}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChanged(Number(e.target.value))}
        style={S.sliderInput}
      />
    </div>
  );
}

// ─── Native select picker ──────────────────────────────────────
export function SettingsPicker({
  icon,
  iconBg = '#EEF0FF',
  label,
  value,
  items,
  onChanged,
}: {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChanged: (v: string) => void;
}) {
  return (
    <label className="st-row" style={{ ...S.row, cursor: 'pointer' }}>
      {icon && (
        <span style={{ ...S.rowIconWrap, backgroundColor: iconBg }}>{icon}</span>
      )}
      <span style={S.rowBody}>
        <span style={S.rowLabel}>{label}</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChanged(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        style={S.select}
      >
        {items.map((it) => (
          <option key={it.value} value={it.value}>
            {it.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Radio row ─────────────────────────────────────────────────
export function SettingsRadio({
  icon,
  iconBg = '#EEF0FF',
  label,
  subtitle,
  checked,
  onSelect,
}: {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  subtitle?: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="st-row"
      style={{ ...S.row, cursor: 'pointer' }}
    >
      {icon && (
        <span style={{ ...S.rowIconWrap, backgroundColor: iconBg }}>{icon}</span>
      )}
      <span style={S.rowBody}>
        <span style={S.rowLabel}>{label}</span>
        {subtitle && <span style={S.rowSubtitle}>{subtitle}</span>}
      </span>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: checked ? '6px solid #0504AA' : '2px solid #CBD5E1',
          boxSizing: 'border-box',
          flexShrink: 0,
          transition: 'border 0.15s ease',
        }}
      />
    </button>
  );
}

// ─── Read-only row ─────────────────────────────────────────────
export function SettingsValue({
  icon,
  iconBg = '#EEF0FF',
  label,
  value,
}: {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="st-row" style={{ ...S.row, cursor: 'default' }}>
      {icon && (
        <span style={{ ...S.rowIconWrap, backgroundColor: iconBg }}>{icon}</span>
      )}
      <span style={S.rowBody}>
        <span style={S.rowLabel}>{label}</span>
      </span>
      <span style={S.rowValue}>{value}</span>
    </div>
  );
}

// ─── Switch primitive ──────────────────────────────────────────
function Switch({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      style={{
        position: 'relative',
        width: 46,
        height: 28,
        borderRadius: 999,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: value ? '#0504AA' : '#CBD5E1',
        transition: 'background-color 0.18s ease',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          transition: 'left 0.18s ease',
        }}
      />
    </button>
  );
}

// ─── Shell CSS (media queries + sidebar) ───────────────────────
const SHELL_CSS = `
  .st-shell, .st-shell *, .st-shell *::before, .st-shell *::after {
    box-sizing: border-box;
  }

  .st-shell {
    min-height: 100vh;
    background-color: #F4F5FB;
    width: 100%;
  }

  .st-layout {
    display: flex;
    min-height: 100vh;
    width: 100%;
  }

  /* Sidebar — hidden by default (mobile), shown on desktop */
  .st-sidebar {
    display: none;
    width: 264px;
    flex-shrink: 0;
    background-color: #FFFFFF;
    border-right: 1px solid #EAECF3;
    padding: 18px 12px 32px;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }
  .st-sidebar-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px 16px;
  }
  .st-sidebar-logo {
    width: 36px;
    height: 36px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .st-sidebar-title {
    font-size: 14.5px;
    font-weight: 800;
    color: #0B0B1A;
    letter-spacing: -0.2;
    line-height: 1.2;
  }
  .st-sidebar-role {
    font-size: 11.5px;
    color: #94A3B8;
    font-weight: 600;
    margin-top: 1px;
  }
  .st-sidebar-back {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 10px;
    border: none;
    background-color: transparent;
    color: #64748B;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border-radius: 10px;
    margin-bottom: 14px;
    transition: background-color 0.15s;
  }
  .st-sidebar-back:hover {
    background-color: #F4F5FB;
  }

  .st-nav {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .st-nav-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .st-nav-label {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: #94A3B8;
    padding: 4px 10px 6px;
  }
  .st-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 10px;
    color: #334155;
    font-size: 13.5px;
    font-weight: 600;
    text-decoration: none;
    transition: background-color 0.15s, color 0.15s;
    letter-spacing: -0.05;
  }
  .st-nav-item:hover {
    background-color: #F4F5FB;
    color: #0B0B1A;
  }
  .st-nav-item.is-active {
    background-color: #EEF0FF;
    color: #0504AA;
  }
  .st-nav-item.is-danger {
    color: #DC2626;
  }
  .st-nav-item.is-danger:hover {
    background-color: #FEF2F2;
  }
  .st-nav-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    flex-shrink: 0;
  }
  .st-nav-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Main column */
  .st-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .st-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background-color: rgba(244,245,251,0.94);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid #EAECF3;
    width: 100%;
  }
  .st-header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 14px;
    width: 100%;
    max-width: 880px;
    margin: 0 auto;
  }
  .st-title {
    flex: 1;
    text-align: center;
    font-size: 15.5px;
    font-weight: 700;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st-action {
    min-width: 38px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex-shrink: 0;
  }
  .st-icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    border: none;
    background-color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(15,23,42,0.06);
    flex-shrink: 0;
  }

  /* Body */
  .st-body {
    width: 100%;
    padding: 16px 16px 48px;
  }
  .st-body-inner {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 880px;
    margin: 0 auto;
    width: 100%;
  }

  /* Rows */
  .st-row + .st-row {
    border-top: 1px solid #F1F5F9;
  }
  .st-row:hover:not(:disabled) {
    background-color: #FAFBFF;
  }
  .st-row:active:not(:disabled) {
    background-color: #F4F5FB;
  }

  /* Desktop — show sidebar, hide mobile back arrow */
  @media (min-width: 1024px) {
    .st-sidebar { display: flex; flex-direction: column; }
    .st-back-mobile { display: none; }
    .st-header-inner { padding: 12px 32px; }
    .st-body { padding: 24px 32px 64px; }
  }
`;

// ─── Styles (inline, non-responsive) ───────────────────────────
const S: Record<string, React.CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '0 0 0 4px',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
  },
  sectionFooter: {
    fontSize: 12,
    color: '#94A3B8',
    margin: '2px 4px 0',
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '13px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14.5,
    fontWeight: 600,
    color: '#0B0B1A',
    letterSpacing: -0.1,
    lineHeight: 1.35,
  },
  rowSubtitle: { fontSize: 12, color: '#94A3B8', lineHeight: 1.35 },
  rowValue: {
    fontSize: 13,
    fontWeight: 500,
    color: '#94A3B8',
    maxWidth: 150,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  rowBadge: {
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 999,
    backgroundColor: '#DC2626',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sliderWrap: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  sliderHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  sliderValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0504AA',
    marginLeft: 'auto',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  sliderInput: {
    width: '100%',
    accentColor: '#0504AA',
    cursor: 'pointer',
  },
  select: {
    fontSize: 13,
    fontWeight: 600,
    color: '#0504AA',
    backgroundColor: '#EEF0FF',
    border: 'none',
    borderRadius: 10,
    padding: '6px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    maxWidth: 160,
    flexShrink: 0,
  },
};