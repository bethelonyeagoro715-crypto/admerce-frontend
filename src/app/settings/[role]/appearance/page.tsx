'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../components/ui/dialogs';
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
  MdSave,
} from 'react-icons/md';

type ThemeMode = 'system' | 'light' | 'dark';

export default function AppearancePage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
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
      setThemeMode((s.theme_mode as ThemeMode) ?? 'system');
      setTextScale((s.text_scale as number) ?? 100);
      setReduceMotion((s.reduce_motion as boolean) ?? false);
      setHighContrast((s.high_contrast as boolean) ?? false);
    } catch {
      // Silent — defaults are fine
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveSettings(role, {
        theme_mode: themeMode,
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
      <SettingsSection label="Theme" footer="System follows your device settings.">
        <SettingsRadio
          icon={<MdBrightnessAuto size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="System default"
          subtitle="Match your device"
          checked={themeMode === 'system'}
          onSelect={() => setThemeMode('system')}
        />
        <SettingsRadio
          icon={<MdLightMode size={18} color="#D97706" />}
          iconBg="#FEF3C7"
          label="Light"
          subtitle="Always light"
          checked={themeMode === 'light'}
          onSelect={() => setThemeMode('light')}
        />
        <SettingsRadio
          icon={<MdDarkMode size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
          label="Dark"
          subtitle="Always dark"
          checked={themeMode === 'dark'}
          onSelect={() => setThemeMode('dark')}
        />
      </SettingsSection>

      <SettingsSection
        label="Text size"
        footer={`Currently ${textScale}% of system default.`}
      >
        <SettingsSlider
          icon={<MdTextFields size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
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
          icon={<MdAnimation size={18} color="#16A34A" />}
          iconBg="#DCFCE7"
          label="Reduce motion"
          subtitle="Minimize animations across the app"
          value={reduceMotion}
          onChanged={setReduceMotion}
        />
        <SettingsToggle
          icon={<MdContrast size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
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
    backgroundColor: '#0504AA',
    color: '#fff',
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
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};