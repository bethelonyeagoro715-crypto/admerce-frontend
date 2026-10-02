'use client';

import { useState } from 'react';
import { MdStar, MdStarBorder, MdClose, MdCheckCircle } from 'react-icons/md';
import api, { extractErrorDetail } from '../services/api';

interface SatisfactionPromptProps {
  bookingId: string;
  serviceName: string;
  providerName: string;
  onDone?: () => void;
  onSkip?: () => void;
}

const STORAGE_PREFIX = 'admerce_rated_booking_';

export function hasRatedBooking(bookingId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + bookingId) === '1';
  } catch {
    return false;
  }
}

function markRated(bookingId: string) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + bookingId, '1');
  } catch {
    /* ignore */
  }
}

export default function SatisfactionPrompt({
  bookingId,
  serviceName,
  providerName,
  onDone,
  onSkip,
}: SatisfactionPromptProps) {
  const [previousBookingId, setPreviousBookingId] = useState(bookingId);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (bookingId !== previousBookingId) {
    setPreviousBookingId(bookingId);
    setRating(0);
    setHover(0);
    setComment('');
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
  }

  const handleSubmit = async () => {
    if (rating < 1) {
      setError('Please choose a rating.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.submitFeedback({
        rating,
        kind: 'service_booking',
        comment: comment.trim()
          ? `[booking:${bookingId}] ${comment.trim()}`
          : `[booking:${bookingId}]`,
      });
      markRated(bookingId);
      setSubmitted(true);
      setTimeout(() => {
        onDone?.();
      }, 900);
    } catch (err) {
      setError(extractErrorDetail(err, 'Could not submit feedback.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    markRated(bookingId);
    onSkip?.();
  };

  const displayRating = hover || rating;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="satp-title"
      style={p.overlay}
      onClick={handleSkip}
    >
      <div style={p.card} onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={p.successIcon}>
              <MdCheckCircle size={36} color="var(--success-fg)" />
            </div>
            <h3 id="satp-title" style={p.title}>
              Thanks for the feedback
            </h3>
            <p style={p.body}>Your rating helps other shoppers choose better.</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSkip}
              style={p.closeBtn}
              aria-label="Dismiss"
            >
              <MdClose size={20} color="var(--text-tertiary)" />
            </button>

            <h3 id="satp-title" style={p.title}>
              Are you satisfied with the service?
            </h3>
            <p style={p.body}>
              <strong>{serviceName}</strong> by <strong>{providerName}</strong>
            </p>

            <div style={p.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  style={p.starBtn}
                  aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                >
                  {n <= displayRating ? (
                    <MdStar size={36} color="#FBBF24" />
                  ) : (
                    <MdStarBorder size={36} color="var(--text-muted)" />
                  )}
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional — tell us more (a few words is fine)"
              rows={3}
              maxLength={500}
              style={p.textarea}
            />

            {error && <div style={p.error}>{error}</div>}

            <div style={p.actions}>
              <button
                type="button"
                onClick={handleSkip}
                style={p.skipBtn}
                disabled={submitting}
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || rating < 1}
                style={{
                  ...p.submitBtn,
                  opacity: submitting || rating < 1 ? 0.6 : 1,
                }}
              >
                {submitting ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const p: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5000,
    padding: 20,
  },
  card: {
    position: 'relative',
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    borderRadius: 20,
    padding: '26px 22px 20px',
    maxWidth: 400,
    width: '100%',
    boxShadow: 'var(--shadow-lg)',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    margin: '0 0 6px',
    letterSpacing: -0.2,
    color: 'var(--text-primary)',
  },
  body: {
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: '0 0 18px',
  },
  starRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
  },
  starBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 2,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid var(--border-default)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: 13.5,
    fontFamily: 'inherit',
    resize: 'vertical',
    marginBottom: 12,
    outline: 'none',
    minHeight: 68,
    boxSizing: 'border-box',
  },
  error: {
    color: 'var(--danger-fg)',
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 10,
  },
  actions: { display: 'flex', gap: 10, marginTop: 6 },
  skipBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: '1px solid var(--border-default)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  submitBtn: {
    flex: 2,
    padding: 13,
    borderRadius: 12,
    border: 'none',
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    backgroundColor: 'var(--success-bg)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
};