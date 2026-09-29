'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../components/ui/dialogs';
import { useTheme, type ThemePreference } from '../../../../contexts/ThemeContext';
import {
  SettingsShell,
  SettingsSection,
  SettingsRadio,
  SettingsToggle,
  SettingsSlider,
} from '../../../../components/settings/SettingsUI';
import {
  MdDarkMode,
  MdLightMode,
  MdBrightnessAuto,
  MdTextFields,
  MdAnimation,
  MdContrast,
} from 'react-icons/md';

export default function AppearancePage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  // ✅ Live theme state — these immediately re-render the app
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Persisted preferences that aren't the theme itself
  const [textScale, setTextScale] = useState(100);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

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
      setTextScale((s.text_scale as number) ?? 100);
      setReduceMotion((s.reduce_motion as boolean) ?? false);
      setHighContrast((s.high_contrast as boolean) ?? false);
      // Note: the theme itself is NOT loaded from the server here.
      // It's stored in localStorage and applied by ThemeProvider so it
      // takes effect on first paint. The backend copy is informational.
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

  // Theme changes apply immediately — no Save button needed for them.
  const handleThemeChange = (next: ThemePreference) => {
    setTheme(next);
    // Fire-and-forget sync to backend. If it fails, the theme still works
    // locally, and the next visit reads localStorage.
    void api
      .saveSettings(role, { theme_mode: next })
      .catch(() => {
        // Silent — localStorage is authoritative
      });
  };

  // Other preferences use the traditional Save flow.
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveSettings(role, {
        theme_mode: theme,
        text_scale: textScale,
        reduce_motion: reduceMotion,
        high_contrast: highContrast,
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

  if (loading) {
    return (
      <SettingsShell title="Appearance" onBack={goBack}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title="Appearance"
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
      <SettingsSection
        label="Theme"
        footer={
          resolvedTheme === 'dark'
            ? 'Currently showing the dark theme.'
            : 'Currently showing the light theme.'
        }
      >
        <SettingsRadio
          icon={<MdBrightnessAuto size={18} color="var(--brand-on-soft)" />}
          iconBg="var(--brand-soft)"
          label="System default"
          subtitle="Match your device"
          checked={theme === 'system'}
          onSelect={() => handleThemeChange('system')}
        />
        <SettingsRadio
          icon={<MdLightMode size={18} color="var(--warning-strong)" />}
          iconBg="var(--warning-bg)"
          label="Light"
          subtitle="Always light"
          checked={theme === 'light'}
          onSelect={() => handleThemeChange('light')}
        />
        <SettingsRadio
          icon={<MdDarkMode size={18} color="var(--purple-fg)" />}
          iconBg="var(--purple-bg)"
          label="Dark"
          subtitle="Always dark"
          checked={theme === 'dark'}
          onSelect={() => handleThemeChange('dark')}
        />
      </SettingsSection>

      <SettingsSection
        label="Text size"
        footer={`Currently ${textScale}% of system default.`}
      >
        <SettingsSlider
          icon={<MdTextFields size={18} color="var(--info-fg)" />}
          iconBg="var(--info-bg)"
          label="Text scale"
          value={textScale}
          min={85}
          max={125}
          step={5}
          unit="%"
          onChanged={setTextScale}
        />
      </SettingsSection>

      <SettingsSection label="Accessibility">
        <SettingsToggle
          icon={<MdAnimation size={18} color="var(--success-fg)" />}
          iconBg="var(--success-bg)"
          label="Reduce motion"
          subtitle="Minimize animations across the app"
          value={reduceMotion}
          onChanged={setReduceMotion}
        />
        <SettingsToggle
          icon={<MdContrast size={18} color="var(--purple-fg)" />}
          iconBg="var(--purple-bg)"
          label="High contrast"
          subtitle="Stronger borders and darker text"
          value={highContrast}
          onChanged={setHighContrast}
        />
      </SettingsSection>
    </SettingsShell>
  );
}

const css: Record<string, React.CSSProperties> = {
  saveBtn: {
    padding: '8px 16px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: 'var(--brand-primary)',
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    transition: 'transform 0.12s',
  },
  skeleton: {
    height: 180,
    borderRadius: 18,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    opacity: 0.5,
  },
};