'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../components/ui/dialogs';
import {
  SettingsShell,
  SettingsSection,
  SettingsToggle,
  SettingsSlider,
  SettingsPicker,
} from '../../../../components/settings/SettingsUI';
import {
  MdStorefront,
  MdBeachAccess,
  MdSchedule,
  MdEventAvailable,
  MdMyLocation,
  MdTimer,
  MdCalendarMonth,
  MdInfo,
} from 'react-icons/md';

const PICKUP_OPTIONS = [
  { value: '1', label: '1 hour' },
  { value: '2', label: '2 hours' },
  { value: '3', label: '3 hours' },
  { value: '4', label: '4 hours' },
  { value: '6', label: '6 hours' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
];

export default function PreferencesPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'storekeeper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const isStorekeeper = role === 'storekeeper';
  const isProvider = role === 'service_provider';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [autoAccept, setAutoAccept] = useState(false);
  const [vacationMode, setVacationMode] = useState(false);
  const [pickupWindow, setPickupWindow] = useState('2');

  const [bufferTime, setBufferTime] = useState(30);
  const [serviceArea, setServiceArea] = useState(10);
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [calendarSync, setCalendarSync] = useState(false);

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
      setAutoAccept((s.auto_accept_reservations as boolean) ?? false);
      setVacationMode((s.vacation_mode as boolean) ?? false);
      setPickupWindow((s.default_pickup_window as string) ?? '2');
      setBufferTime((s.buffer_time as number) ?? 30);
      setServiceArea((s.service_area_radius as number) ?? 10);
      setDefaultDuration((s.default_service_duration as number) ?? 60);
      setCalendarSync((s.calendar_sync as boolean) ?? false);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (isStorekeeper) {
        payload.auto_accept_reservations = autoAccept;
        payload.vacation_mode = vacationMode;
        payload.default_pickup_window = pickupWindow;
      }
      if (isProvider) {
        payload.buffer_time = bufferTime;
        payload.service_area_radius = serviceArea;
        payload.default_service_duration = defaultDuration;
        payload.calendar_sync = calendarSync;
      }
      await api.saveSettings(role, payload);
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
      <SettingsShell title="Preferences" onBack={goBack}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title={isStorekeeper ? 'Store preferences' : 'Booking & availability'}
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
      {isStorekeeper && (
        <>
          <SettingsSection
            label="Order handling"
            footer="Auto-accept works only when the buyer has funds ready in escrow."
          >
            <SettingsToggle
              icon={<MdStorefront size={18} color="#0504AA" />}
              iconBg="#EEF0FF"
              label="Auto-accept reservations"
              subtitle="Accept incoming orders without manual review"
              value={autoAccept}
              onChanged={setAutoAccept}
            />
            <SettingsToggle
              icon={<MdBeachAccess size={18} color="#D97706" />}
              iconBg="#FEF3C7"
              label="Vacation mode"
              subtitle="Hide your listings and pause new orders"
              value={vacationMode}
              onChanged={setVacationMode}
            />
          </SettingsSection>

          <SettingsSection
            label="Pickup window"
            footer="How long buyers have to pick up an item before escrow expires and funds are returned."
          >
            <SettingsPicker
              icon={<MdSchedule size={18} color="#0891B2" />}
              iconBg="#E0F2FE"
              label="Default pickup window"
              value={pickupWindow}
              items={PICKUP_OPTIONS}
              onChanged={setPickupWindow}
            />
          </SettingsSection>
        </>
      )}

      {isProvider && (
        <>
          <SettingsSection
            label="Booking rules"
            footer={`Buffer time gives you ${bufferTime} min of rest between appointments.`}
          >
            <SettingsSlider
              icon={<MdTimer size={18} color="#0504AA" />}
              iconBg="#EEF0FF"
              label="Buffer between bookings"
              value={bufferTime}
              min={0}
              max={120}
              step={5}
              unit=" min"
              onChanged={setBufferTime}
            />
            <SettingsSlider
              icon={<MdEventAvailable size={18} color="#0891B2" />}
              iconBg="#E0F2FE"
              label="Default service duration"
              value={defaultDuration}
              min={15}
              max={240}
              step={15}
              unit=" min"
              onChanged={setDefaultDuration}
            />
          </SettingsSection>

          <SettingsSection
            label="Service area"
            footer={`You accept bookings within ${serviceArea} km of your base location.`}
          >
            <SettingsSlider
              icon={<MdMyLocation size={18} color="#D97706" />}
              iconBg="#FEF3C7"
              label="Radius"
              value={serviceArea}
              min={1}
              max={100}
              step={1}
              unit=" km"
              onChanged={setServiceArea}
            />
          </SettingsSection>

          <SettingsSection label="Integrations">
            <SettingsToggle
              icon={<MdCalendarMonth size={18} color="#16A34A" />}
              iconBg="#DCFCE7"
              label="Calendar sync"
              subtitle="Sync bookings to Google Calendar (coming soon)"
              value={calendarSync}
              onChanged={setCalendarSync}
            />
          </SettingsSection>
        </>
      )}

      {!isStorekeeper && !isProvider && (
        <div style={css.empty}>
          <MdInfo size={32} color="#94A3B8" />
          <p style={css.emptyText}>
            Preferences are only available for storekeepers and service
            providers.
          </p>
        </div>
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
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '60px 20px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 1.55,
    maxWidth: 320,
    margin: 0,
  },
  skeleton: {
    height: 180,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};