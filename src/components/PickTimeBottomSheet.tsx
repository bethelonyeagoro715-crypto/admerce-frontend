'use client';

import { useEffect } from 'react';
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

// ─── Pickup mode (item reservations) ─────────────────────────────
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

// ─── Service mode (service bookings) ─────────────────────────────
// ✅ Returns ISO datetime strings (`YYYY-MM-DDTHH:MM:SS`) — matches
//    what the backend expects in `scheduled_for`.
function buildServiceOptions(): PickTimeOption[] {
  const now = new Date();

  const asap = new Date(now.getTime() + 60 * 60 * 1000); // now + 1h

  const laterToday = new Date(now);
  laterToday.setHours(18, 0, 0, 0);
  if (laterToday <= now) {
    laterToday.setDate(laterToday.getDate() + 1);
    laterToday.setHours(10, 0, 0, 0);
  }

  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  const tomorrowAfternoon = new Date(now);
  tomorrowAfternoon.setDate(tomorrowAfternoon.getDate() + 1);
  tomorrowAfternoon.setHours(14, 0, 0, 0);

  const iso = (d: Date) => d.toISOString().slice(0, 19);

  return [
    {
      label: 'As soon as possible',
      value: iso(asap),
      description: 'Provider comes within the next hour',
      icon: <MdFlashOn size={22} />,
      color: '#0504AA',
    },
    {
      label: 'Later today',
      value: iso(laterToday),
      description: laterToday.getHours() < 12
        ? 'Tomorrow at 10:00 AM'
        : 'Today at 6:00 PM',
      icon: <MdWbTwilight size={22} />,
      color: '#F59E0B',
    },
    {
      label: 'Tomorrow morning',
      value: iso(tomorrowMorning),
      description: 'Tomorrow at 9:00 AM',
      icon: <MdLightMode size={22} />,
      color: '#10B981',
    },
    {
      label: 'Tomorrow afternoon',
      value: iso(tomorrowAfternoon),
      description: 'Tomorrow at 2:00 PM',
      icon: <MdEvent size={22} />,
      color: '#ad04e1',
    },
  ];
}

export default function PickTimeBottomSheet({
  isOpen,
  onClose,
  onSelect,
  mode = 'pickup',
}: PickTimeBottomSheetProps) {
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

  const options =
    mode === 'service' ? buildServiceOptions() : buildPickupOptions();

  const heading = mode === 'service' ? 'Book a Time' : 'Select Pickup Time';
  const subtext =
    mode === 'service'
      ? 'Choose when you want the service'
      : 'Choose when you\u2019ll pick up your item';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
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

          {/* Bottom Sheet */}
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

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {options.map((option) => (
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
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}