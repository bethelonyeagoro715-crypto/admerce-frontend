'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../../services/api';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../../components/ui/dialogs';
import {
  SettingsShell,
  SettingsSection,
  SettingsRadio,
} from '../../../../../components/settings/SettingsUI';
import {
  MdLanguage,
  MdSearch,
  MdCheck,
} from 'react-icons/md';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'en-NG', label: 'English (Nigeria)', native: 'English (Nigeria)' },
  { code: 'yo', label: 'Yoruba', native: 'Yorùbá' },
  { code: 'ha', label: 'Hausa', native: 'Hausa' },
  { code: 'ig', label: 'Igbo', native: 'Asụsụ Igbo' },
  { code: 'pcm', label: 'Nigerian Pidgin', native: 'Naijá' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'sw', label: 'Swahili', native: 'Kiswahili' },
];

export default function LanguagePage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState('en');
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
      setSelected((s.language as string) ?? 'en');
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
      router.push(`/settings/${roleSlug}/appearance`);
    }
  };

  const pick = async (code: string) => {
    if (code === selected) return;
    setSaving(true);
    setSelected(code);
    try {
      await api.saveSettings(role, { language: code });
    } catch (err) {
      await alertDialog({
        title: 'Could not save',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
      setSelected((prev) => prev);
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  const filtered = search.trim()
    ? LANGUAGES.filter(
        (l) =>
          l.label.toLowerCase().includes(search.trim().toLowerCase()) ||
          l.native.toLowerCase().includes(search.trim().toLowerCase()) ||
          l.code.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : LANGUAGES;

  if (loading) {
    return (
      <SettingsShell title="Language" onBack={goBack}>
        {[0, 1].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="Language" onBack={goBack}>
      <div style={css.searchWrap}>
        <MdSearch size={18} color="#94A3B8" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search languages"
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

      <SettingsSection
        label="App language"
        footer="Some content may still appear in English while translations are in progress."
      >
        {filtered.length === 0 ? (
          <p style={css.noResults}>No languages match that search</p>
        ) : (
          filtered.map((l) => (
            <SettingsRadio
              key={l.code}
              icon={<MdLanguage size={18} color="#7E22CE" />}
              iconBg="#F3E8FF"
              label={l.label}
              subtitle={l.native !== l.label ? l.native : undefined}
              checked={selected === l.code}
              onSelect={() => void pick(l.code)}
            />
          ))
        )}
      </SettingsSection>

      {saving && <p style={css.savingNote}>Saving…</p>}
    </SettingsShell>
  );
}

const css: Record<string, React.CSSProperties> = {
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    border: '1px solid #EAECF3',
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
  noResults: {
    fontSize: 13,
    color: '#94A3B8',
    padding: '24px 16px',
    textAlign: 'center',
    margin: 0,
  },
  savingNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    margin: '4px 0 0',
  },
  skeleton: {
    height: 200,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};