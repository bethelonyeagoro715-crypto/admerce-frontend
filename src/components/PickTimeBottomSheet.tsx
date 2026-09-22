'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdAccessTime,
  MdSchedule,
  MdEvent,
  MdClose,
  MdFlashOn,
  MdWbTwilight,
  MdLightMode,
  MdCalendarToday,
  MdCheck,
} from 'react-icons/md';

export type PickTimeMode = 'pickup' | 'service';

interface PickTimeBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
  mode?: PickTimeMode;
}

interface PickTimeOption {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

/* ─── Datetime helpers ─────────────────────────────────────── */
// Local YYYY-MM-DDTHH:MM — the format <input type="datetime-local"> uses.
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// Local YYYY-MM-DDTHH:MM:SS — what the backend stores.
// Deliberately NOT UTC — the backend uses naive datetime and the frontend
// reads it back as local, so keeping it local avoids a timezone drift.
function localInputToBackend(local: string): string {
  if (!local) return '';
  return local.length === 16 ? `${local}:00` : local;
}

/* ─── Pickup mode presets (unchanged) ──────────────────────── */
function buildPickupOptions(): PickTimeOption[] {
  return [
    {
      label: 'Now - 3 hours',
      value: '3 hours',
      description: 'Pick up within the next 3 hours',
      icon: <MdAccessTime size={22} />,
      color: '#0504AA',
    },
    {
      label: 'Now - 6 hours',
      value: '6 hours',
      description: 'Pick up within the next 6 hours',
      icon: <MdSchedule size={22} />,
      color: '#F59E0B',
    },
    {
      label: 'Now - 9 hours',
      value: '9 hours',
      description: 'Pick up within the next 9 hours',
      icon: <MdSchedule size={22} />,
      color: '#10B981',
    },
    {
      label: 'Tomorrow',
      value: 'Tomorrow',
      description: 'Pick up anytime tomorrow',
      icon: <MdEvent size={22} />,
      color: '#ad04e1',
    },
  ];
}

/* ─── Service mode quick-pick shortcuts ────────────────────── */
// These just FILL the datetime input. The user can then adjust it or tap
// Confirm. Not the only way to book — any clock time is reachable.
function buildServiceQuickPicks(): {
  label: string;
  date: Date;
  icon: React.ReactNode;
  color: string;
}[] {
  const now = new Date();

  const asap = new Date(now.getTime() + 60 * 60 * 1000); // now + 1h

  const sixPm = new Date(now);
  sixPm.setHours(18, 0, 0, 0);

  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  const picks = [
    {
      label: 'ASAP',
      date: asap,
      icon: <MdFlashOn size={16} />,
      color: '#0504AA',
    },
  ];

  // Only offer "today 6 PM" if it's still at least 2 hours away
  if (sixPm.getTime() - now.getTime() >= 2 * 60 * 60 * 1000) {
    picks.push({
      label: 'Today 6 PM',
      date: sixPm,
      icon: <MdWbTwilight size={16} />,
      color: '#F59E0B',
    });
  }

  picks.push({
    label: 'Tomorrow 9 AM',
    date: tomorrowMorning,
    icon: <MdLightMode size={16} />,
    color: '#10B981',
  });

  return picks;
}

/* ─── Component ────────────────────────────────────────────── */
export default function PickTimeBottomSheet({
  isOpen,
  onClose,
  onSelect,
  mode = 'pickup',
}: PickTimeBottomSheetProps) {
  const [customDateTime, setCustomDateTime] = useState('');

  // Bounds for the picker: no earlier than 1 hour from now, no later than
  // 30 days out. Recomputed each time the sheet opens.
  const { minDateTime, maxDateTime, quickPicks } = useMemo(() => {
    const min = new Date(Date.now() + 60 * 60 * 1000);
    const max = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return {
      minDateTime: toLocalInputValue(min),
      maxDateTime: toLocalInputValue(max),
      quickPicks: buildServiceQuickPicks(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reset the picked time each time the sheet opens
  useEffect(() => {
    if (isOpen) {
      setCustomDateTime('');
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  const heading = mode === 'service' ? 'Book a Time' : 'Select Pickup Time';
  const subtext =
    mode === 'service'
      ? 'Pick any date and time, up to 30 days ahead'
      : 'Choose when you\u2019ll pick up your item';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 999,
            }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={heading}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              width: '91%',
              margin: '0 auto',
              backgroundColor: '#FFFFFF',
              borderRadius: '24px 24px 0 0',
              padding: 'calc(12px + env(safe-area-inset-bottom)) 20px 32px',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
              zIndex: 1000,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width: '40px',
                height: '5px',
                backgroundColor: '#E5E7EB',
                borderRadius: '3px',
                margin: '0 auto 16px',
              }}
            />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <h2
                style={{
                  fontSize: 'clamp(18px, 5vw, 22px)',
                  fontWeight: 800,
                  color: '#1A1A1A',
                  margin: 0,
                }}
              >
                {heading}
              </h2>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '12px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 48,
                  minHeight: 48,
                }}
                aria-label="Close"
              >
                <MdClose size={24} color="#6B7280" />
              </button>
            </div>

            <p
              style={{
                fontSize: 'clamp(13px, 3.5vw, 15px)',
                color: '#6B7280',
                marginBottom: '16px',
              }}
            >
              {subtext}
            </p>

            {/* ─── PICKUP MODE — presets only (unchanged) ─────── */}
            {mode === 'pickup' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {buildPickupOptions().map((option) => (
                  <motion.button
                    key={option.label}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelect(option.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px',
                      backgroundColor: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      minHeight: 56,
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        backgroundColor: `${option.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: option.color,
                        flexShrink: 0,
                      }}
                    >
                      {option.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 'clamp(15px, 4vw, 17px)',
                          fontWeight: 700,
                          color: '#1A1A1A',
                        }}
                      >
                        {option.label}
                      </div>
                      <div
                        style={{
                          fontSize: 'clamp(12px, 3vw, 14px)',
                          color: '#6B7280',
                          marginTop: '2px',
                        }}
                      >
                        {option.description}
                      </div>
                    </div>
                    <span style={{ color: '#6B7280', fontSize: '20px' }}>›</span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* ─── SERVICE MODE — quick chips + real datetime picker ─── */}
            {mode === 'service' && (
              <>
                {/* Quick chips — tap to prefill the input */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    overflowX: 'auto',
                    paddingBottom: 4,
                    marginBottom: 16,
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                  }}
                >
                  {quickPicks.map((pick) => (
                    <button
                      key={pick.label}
                      type="button"
                      onClick={() =>
                        setCustomDateTime(toLocalInputValue(pick.date))
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 20,
                        border: '1px solid #E5E7EB',
                        backgroundColor: '#F9FAFB',
                        color: '#374151',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ color: pick.color, display: 'flex' }}>
                        {pick.icon}
                      </span>
                      {pick.label}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: '#E5E7EB',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: '#9CA3AF',
                      fontWeight: 600,
                      letterSpacing: 0.5,
                    }}
                  >
                    OR PICK A SPECIFIC TIME
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: '#E5E7EB',
                    }}
                  />
                </div>

                {/* Datetime input */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: `1.5px solid ${
                      customDateTime ? '#0504AA' : '#E5E7EB'
                    }`,
                    backgroundColor: customDateTime ? '#F5F4FF' : '#fff',
                    marginBottom: 20,
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                >
                  <MdCalendarToday
                    size={22}
                    color={customDateTime ? '#0504AA' : '#9CA3AF'}
                    style={{ flexShrink: 0 }}
                  />
                  <input
                    type="datetime-local"
                    value={customDateTime}
                    min={minDateTime}
                    max={maxDateTime}
                    onChange={(e) => setCustomDateTime(e.target.value)}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: 16,
                      fontWeight: 600,
                      color: '#1A1A1A',
                      fontFamily: 'inherit',
                      minWidth: 0,
                    }}
                  />
                </label>

                {/* Confirm button */}
                <button
                  type="button"
                  onClick={() => {
                    if (!customDateTime) return;
                    onSelect(localInputToBackend(customDateTime));
                  }}
                  disabled={!customDateTime}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: 14,
                    border: 'none',
                    backgroundColor: customDateTime ? '#0504AA' : '#E5E7EB',
                    color: customDateTime ? '#fff' : '#9CA3AF',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: customDateTime ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'background-color 0.2s, color 0.2s',
                  }}
                >
                  <MdCheck size={20} />
                  Confirm Booking
                </button>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}