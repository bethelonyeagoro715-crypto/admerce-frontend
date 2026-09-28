'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../components/ui/dialogs';
import { SettingsShell, SettingsSection } from '../../../../components/settings/SettingsUI';
import {
  MdStar,
  MdStarBorder,
  MdFeedback,
  MdSend,
  MdFavorite,
  MdLightbulbOutline,
  MdBugReport,
} from 'react-icons/md';

const KINDS = [
  { value: 'praise', label: 'Praise', icon: <MdFavorite size={16} color="#DC2626" />, bg: '#FEE2E2' },
  { value: 'idea', label: 'Idea', icon: <MdLightbulbOutline size={16} color="#D97706" />, bg: '#FEF3C7' },
  { value: 'bug', label: 'Bug', icon: <MdBugReport size={16} color="#7E22CE" />, bg: '#F3E8FF' },
];

export default function FeedbackPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [kind, setKind] = useState<string>('praise');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}`);
    }
  };

  const submit = async () => {
    if (rating === 0) {
      await alertDialog({
        title: 'Pick a rating',
        body: 'Tap the stars to rate your experience.',
        kind: 'info',
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.submitFeedback({
        rating,
        kind,
        comment: comment.trim() || null,
      });
      setSubmitted(true);
    } catch (err) {
      await alertDialog({
        title: 'Could not send feedback',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const reset = () => {
    setRating(0);
    setHover(0);
    setKind('praise');
    setComment('');
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <SettingsShell title="Send feedback" onBack={goBack}>
        <div style={css.thanksWrap}>
          <div style={css.thanksIcon}>
            <MdFavorite size={40} color="#DC2626" />
          </div>
          <h2 style={css.thanksTitle}>Thanks for the feedback</h2>
          <p style={css.thanksBody}>
            We read every message. Your input shapes what we build next.
          </p>
          <button onClick={goBack} style={css.thanksBtn}>
            Back to settings
          </button>
          <button onClick={reset} style={css.thanksLink}>
            Send more feedback
          </button>
        </div>
      </SettingsShell>
    );
  }

  const shown = hover || rating;

  return (
    <SettingsShell title="Send feedback" onBack={goBack}>
      <style>{`
        .fb-chip:active { transform: scale(0.96); }
        .fb-textarea:focus { border-color: #0504AA; box-shadow: 0 0 0 3px rgba(5,4,170,0.10); }
        .fb-star { transition: transform 0.12s; }
        .fb-star:active { transform: scale(0.92); }
      `}</style>

      {/* Hero */}
      <div style={css.hero}>
        <div style={css.heroIcon}>
          <MdFeedback size={30} color="#0504AA" />
        </div>
        <div style={css.heroTitle}>How are we doing?</div>
        <div style={css.heroSub}>
          Tell us what you love, what&apos;s broken, or what we should build
          next.
        </div>
      </div>

      {/* Rating */}
      <SettingsSection
        label="Rate your experience"
        footer={
          shown === 0
            ? 'Tap a star to rate'
            : shown <= 2
              ? "We're sorry to hear that. Tell us what went wrong."
              : shown === 3
                ? 'Thanks for the honest rating.'
                : "That's great — thank you!"
        }
      >
        <div
          style={css.starsRow}
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= shown;
            return (
              <button
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                className="fb-star"
                style={css.starBtn}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
              >
                {filled ? (
                  <MdStar size={38} color="#F59E0B" />
                ) : (
                  <MdStarBorder size={38} color="#CBD5E1" />
                )}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Kind */}
      <SettingsSection label="What kind of feedback?">
        <div style={css.chips}>
          {KINDS.map((k) => {
            const active = kind === k.value;
            return (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                className="fb-chip"
                style={{
                  ...css.chip,
                  borderColor: active ? '#0504AA' : '#E6E8F0',
                  backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
                }}
              >
                <span
                  style={{
                    ...css.chipIcon,
                    backgroundColor: active ? '#FFFFFF' : k.bg,
                  }}
                >
                  {k.icon}
                </span>
                <span
                  style={{
                    color: active ? '#0504AA' : '#475569',
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  {k.label}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Comment */}
      <SettingsSection label="Anything else? (optional)">
        <div style={css.textareaWrap}>
          <textarea
            className="fb-textarea"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 800))}
            placeholder="Tell us more…"
            rows={5}
            style={css.textarea}
          />
          <div style={css.charCount}>{comment.length}/800</div>
        </div>
      </SettingsSection>

      <button
        onClick={submit}
        disabled={submitting || rating === 0}
        style={{
          ...css.submitBtn,
          opacity: submitting || rating === 0 ? 0.5 : 1,
          cursor: submitting || rating === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        <MdSend size={18} color="#fff" />
        <span>{submitting ? 'Sending…' : 'Send feedback'}</span>
      </button>

      <p style={css.footnote}>
        Feedback is anonymized. Your name is not attached unless you mention
        it in the comment.
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
    backgroundColor: '#EEF0FF',
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
  starsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    padding: '16px 16px 20px',
  },
  starBtn: {
    background: 'none',
    border: 'none',
    padding: 4,
    cursor: 'pointer',
    display: 'flex',
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
    gap: 8,
    padding: '8px 14px 8px 8px',
    borderRadius: 999,
    border: '1.5px solid #E6E8F0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    transition: 'border-color 0.15s, background-color 0.15s, transform 0.12s',
  },
  chipIcon: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textareaWrap: { padding: '14px 16px' },
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
  charCount: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
    fontVariantNumeric: 'tabular-nums',
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
    transition: 'opacity 0.15s',
  },
  footnote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    margin: '4px 4px 0',
    lineHeight: 1.5,
  },
  thanksWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '60px 20px 40px',
  },
  thanksIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  thanksTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.4,
  },
  thanksBody: {
    fontSize: 14,
    color: '#64748B',
    margin: '8px 0 24px',
    maxWidth: 300,
    lineHeight: 1.55,
  },
  thanksBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 24px',
    borderRadius: 14,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    border: 'none',
    fontSize: 14.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 10px 24px rgba(5,4,170,0.24)',
  },
  thanksLink: {
    background: 'none',
    border: 'none',
    color: '#0504AA',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 14,
    textDecoration: 'underline',
  },
};