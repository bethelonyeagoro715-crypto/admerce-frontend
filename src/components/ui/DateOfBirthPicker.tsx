'use client';

import { useMemo, useState } from 'react';
import { MdCalendarToday, MdErrorOutline } from 'react-icons/md';

interface DateOfBirthPickerProps {
  value: string; // ISO date "YYYY-MM-DD" or ''
  onChange: (iso: string) => void;
  label?: string;
  minAge?: number;
  maxAge?: number;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Styled date-of-birth picker.
 * - Uses the native <input type="date"> under the hood so mobile users get
 *   the familiar platform wheel and desktop users get the platform calendar.
 * - Enforces age bounds: cannot pick a date that would make the user younger
 *   than `minAge` or older than `maxAge`.
 * - Returns ISO "YYYY-MM-DD" strings, always.
 */
export default function DateOfBirthPicker({
  value,
  onChange,
  label = 'Date of birth',
  minAge = 13,
  maxAge = 120,
  disabled = false,
  required = false,
}: DateOfBirthPickerProps) {
  const [focused, setFocused] = useState(false);

  // Compute min/max dates from the age bounds, refreshed once per render.
  const { minDate, maxDate } = useMemo(() => {
    const today = new Date();
    const min = new Date(today);
    min.setFullYear(min.getFullYear() - maxAge); // oldest allowed birthdate
    const max = new Date(today);
    max.setFullYear(max.getFullYear() - minAge); // youngest allowed birthdate
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { minDate: fmt(min), maxDate: fmt(max) };
  }, [minAge, maxAge]);

  // Format the picked ISO date for display in the app's copy style.
  const displayValue = useMemo(() => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return value;
    }
  }, [value]);

  const isMissing = required && !value;

  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: '#5A6178',
        }}
      >
        {label}
        {required ? ' *' : ''}
      </span>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 14,
          border: `1.5px solid ${
            isMissing
              ? '#FCA5A5'
              : focused
                ? '#C7CCFF'
                : '#E6E8F0'
          }`,
          backgroundColor: disabled
            ? '#F6F7FB'
            : focused
              ? '#FFFFFF'
              : '#FAFAFC',
          transition: 'border-color 0.15s, background-color 0.15s',
          boxShadow: focused
            ? '0 0 0 4px rgba(5,4,170,0.08)'
            : 'none',
        }}
      >
        <MdCalendarToday
          size={18}
          color={focused ? '#0504AA' : '#94A3B8'}
          style={{ flexShrink: 0 }}
        />

        {/* When empty, we show the styled placeholder text; the real input
            sits transparent on top and receives the click. */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <input
            type="date"
            value={value}
            min={minDate}
            max={maxDate}
            disabled={disabled}
            required={required}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              fontWeight: 500,
              color: value ? '#0B0B1A' : 'transparent',
              fontFamily: 'inherit',
              padding: 0,
              appearance: 'none',
              WebkitAppearance: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          />
          {!value && (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 15,
                color: '#94A3B8',
                pointerEvents: 'none',
              }}
            >
              Select your date of birth
            </span>
          )}
        </div>
      </div>

      {value && displayValue && (
        <span
          style={{
            fontSize: 12.5,
            color: '#64748B',
            fontWeight: 500,
          }}
        >
          {displayValue}
        </span>
      )}

      {isMissing && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            color: '#B91C1C',
            fontWeight: 600,
          }}
        >
          <MdErrorOutline size={13} />
          This field is required
        </span>
      )}
    </label>
  );
}