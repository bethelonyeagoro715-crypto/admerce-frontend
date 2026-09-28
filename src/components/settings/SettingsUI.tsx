'use client';

import React from 'react';
import { MdArrowBack, MdChevronRight } from 'react-icons/md';

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
  return (
    <main style={S.root}>
      <style>{`
        .st-row + .st-row { border-top: 1px solid #F1F5F9; }
        .st-row:hover:not(:disabled) { background-color: #FAFBFF; }
        .st-row:active:not(:disabled) { background-color: #F4F5FB; }
      `}</style>
      <header style={S.header}>
        <button onClick={onBack} style={S.iconBtn} aria-label="Back">
          <MdArrowBack size={22} color="#0B0B1A" />
        </button>
        <h1 style={S.headerTitle}>{title}</h1>
        <div style={S.headerRight}>{action}</div>
      </header>
      <div style={S.body}>{children}</div>
    </main>
  );
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
    <div className="st-row" style={{ ...S.row, cursor: 'default', opacity: disabled ? 0.6 : 1 }}>
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
          <span style={{ ...S.rowIconWrap, backgroundColor: iconBg }}>{icon}</span>
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

// ─── Styles ────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    overflowX: 'hidden',
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
  headerRight: {
    minWidth: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  body: {
    padding: '16px 16px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
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
  },
  sliderWrap: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  sliderHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  sliderValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0504AA',
    marginLeft: 'auto',
    fontVariantNumeric: 'tabular-nums',
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
  },
};