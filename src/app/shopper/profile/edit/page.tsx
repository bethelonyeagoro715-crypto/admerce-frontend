'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../components/ui/dialogs';
import { SettingsShell } from '../../../../components/settings/SettingsUI';
import {
  MdCameraAlt,
  MdClose,
  MdPhotoLibrary,
  MdSave,
  MdPerson,
  MdBadge,
  MdInfo,
} from 'react-icons/md';

interface Profile {
  nickname?: string;
  username?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  bio?: string;
  avatar_url?: string;
  role?: string;
  [key: string]: unknown;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  )
    return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

export default function EditProfilePage() {
  useAuthGuard();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleSlug, setRoleSlug] = useState('shopper');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [realName, setRealName] = useState('');
  const [bio, setBio] = useState('');

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState('?');

  const [errors, setErrors] = useState<Record<string, string>>({});

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
      const p = (await api.getMyProfile()) as Profile;
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setFirstName((p.first_name as string) || '');
      setLastName((p.last_name as string) || '');
      setNickname((p.nickname as string) || '');
      setRealName((p.real_name as string) || '');
      setBio((p.bio as string) || '');
      setPhone(p.phone || '');
      setEmail(p.email || '');
      setAvatarUrl(resolveImageUrl(p.avatar_url));
      const role = (p.role || 'shopper').toLowerCase();
      setRoleSlug(role === 'service_provider' ? 'service-provider' : role);
      const dn = p.nickname || p.first_name || p.phone || '?';
      setInitial((String(dn).charAt(0) || '?').toUpperCase());
    } catch (err) {
      if (seq === reqSeq.current && isMountedRef.current) {
        await alertDialog({
          title: 'Could not load profile',
          body: extractErrorDetail(err, 'Please try again in a moment.'),
          kind: 'danger',
        });
      }
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${roleSlug}/profile`);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (firstName.length > 60) e.firstName = 'Max 60 characters';
    if (lastName.length > 60) e.lastName = 'Max 60 characters';
    if (nickname.length > 30) e.nickname = 'Max 30 characters';
    if (realName.length > 80) e.realName = 'Max 80 characters';
    if (bio.length > 200) e.bio = 'Max 200 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.updateMyProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        nickname: nickname.trim() || null,
        real_name: realName.trim() || null,
        bio: bio.trim() || null,
      });
      router.back();
    } catch (err) {
      await alertDialog({
        title: 'Could not save',
        body: extractErrorDetail(
          err,
          'Your changes could not be saved. Please try again.',
        ),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  const openAvatar = () => router.push(`/${roleSlug}/profile`);

  if (loading) {
    return (
      <SettingsShell title="Edit profile" onBack={goBack}>
        <div style={css.skeletonAvatar} />
        <div style={css.skeletonLine} />
        <div style={css.skeletonLine} />
        <div style={css.skeletonLine} />
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title="Edit profile"
      onBack={goBack}
      action={
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ ...css.saveBtn, opacity: saving ? 0.6 : 1 }}
          className="ep-save"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <style>{`
        .ep-save:active:not(:disabled) { transform: scale(0.97); }
        .ep-input:focus { border-color: #0504AA; box-shadow: 0 0 0 3px rgba(5,4,170,0.10); }
        .ep-input:hover:not(:focus) { border-color: #CBD5E1; }
      `}</style>

      {/* Avatar */}
      <div style={css.avatarBlock}>
        <button
          type="button"
          onClick={openAvatar}
          style={css.avatarWrap}
          aria-label="Change photo on profile"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" style={css.avatarImg} />
          ) : (
            <span style={css.avatarFallback}>{initial}</span>
          )}
          <span style={css.avatarOverlay} aria-hidden>
            <MdCameraAlt size={18} color="#fff" />
          </span>
        </button>
        <button type="button" onClick={openAvatar} style={css.avatarLink}>
          Change profile photo
        </button>
      </div>

      {/* Names */}
      <h3 style={css.sectionLabel}>Your name</h3>
      <div style={css.card}>
        <Field
          label="First name"
          value={firstName}
          onChange={setFirstName}
          placeholder="e.g. Bethel"
          error={errors.firstName}
          required
          maxLength={60}
        />
        <Field
          label="Last name"
          value={lastName}
          onChange={setLastName}
          placeholder="e.g. Onyeagoro"
          error={errors.lastName}
          maxLength={60}
        />
        <Field
          label="Display name"
          hint="Shown publicly instead of your real name"
          value={nickname}
          onChange={setNickname}
          placeholder="e.g. bethelmart"
          error={errors.nickname}
          maxLength={30}
        />
        <Field
          label="Business name (optional)"
          hint="For receipts and invoices"
          value={realName}
          onChange={setRealName}
          placeholder="e.g. Bethel Ventures Ltd"
          error={errors.realName}
          maxLength={80}
        />
      </div>

      {/* Bio */}
      <h3 style={css.sectionLabel}>About you</h3>
      <div style={css.card}>
        <label style={css.fieldWrap}>
          <span style={css.fieldLabel}>Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell buyers and sellers a little about yourself"
            maxLength={200}
            rows={4}
            className="ep-input"
            style={{ ...css.textarea, borderColor: errors.bio ? '#FCA5A5' : '#E6E8F0' }}
          />
          <div style={css.fieldFooter}>
            {errors.bio ? (
              <span style={css.fieldError}>{errors.bio}</span>
            ) : (
              <span style={css.fieldHint}>
                <MdInfo size={12} color="#94A3B8" />
                Visible on your public profile
              </span>
            )}
            <span style={css.charCount}>{bio.length}/200</span>
          </div>
        </label>
      </div>

      {/* Locked contact */}
      <h3 style={css.sectionLabel}>Contact</h3>
      <div style={css.card}>
        <div style={css.lockedRow}>
          <span style={css.lockedLabel}>Phone</span>
          <span style={css.lockedValue}>{phone || '—'}</span>
        </div>
        <div style={css.lockedRow}>
          <span style={css.lockedLabel}>Email</span>
          <span style={css.lockedValue}>{email || '—'}</span>
        </div>
      </div>
      <p style={css.lockedNote}>
        To change your phone or email, go to Settings → Account → Phone & email
      </p>
    </SettingsShell>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  error,
  required,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label style={css.fieldWrap}>
      <span style={css.fieldLabel}>
        {label}
        {required && <span style={css.req}>*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="ep-input"
        style={{
          ...css.input,
          borderColor: error ? '#FCA5A5' : '#E6E8F0',
        }}
      />
      {(error || hint) && (
        <div style={css.fieldFooter}>
          {error ? (
            <span style={css.fieldError}>{error}</span>
          ) : (
            <span style={css.fieldHint}>{hint}</span>
          )}
          {maxLength && (
            <span style={css.charCount}>
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      )}
    </label>
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
  avatarBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0 12px',
  },
  avatarWrap: {
    position: 'relative',
    width: 96,
    height: 96,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#EEF0FF',
    border: '3px solid #E6E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: {
    fontSize: 38,
    fontWeight: 800,
    color: '#0504AA',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'rgba(5,4,170,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLink: {
    background: 'none',
    border: 'none',
    color: '#0504AA',
    fontWeight: 700,
    fontSize: 13.5,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '4px 0 0 4px',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '14px 16px',
    borderBottom: '1px solid #F1F5F9',
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#334155',
    letterSpacing: 0.1,
  },
  req: { color: '#DC2626', marginLeft: 4 },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 500,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 500,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    minHeight: 92,
    lineHeight: 1.5,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  },
  fieldFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldError: { fontSize: 12, color: '#DC2626', fontWeight: 600 },
  fieldHint: {
    fontSize: 12,
    color: '#94A3B8',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  charCount: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontVariantNumeric: 'tabular-nums',
    marginLeft: 'auto',
  },
  lockedRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid #F1F5F9',
  },
  lockedLabel: { fontSize: 14.5, fontWeight: 600, color: '#0B0B1A' },
  lockedValue: { fontSize: 13.5, color: '#64748B' },
  lockedNote: {
    fontSize: 12,
    color: '#94A3B8',
    margin: '0 4px',
    lineHeight: 1.5,
  },
  skeletonAvatar: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    backgroundColor: '#EAECF3',
    margin: '0 auto 16px',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  skeletonLine: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#EAECF3',
    marginBottom: 12,
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};