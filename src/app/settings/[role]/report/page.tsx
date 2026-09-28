'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../components/ui/dialogs';
import { SettingsShell, SettingsSection } from '../../../../components/settings/SettingsUI';
import {
  MdReportProblem,
  MdPhotoCamera,
  MdClose,
  MdSend,
  MdCheckCircle,
  MdAccessTime,
  MdBlock,
} from 'react-icons/md';

const CATEGORIES = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'payment', label: 'Payment or wallet issue' },
  { value: 'order', label: 'Order or delivery issue' },
  { value: 'listing', label: 'Bad or fake listing' },
  { value: 'account', label: 'Account or login issue' },
  { value: 'abuse', label: 'Abuse or harassment' },
  { value: 'other', label: 'Other' },
];

const AREAS = [
  { value: 'home', label: 'Home feed' },
  { value: 'map', label: 'Map' },
  { value: 'seai', label: 'SEAI assistant' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'orders', label: 'Orders' },
  { value: 'chat', label: 'Chat / Inbox' },
  { value: 'profile', label: 'Profile' },
  { value: 'settings', label: 'Settings' },
  { value: 'other', label: 'Other' },
];

interface Report {
  id: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at?: string;
  description?: string;
}

function parseAsUtc(iso?: string | null): number {
  if (!iso) return NaN;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const trimmed = iso.replace(/(\.\d{3})\d+/, '$1');
  return new Date(hasTz ? trimmed : `${trimmed}Z`).getTime();
}

function relative(iso?: string): string {
  const t = parseAsUtc(iso);
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  try {
    return new Date(t).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

export default function ReportProblemPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [category, setCategory] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const res = await api.getMyReports();
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setReports(Array.isArray(res) ? (res as Report[]) : []);
    } catch {
      // Silent — history is optional
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
      router.push(`/settings/${roleSlug}`);
    }
  };

  const pickImage = () => fileInputRef.current?.click();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: 'Image must be under 5 MB' }));
      return;
    }
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(f);
    setErrors((prev) => {
      const { image: _, ...rest } = prev;
      return rest;
    });
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!category) e.category = 'Pick a category';
    if (!area) e.area = 'Pick where it happened';
    if (!description.trim()) e.description = 'Tell us what happened';
    else if (description.trim().length < 10) {
      e.description = 'Please add a bit more detail';
    } else if (description.length > 1000) {
      e.description = 'Max 1000 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.submitReport({
        category,
        area,
        description: description.trim(),
        image: imageFile,
      });
      await alertDialog({
        title: 'Report sent',
        body: 'Our team will review it within 24 hours. You can track it below.',
        kind: 'success',
      });
      // Reset form
      setCategory('');
      setArea('');
      setDescription('');
      clearImage();
      await load();
    } catch (err) {
      await alertDialog({
        title: 'Could not send report',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const openReports = reports.filter(
    (r) => r.status === 'open' || r.status === 'in_progress',
  );

  return (
    <SettingsShell title="Report a problem" onBack={goBack}>
      <style>{`
        .rp-chip:active { transform: scale(0.96); }
        .rp-textarea:focus { border-color: #0504AA; box-shadow: 0 0 0 3px rgba(5,4,170,0.10); }
      `}</style>

      {/* Hero */}
      <div style={css.hero}>
        <div style={css.heroIcon}>
          <MdReportProblem size={30} color="#DC2626" />
        </div>
        <div style={css.heroTitle}>Something went wrong?</div>
        <div style={css.heroSub}>
          Tell us what happened and we&apos;ll look into it. We reply within
          24 hours.
        </div>
      </div>

      {/* Category */}
      <SettingsSection label="1. What kind of problem?">
        {errors.category && (
          <div style={css.inlineError}>{errors.category}</div>
        )}
        <div style={css.chips}>
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                onClick={() => {
                  setCategory(c.value);
                  setErrors((p) => {
                    const { category: _, ...rest } = p;
                    return rest;
                  });
                }}
                className="rp-chip"
                style={{
                  ...css.chip,
                  borderColor: active ? '#0504AA' : '#E6E8F0',
                  backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
                }}
              >
                <span
                  style={{
                    color: active ? '#0504AA' : '#475569',
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Area */}
      <SettingsSection label="2. Where did it happen?">
        {errors.area && <div style={css.inlineError}>{errors.area}</div>}
        <div style={css.chips}>
          {AREAS.map((a) => {
            const active = area === a.value;
            return (
              <button
                key={a.value}
                onClick={() => {
                  setArea(a.value);
                  setErrors((p) => {
                    const { area: _, ...rest } = p;
                    return rest;
                  });
                }}
                className="rp-chip"
                style={{
                  ...css.chip,
                  borderColor: active ? '#0504AA' : '#E6E8F0',
                  backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
                }}
              >
                <span
                  style={{
                    color: active ? '#0504AA' : '#475569',
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Description */}
      <SettingsSection label="3. What happened?">
        <div style={css.textareaWrap}>
          <textarea
            className="rp-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
            placeholder="Describe the problem. Include what you were doing and what you expected."
            rows={6}
            style={{
              ...css.textarea,
              borderColor: errors.description ? '#FCA5A5' : '#E6E8F0',
            }}
          />
          <div style={css.fieldFooter}>
            {errors.description ? (
              <span style={css.fieldError}>{errors.description}</span>
            ) : (
              <span style={css.fieldHint}>
                The more detail you give, the faster we can fix it.
              </span>
            )}
            <span style={css.charCount}>{description.length}/1000</span>
          </div>
        </div>

        {/* Image */}
        <div style={css.imageBlock}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={onFile}
          />
          {imagePreview ? (
            <div style={css.previewWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="" style={css.previewImg} />
              <button
                onClick={clearImage}
                style={css.previewClose}
                aria-label="Remove"
              >
                <MdClose size={16} color="#fff" />
              </button>
            </div>
          ) : (
            <button onClick={pickImage} style={css.addImageBtn}>
              <MdPhotoCamera size={18} color="#0504AA" />
              <span>Add screenshot (optional)</span>
            </button>
          )}
          {errors.image && (
            <span style={{ ...css.fieldError, marginTop: 6 }}>
              {errors.image}
            </span>
          )}
        </div>
      </SettingsSection>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={submitting}
        className="rp-submit"
        style={{ ...css.submitBtn, opacity: submitting ? 0.6 : 1 }}
      >
        <MdSend size={18} color="#fff" />
        <span>{submitting ? 'Sending…' : 'Send report'}</span>
      </button>

      {/* History */}
      {!loading && reports.length > 0 && (
        <SettingsSection
          label={`Your reports (${openReports.length} open)`}
          footer="Reports you've sent recently."
        >
          {reports.slice(0, 10).map((r) => (
            <div key={r.id} style={css.reportRow}>
              <span
                style={{
                  ...css.statusIcon,
                  backgroundColor:
                    r.status === 'resolved'
                      ? '#DCFCE7'
                      : r.status === 'closed'
                        ? '#F1F5F9'
                        : '#FEF3C7',
                }}
              >
                {r.status === 'resolved' ? (
                  <MdCheckCircle size={16} color="#16A34A" />
                ) : r.status === 'closed' ? (
                  <MdBlock size={16} color="#64748B" />
                ) : (
                  <MdAccessTime size={16} color="#92400E" />
                )}
              </span>
              <div style={css.reportBody}>
                <div style={css.reportTop}>
                  <span style={css.reportCat}>
                    {CATEGORIES.find((c) => c.value === r.category)?.label ||
                      r.category}
                  </span>
                  <span
                    style={{
                      ...css.reportStatus,
                      color:
                        r.status === 'resolved'
                          ? '#166534'
                          : r.status === 'closed'
                            ? '#475569'
                            : '#92400E',
                      backgroundColor:
                        r.status === 'resolved'
                          ? '#DCFCE7'
                          : r.status === 'closed'
                            ? '#F1F5F9'
                            : '#FEF3C7',
                    }}
                  >
                    {r.status.replace('_', ' ')}
                  </span>
                </div>
                {r.description && (
                  <div style={css.reportDesc}>{r.description}</div>
                )}
              </div>
              <span style={css.reportTime}>{relative(r.created_at)}</span>
            </div>
          ))}
        </SettingsSection>
      )}

      <p style={css.footnote}>
        For urgent safety issues, please email support@admerce.ng directly.
      </p>
    </SettingsShell>
  );
}

const css: Record<string, React.CSSProperties> = {
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '20px 20px 12px',
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 1.5,
    maxWidth: 320,
  },
  inlineError: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: 600,
    padding: '8px 16px 0',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '12px 16px 16px',
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
    transition: 'border-color 0.15s, background-color 0.15s, transform 0.12s',
  },
  textareaWrap: { padding: '14px 16px 0' },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 500,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.5,
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  fieldFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  fieldError: { fontSize: 12, color: '#DC2626', fontWeight: 600 },
  fieldHint: { fontSize: 12, color: '#94A3B8' },
  charCount: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontVariantNumeric: 'tabular-nums',
    marginLeft: 'auto',
  },
  imageBlock: { padding: '14px 16px 16px' },
  addImageBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px dashed #C7D2FE',
    backgroundColor: '#F8FAFF',
    color: '#0504AA',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    justifyContent: 'center',
  },
  previewWrap: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid #EAECF3',
  },
  previewImg: { width: '100%', height: '100%', objectFit: 'cover' },
  previewClose: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: 16,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 10px 24px rgba(5,4,170,0.24)',
  },
  reportRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid #F1F5F9',
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reportBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  reportTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reportCat: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#0B0B1A',
  },
  reportStatus: {
    padding: '2px 7px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  reportDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  reportTime: {
    fontSize: 11,
    color: '#94A3B8',
    whiteSpace: 'nowrap',
    marginTop: 2,
  },
  footnote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    margin: '4px 4px 0',
    lineHeight: 1.5,
  },
};