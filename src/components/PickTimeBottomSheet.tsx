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

export function pickupValueToHours(
  value: string | null | undefined,
): number {
  if (!value) return 3;
  const lower = String(value).toLowerCase().trim();

  if (lower === 'tomorrow') {
    const now = new Date();
    const endOfTomorrow = new Date(now);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    endOfTomorrow.setHours(23, 59, 0, 0);
    const hours = Math.ceil(
      (endOfTomorrow.getTime() - now.getTime()) / 3_600_000,
    );
    return Math.max(1, Math.min(168, hours));
  }

  const match = lower.match(/(\d+)/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 168) return n;
  }

  return 3;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToBackend(local: string): string {
  if (!local) return '';
  return local.length === 16 ? `${local}:00` : local;
}

function buildPickupOptions(): PickTimeOption[] {
  return [
    {
      label: 'Now - 3 hours',
      value: '3 hours',
      description: 'Pick up within the next 3 hours',
      icon: <MdAccessTime size={22} />,
      color: 'var(--brand-primary)',
    },
    {
      label: 'Now - 6 hours',
      value: '6 hours',
      description: 'Pick up within the next 6 hours',
      icon: <MdSchedule size={22} />,
      color: 'var(--warning-fg)',
    },
    {
      label: 'Now - 9 hours',
      value: '9 hours',
      description: 'Pick up within the next 9 hours',
      icon: <MdSchedule size={22} />,
      color: 'var(--success-fg)',
    },
    {
      label: 'Tomorrow',
      value: 'Tomorrow',
      description: 'Pick up anytime tomorrow',
      icon: <MdEvent size={22} />,
      color: 'var(--purple-fg)',
    },
  ];
}

function buildServiceQuickPicks(now: Date): {
  label: string;
  date: Date;
  icon: React.ReactNode;
  color: string;
}[] {
  const asap = new Date(now.getTime() + 60 * 60 * 1000);

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
      color: 'var(--brand-primary)',
    },
  ];

  if (sixPm.getTime() - now.getTime() >= 2 * 60 * 60 * 1000) {
    picks.push({
      label: 'Today 6 PM',
      date: sixPm,
      icon: <MdWbTwilight size={16} />,
      color: 'var(--warning-fg)',
    });
  }

  picks.push({
    label: 'Tomorrow 9 AM',
    date: tomorrowMorning,
    icon: <MdLightMode size={16} />,
    color: 'var(--success-fg)',
  });

  return picks;
}

export default function PickTimeBottomSheet({
  isOpen,
  onClose,
  onSelect,
  mode = 'pickup',
}: PickTimeBottomSheetProps) {
  const [customDateTime, setCustomDateTime] = useState('');
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  const { minDateTime, maxDateTime, quickPicks } = useMemo(() => {
    if (openedAt === null) {
      return { minDateTime: '', maxDateTime: '', quickPicks: [] };
    }

    const now = new Date(openedAt);
    const min = new Date(openedAt + 60 * 60 * 1000);
    const max = new Date(openedAt + 30 * 24 * 60 * 60 * 1000);
    return {
      minDateTime: toLocalInputValue(min),
      maxDateTime: toLocalInputValue(max),
      quickPicks: buildServiceQuickPicks(now),
    };
  }, [openedAt]);

  useEffect(() => {
    if (!isOpen) return;

    const resetId = window.setTimeout(() => {
      setOpenedAt(Date.now());
      setCustomDateTime('');
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [isOpen]);

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

  const heading =
    mode === 'service' ? 'Book a Time' : 'Select Pickup Time';
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
              backgroundColor: 'var(--overlay)',
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
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              borderRadius: '24px 24px 0 0',
              padding:
                'calc(12px + env(safe-area-inset-bottom)) 20px 32px',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 1000,
              maxHeight: '90vh',
              overflowY: 'auto',
              transition: 'background-color 0.18s ease, color 0.18s ease',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '5px',
                backgroundColor: 'var(--border-default)',
                borderRadius: '3px',
                margin: '0 auto 16px',
              }}
            />

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
                  color: 'var(--text-primary)',
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
                <MdClose size={24} color="var(--text-tertiary)" />
              </button>
            </div>

            <p
              style={{
                fontSize: 'clamp(13px, 3.5vw, 15px)',
                color: 'var(--text-tertiary)',
                marginBottom: '16px',
              }}
            >
              {subtext}
            </p>

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
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      minHeight: 56,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        backgroundColor: `color-mix(in srgb, ${option.color} 15%, transparent)`,
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
                          color: 'var(--text-primary)',
                        }}
                      >
                        {option.label}
                      </div>
                      <div
                        style={{
                          fontSize: 'clamp(12px, 3vw, 14px)',
                          color: 'var(--text-tertiary)',
                          marginTop: '2px',
                        }}
                      >
                        {option.description}
                      </div>
                    </div>
                    <span
                      style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '20px',
                      }}
                    >
                      ›
                    </span>
                  </motion.button>
                ))}
              </div>
            )}

            {mode === 'service' && (
              <>
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
                        setCustomDateTime(
                          toLocalInputValue(pick.date),
                        )
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 20,
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          color: pick.color,
                          display: 'flex',
                        }}
                      >
                        {pick.icon}
                      </span>
                      {pick.label}
                    </button>
                  ))}
                </div>

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
                      backgroundColor: 'var(--border-default)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
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
                      backgroundColor: 'var(--border-default)',
                    }}
                  />
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: `1.5px solid ${
                      customDateTime
                        ? 'var(--brand-primary)'
                        : 'var(--border-default)'
                    }`,
                    backgroundColor: customDateTime
                      ? 'var(--brand-soft)'
                      : 'var(--bg-tertiary)',
                    marginBottom: 20,
                    transition:
                      'border-color 0.2s, background-color 0.2s',
                  }}
                >
                  <MdCalendarToday
                    size={22}
                    color={
                      customDateTime
                        ? 'var(--brand-primary)'
                        : 'var(--text-muted)'
                    }
                    style={{ flexShrink: 0 }}
                  />
                  <input
                    type="datetime-local"
                    value={customDateTime}
                    min={minDateTime}
                    max={maxDateTime}
                    onChange={(e) =>
                      setCustomDateTime(e.target.value)
                    }
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: 16,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      minWidth: 0,
                    }}
                  />
                </label>

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
                    background: customDateTime
                      ? 'var(--brand-gradient)'
                      : 'var(--bg-tertiary)',
                    color: customDateTime
                      ? 'var(--brand-on-gradient)'
                      : 'var(--text-muted)',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: customDateTime
                      ? 'pointer'
                      : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition:
                      'background-color 0.2s, color 0.2s',
                    fontFamily: 'inherit',
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