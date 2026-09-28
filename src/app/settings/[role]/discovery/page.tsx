'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../components/ui/dialogs';
import {
  SettingsShell,
  SettingsSection,
  SettingsSlider,
} from '../../../../components/settings/SettingsUI';
import {
  MdLocationOn,
  MdCategory,
  MdCheckCircle,
  MdSearch,
} from 'react-icons/md';

const CATEGORIES = [
  'Electronics',
  'Fashion',
  'Home & Kitchen',
  'Beauty',
  'Phones & Tablets',
  'Computers',
  'Gaming',
  'Books',
  'Baby & Kids',
  'Health',
  'Sports',
  'Automotive',
  'Groceries',
  'Services',
  'Real Estate',
  'Jobs',
  'Pets',
  'Musical Instruments',
];

export default function DiscoveryPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [radius, setRadius] = useState(50);
  const [preferred, setPreferred] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const s = (await api.getSettings(role)) as Record<string, unknown>;
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setRadius((s.discovery_radius as number) ?? 50);
      setPreferred((s.preferred_categories as string[]) ?? []);
    } catch {
      // Silent
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}`);
    }
  };

  const toggle = (cat: string) => {
    setPreferred((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveSettings(role, {
        discovery_radius: radius,
        preferred_categories: preferred,
      });
      router.back();
    } catch (err) {
      await alertDialog({
        title: 'Could not save',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  const filtered = search.trim()
    ? CATEGORIES.filter((c) =>
        c.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : CATEGORIES;

  if (loading) {
    return (
      <SettingsShell title="Discovery" onBack={goBack}>
        {[0, 1].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title="Discovery"
      onBack={goBack}
      action={
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ ...css.saveBtn, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <style>{`
        .dc-chip:hover { background-color: #F8FAFF; }
      `}</style>

      <SettingsSection
        label="Search radius"
        footer={`You'll see stores and services within ${radius} km of your location.`}
      >
        <SettingsSlider
          icon={<MdLocationOn size={18} color="#D97706" />}
          iconBg="#FEF3C7"
          label="Radius"
          value={radius}
          min={1}
          max={100}
          step={1}
          unit=" km"
          onChanged={setRadius}
        />
      </SettingsSection>

      <SettingsSection
        label="Preferred categories"
        footer={`${preferred.length} of ${CATEGORIES.length} selected. These help us surface the most relevant stores and services.`}
      >
        <div style={css.searchWrap}>
          <MdSearch size={18} color="#94A3B8" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories"
            style={css.searchInput}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={css.clearBtn}
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>

        <div style={css.chipsWrap}>
          {filtered.length === 0 ? (
            <div style={css.noResults}>No categories match that search</div>
          ) : (
            filtered.map((c) => {
              const active = preferred.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggle(c)}
                  className="dc-chip"
                  style={{
                    ...css.chip,
                    borderColor: active ? '#0504AA' : '#E6E8F0',
                    backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
                  }}
                >
                  {active && <MdCheckCircle size={14} color="#0504AA" />}
                  <span
                    style={{
                      color: active ? '#0504AA' : '#475569',
                      fontWeight: active ? 700 : 600,
                    }}
                  >
                    {c}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </SettingsSection>

      {preferred.length > 0 && (
        <button onClick={() => setPreferred([])} style={css.clearAll}>
          Clear all selections
        </button>
      )}
    </SettingsShell>
  );
}

const css: Record<string, React.CSSProperties> = {
  saveBtn: {
    padding: '8px 16px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#0504AA',
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderBottom: '1px solid #F1F5F9',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14.5,
    fontFamily: 'inherit',
    color: '#0B0B1A',
    backgroundColor: 'transparent',
    fontWeight: 500,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    color: '#94A3B8',
    cursor: 'pointer',
    padding: '0 6px',
    lineHeight: 1,
  },
  chipsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '14px 16px',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 14px',
    borderRadius: 999,
    border: '1.5px solid #E6E8F0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  noResults: {
    fontSize: 13,
    color: '#94A3B8',
    padding: '12px 4px',
    width: '100%',
    textAlign: 'center',
  },
  clearAll: {
    padding: '12px 16px',
    backgroundColor: 'transparent',
    color: '#DC2626',
    border: 'none',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
  },
  skeleton: {
    height: 200,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};