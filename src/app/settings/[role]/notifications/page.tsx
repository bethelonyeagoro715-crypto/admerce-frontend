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
} from '../../../../components/settings/SettingsUI';
import {
  MdNotificationsActive,
  MdEmail,
  MdSms,
  MdSearch,
  MdStorefront,
  MdChat,
  MdLocalShipping,
  MdReceiptLong,
  MdLocalOffer,
  MdAlternateEmail,
  MdTrendingUp,
  MdEventAvailable,
  MdEventNote,
  MdAttachMoney,
  MdCelebration,
} from 'react-icons/md';

type NotifState = {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  wanted_alerts: boolean;
  followed_stores: boolean;
  messages: boolean;
  delivery_updates: boolean;
  order_status: boolean;
  promotions: boolean;
  community_mentions: boolean;
  price_changes: boolean;
  sale_completed: boolean;
  new_booking: boolean;
  booking_reminders: boolean;
  earnings_updates: boolean;
};

const DEFAULTS: NotifState = {
  push_enabled: true,
  email_enabled: false,
  sms_enabled: false,
  wanted_alerts: true,
  followed_stores: true,
  messages: true,
  delivery_updates: true,
  order_status: true,
  promotions: false,
  community_mentions: false,
  price_changes: false,
  sale_completed: true,
  new_booking: true,
  booking_reminders: true,
  earnings_updates: true,
};

export default function NotificationsPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<NotifState>(DEFAULTS);

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
      const next: NotifState = { ...DEFAULTS };
      (Object.keys(DEFAULTS) as (keyof NotifState)[]).forEach((k) => {
        const v = s[k];
        if (typeof v === 'boolean') next[k] = v;
      });
      setState(next);
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

  const set = <K extends keyof NotifState>(k: K, v: NotifState[K]) =>
    setState((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveSettings(role, state as unknown as Record<string, unknown>);
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
      <SettingsShell title="Notifications" onBack={goBack}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  const channelsDisabled =
    !state.push_enabled && !state.email_enabled && !state.sms_enabled;

  return (
    <SettingsShell
      title="Notifications"
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
        label="Channels"
        footer="Turn off all channels to silence every notification."
      >
        <SettingsToggle
          icon={<MdNotificationsActive size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="Push notifications"
          subtitle="Alerts on this device"
          value={state.push_enabled}
          onChanged={(v) => set('push_enabled', v)}
        />
        <SettingsToggle
          icon={<MdEmail size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Email"
          subtitle="Summaries and important alerts"
          value={state.email_enabled}
          onChanged={(v) => set('email_enabled', v)}
        />
        <SettingsToggle
          icon={<MdSms size={18} color="#16A34A" />}
          iconBg="#DCFCE7"
          label="SMS"
          subtitle="Text messages for time-sensitive alerts"
          value={state.sms_enabled}
          onChanged={(v) => set('sms_enabled', v)}
        />
      </SettingsSection>

      <SettingsSection
        label="Activity"
        footer={
          channelsDisabled
            ? 'All channels are off — nothing will be delivered.'
            : undefined
        }
      >
        <SettingsToggle
          icon={<MdSearch size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Wanted alerts"
          subtitle="When an item matching your wanted list is listed"
          value={state.wanted_alerts}
          onChanged={(v) => set('wanted_alerts', v)}
          disabled={channelsDisabled}
        />
        <SettingsToggle
          icon={<MdStorefront size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="New from followed stores"
          subtitle="Fresh listings from stores you follow"
          value={state.followed_stores}
          onChanged={(v) => set('followed_stores', v)}
          disabled={channelsDisabled}
        />
        <SettingsToggle
          icon={<MdChat size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
          label="Messages"
          subtitle="Chats from buyers, sellers, and providers"
          value={state.messages}
          onChanged={(v) => set('messages', v)}
          disabled={channelsDisabled}
        />
        <SettingsToggle
          icon={<MdLocalShipping size={18} color="#D97706" />}
          iconBg="#FEF3C7"
          label="Delivery updates"
          subtitle="When a courier is on the way"
          value={state.delivery_updates}
          onChanged={(v) => set('delivery_updates', v)}
          disabled={channelsDisabled}
        />
        <SettingsToggle
          icon={<MdReceiptLong size={18} color="#16A34A" />}
          iconBg="#DCFCE7"
          label="Order status"
          subtitle="Confirmations, escrow releases, receipts"
          value={state.order_status}
          onChanged={(v) => set('order_status', v)}
          disabled={channelsDisabled}
        />
        <SettingsToggle
          icon={<MdAlternateEmail size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Community mentions"
          subtitle="When someone @mentions you in community chat"
          value={state.community_mentions}
          onChanged={(v) => set('community_mentions', v)}
          disabled={channelsDisabled}
        />
        <SettingsToggle
          icon={<MdLocalOffer size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
          label="Promotions"
          subtitle="Deals, discounts, and featured drops"
          value={state.promotions}
          onChanged={(v) => set('promotions', v)}
          disabled={channelsDisabled}
        />
      </SettingsSection>

      {(role === 'storekeeper' || role === 'flipper') && (
        <SettingsSection label="Selling">
          <SettingsToggle
            icon={<MdTrendingUp size={18} color="#0891B2" />}
            iconBg="#E0F2FE"
            label="Price changes on tracked items"
            value={state.price_changes}
            onChanged={(v) => set('price_changes', v)}
            disabled={channelsDisabled}
          />
          <SettingsToggle
            icon={<MdCelebration size={18} color="#16A34A" />}
            iconBg="#DCFCE7"
            label="Sale completed"
            subtitle="When an order is confirmed and released"
            value={state.sale_completed}
            onChanged={(v) => set('sale_completed', v)}
            disabled={channelsDisabled}
          />
        </SettingsSection>
      )}

      {role === 'service_provider' && (
        <SettingsSection label="Bookings">
          <SettingsToggle
            icon={<MdEventAvailable size={18} color="#0504AA" />}
            iconBg="#EEF0FF"
            label="New booking"
            subtitle="When a shopper books a service"
            value={state.new_booking}
            onChanged={(v) => set('new_booking', v)}
            disabled={channelsDisabled}
          />
          <SettingsToggle
            icon={<MdEventNote size={18} color="#D97706" />}
            iconBg="#FEF3C7"
            label="Booking reminders"
            subtitle="Upcoming appointments starting soon"
            value={state.booking_reminders}
            onChanged={(v) => set('booking_reminders', v)}
            disabled={channelsDisabled}
          />
          <SettingsToggle
            icon={<MdAttachMoney size={18} color="#16A34A" />}
            iconBg="#DCFCE7"
            label="Earnings updates"
            subtitle="Escrow releases and payouts"
            value={state.earnings_updates}
            onChanged={(v) => set('earnings_updates', v)}
            disabled={channelsDisabled}
          />
        </SettingsSection>
      )}

      <p style={css.footnote}>
        SMS notifications may incur charges from your mobile carrier.
      </p>
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
  footnote: {
    fontSize: 12,
    color: '#94A3B8',
    margin: '4px 4px 0',
    lineHeight: 1.55,
  },
  skeleton: {
    height: 200,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};