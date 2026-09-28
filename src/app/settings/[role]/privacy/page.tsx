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
  SettingsRow,
} from '../../../../components/settings/SettingsUI';
import {
  MdPublic,
  MdGroup,
  MdLock,
  MdVisibility,
  MdPhone,
  MdEmail,
  MdBadge,
  MdShare,
  MdChatBubbleOutline,
  MdDoneAll,
  MdBlock,
  MdHistory,
} from 'react-icons/md';

type Visibility = 'public' | 'followers' | 'private';

export default function PrivacyPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [visibility, setVisibility] = useState<Visibility>('public');
  const [showLastName, setShowLastName] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [shareActivity, setShareActivity] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);

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
      setVisibility((s.profile_visibility as Visibility) ?? 'public');
      setShowLastName((s.privacy_show_last_name as boolean) ?? true);
      setShowPhone((s.privacy_show_phone as boolean) ?? false);
      setShowEmail((s.privacy_show_email as boolean) ?? false);
      setShareActivity((s.privacy_share_activity as boolean) ?? false);
      setAllowMessages((s.privacy_allow_messages as boolean) ?? true);
      setReadReceipts((s.privacy_read_receipts as boolean) ?? true);
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
      await api.saveSettings(role, {
        profile_visibility: visibility,
        privacy_show_last_name: showLastName,
        privacy_show_phone: showPhone,
        privacy_show_email: showEmail,
        privacy_share_activity: shareActivity,
        privacy_allow_messages: allowMessages,
        privacy_read_receipts: readReceipts,
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
      <SettingsShell title="Privacy" onBack={goBack}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title="Privacy"
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
        label="Profile visibility"
        footer="Controls who can see your name, photo, and activity."
      >
        <SettingsRadio
          icon={<MdPublic size={18} color="#16A34A" />}
          iconBg="#DCFCE7"
          label="Public"
          subtitle="Anyone can view your profile"
          checked={visibility === 'public'}
          onSelect={() => setVisibility('public')}
        />
        <SettingsRadio
          icon={<MdGroup size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Followers only"
          subtitle="Only people who follow you"
          checked={visibility === 'followers'}
          onSelect={() => setVisibility('followers')}
        />
        <SettingsRadio
          icon={<MdLock size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
          label="Private"
          subtitle="Only you can view your profile"
          checked={visibility === 'private'}
          onSelect={() => setVisibility('private')}
        />
      </SettingsSection>

      <SettingsSection label="What others see">
        <SettingsToggle
          icon={<MdBadge size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="Show my last name"
          value={showLastName}
          onChanged={setShowLastName}
        />
        <SettingsToggle
          icon={<MdPhone size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Show my phone number"
          subtitle="Sellers and couriers may need this during delivery"
          value={showPhone}
          onChanged={setShowPhone}
        />
        <SettingsToggle
          icon={<MdEmail size={18} color="#D97706" />}
          iconBg="#FEF3C7"
          label="Show my email"
          value={showEmail}
          onChanged={setShowEmail}
        />
        <SettingsToggle
          icon={<MdShare size={18} color="#16A34A" />}
          iconBg="#DCFCE7"
          label="Share my activity with sellers"
          subtitle="Views, saves, and past orders"
          value={shareActivity}
          onChanged={setShareActivity}
        />
      </SettingsSection>

      <SettingsSection label="Messaging">
        <SettingsToggle
          icon={<MdChatBubbleOutline size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="Allow messages from anyone"
          subtitle="Turn off to only receive messages from people you follow"
          value={allowMessages}
          onChanged={setAllowMessages}
        />
        <SettingsToggle
          icon={<MdDoneAll size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Read receipts"
          subtitle="Let others see when you've read their messages"
          value={readReceipts}
          onChanged={setReadReceipts}
        />
      </SettingsSection>

      <SettingsSection label="Manage">
        <SettingsRow
          icon={<MdBlock size={18} color="#DC2626" />}
          iconBg="#FEE2E2"
          label="Blocked users"
          subtitle="Manage people you've blocked"
          onClick={() => router.push(`/settings/${roleSlug}/privacy/blocked`)}
        />
        <SettingsRow
          icon={<MdHistory size={18} color="#D97706" />}
          iconBg="#FEF3C7"
          label="Login activity"
          subtitle="Recent devices and sessions"
          onClick={() => router.push(`/settings/${roleSlug}/privacy/activity`)}
        />
      </SettingsSection>

      <p style={css.footnote}>
        Changes apply immediately after you tap Save. Some settings may take a
        few minutes to reflect for other users.
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
    height: 220,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};