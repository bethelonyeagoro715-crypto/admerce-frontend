'use client';

import { useMemo } from 'react';
import PhoneInput, {
  getCountries,
  getCountryCallingCode,
  type Country,
} from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';

// ─── Types ──────────────────────────────────────────────────────────
interface PhoneFieldProps {
  id: string;
  value: string; // E.164, e.g. "+2348022240079", or "" when empty
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Fallback region when browser locale can't be resolved. */
  fallbackCountry?: Country;
  onBlur?: () => void;
}

// ─── Country detection ──────────────────────────────────────────────
function detectCountry(fallback: Country): Country {
  if (typeof navigator === 'undefined') return fallback;
  try {
    // navigator.languages is ordered by user preference; try each.
    const tags = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    for (const tag of tags) {
      if (!tag) continue;
      // "en-NG" → "NG"; "pt-BR" → "BR"
      const parts = tag.split('-');
      const region = parts.length > 1 ? parts[parts.length - 1] : null;
      if (region && region.length === 2) {
        const upper = region.toUpperCase() as Country;
        if (getCountries().includes(upper)) return upper;
      }
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

// ─── Component ──────────────────────────────────────────────────────
export default function PhoneField({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'Phone number',
  autoFocus = false,
  fallbackCountry = 'NG',
  onBlur,
}: PhoneFieldProps) {
  // Resolve the browser region without effect-driven state updates.
  const defaultCountry = useMemo(
    () => detectCountry(fallbackCountry),
    [fallbackCountry],
  );

  // react-phone-number-input's onChange gives `undefined` when the input
  // is cleared. Normalize so the parent always gets a string.
  const handleChange = (next: string | undefined) => {
    onChange(next ?? '');
  };

  const memoFallback = useMemo(
    () => (value ? undefined : defaultCountry),
    [value, defaultCountry],
  );

  return (
    <div className="adp-phoneWrap" data-disabled={disabled || undefined}>
      <PhoneInput
        id={id}
        international
        countryCallingCodeEditable={false}
        defaultCountry={memoFallback}
        value={value || undefined}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onBlur={onBlur}
        flags={flags}
        className="adp-phoneInput"
        // The library defaults its <input> type to "tel" and inputMode
        // to "tel" — no override needed. Country select gets a11y labels
        // from the library itself.
      />
      <style>{PHONE_CSS}</style>
    </div>
  );
}

// ─── Styling overrides ──────────────────────────────────────────────
// Re-skins `react-phone-number-input`'s default class names to match
// Admerce's design language. Everything is scoped under .adp- so it
// can't leak into other components.
const PHONE_CSS = `
  .adp-phoneWrap {
    width: 100%;
  }

  /* Root wrapper — matches .su-input dimensions exactly. */
  .adp-phoneInput.PhoneInput {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 4px 6px 4px 8px;
    border-radius: 14px;
    border: 1.5px solid #E6E8F0;
    background: #FFFFFF;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    font-family: inherit;
    min-height: 52px;
  }
  .adp-phoneInput.PhoneInput:hover:not(.PhoneInput--disabled) {
    border-color: #CBD5E1;
  }
  .adp-phoneInput.PhoneInput--focus {
    border-color: #0504AA;
    box-shadow: 0 0 0 4px rgba(5,4,170,0.10);
  }
  .adp-phoneInput.PhoneInput--disabled {
    background: #F8FAFC;
    cursor: not-allowed;
  }

  /* Country button (flag + dial code + chevron) */
  .adp-phoneInput .PhoneInputCountry {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
    flex-shrink: 0;
  }
  .adp-phoneInput .PhoneInputCountry:hover {
    background: #F1F5F9;
  }
  .adp-phoneInput .PhoneInputCountrySelect {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    font-size: 100px; /* iOS Safari quirk: <select> needs non-zero size */
  }
  .adp-phoneInput .PhoneInputCountrySelect:disabled {
    cursor: not-allowed;
  }

  /* Flag icon */
  .adp-phoneInput .PhoneInputCountryIcon {
    width: 22px;
    height: 16px;
    border-radius: 3px;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(15,23,42,0.06);
    flex-shrink: 0;
  }
  .adp-phoneInput .PhoneInputCountryIcon--border {
    box-shadow: 0 0 0 1px rgba(15,23,42,0.06);
  }
  .adp-phoneInput .PhoneInputCountryIconImg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Dial code (e.g. "+234") */
  .adp-phoneInput .PhoneInputCountrySelectArrow {
    width: 6px;
    height: 6px;
    margin-left: 2px;
    border-style: solid;
    border-color: #64748B;
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg);
    opacity: 0.85;
    flex-shrink: 0;
  }

  /* The actual number input */
  .adp-phoneInput .PhoneInputInput {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 15.5px;
    color: #0B0B1A;
    font-family: inherit;
    padding: 12px 10px 12px 4px;
    -webkit-appearance: none;
    appearance: none;
  }
  .adp-phoneInput .PhoneInputInput::placeholder {
    color: #94A3B8;
  }
  .adp-phoneInput .PhoneInputInput:disabled {
    color: #94A3B8;
    cursor: not-allowed;
  }

  /* Remove the browser's default tel-number spinners */
  .adp-phoneInput .PhoneInputInput::-webkit-outer-spin-button,
  .adp-phoneInput .PhoneInputInput::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Hide the library's own dial-code <span> when a flag is present —
     react-phone-number-input renders "+234" via the select's text.
     Keeping it visible; if you ever want to hide it, remove the rule below. */
  .adp-phoneInput .PhoneInputCountrySelect option {
    color: #0B0B1A;
  }
`;