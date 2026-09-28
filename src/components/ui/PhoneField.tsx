'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import PhoneInput, {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumber,
  type Country,
} from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';

// ─── Types ──────────────────────────────────────────────────────────
interface PhoneFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  fallbackCountry?: Country;
  onBlur?: () => void;
}

interface CountryOption {
  value: Country | '';
  label: string;
  divider?: boolean;
}

interface CountrySelectProps {
  name?: string;
  value?: Country;
  onChange: (value: Country) => void;
  options: CountryOption[];
  disabled?: boolean;
  className?: string;
  tabIndex?: number;
}

// ─── Locale → country ───────────────────────────────────────────────
function detectCountry(fallback: Country): Country {
  if (typeof navigator === 'undefined') return fallback;
  try {
    const tags = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    for (const tag of tags) {
      if (!tag) continue;
      // Prefer Intl.Locale — returns the region correctly even for
      // edge cases like "zh-Hans-CN".
      try {
        const loc = new Intl.Locale(tag);
        const region = loc.region?.toUpperCase();
        if (region && region.length === 2) {
          const upper = region as Country;
          if (getCountries().includes(upper)) return upper;
        }
      } catch {
        /* fall through to string parsing */
      }
      // Fallback: parse "en-NG" → "NG"
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

// ─── Custom country picker ──────────────────────────────────────────
function CountrySelect({
  value,
  onChange,
  options,
  disabled,
  className,
  tabIndex,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const realOptions = useMemo(
    () =>
      options.filter(
        (o): o is { value: Country; label: string } => !!o.value,
      ),
    [options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return realOptions;
    return realOptions.filter((o) => {
      const dial = `+${getCountryCallingCode(o.value)}`;
      return (
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        dial.includes(q)
      );
    });
  }, [realOptions, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${highlighted}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const choose = (c: Country) => {
    onChange(c);
    setOpen(false);
  };

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }

    setQuery('');
    const idx = realOptions.findIndex((o) => o.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[highlighted];
      if (pick) choose(pick.value);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const SelectedFlag = value ? flags[value] : null;
  const dialCode = value ? getCountryCallingCode(value) : '';

  return (
    <div className={`adp-country ${className ?? ''}`} ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        className="adp-countryBtn"
        onClick={() => !disabled && toggleOpen()}
        disabled={disabled}
        tabIndex={tabIndex}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Select country${value ? `, currently ${value}` : ''}`}
      >
        <span className="adp-flag" aria-hidden>
          {SelectedFlag ? <SelectedFlag title={`Flag of ${value}`} /> : null}
        </span>
        <span className="adp-dial">+{dialCode}</span>
        <span className="adp-chev" aria-hidden />
      </button>

      {open && (
        <div className="adp-popover" role="dialog" aria-label="Country picker">
          <div className="adp-searchWrap">
            <input
              ref={searchRef}
              type="text"
              className="adp-search"
              placeholder="Search country or code"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              onKeyDown={onKeyDown}
              aria-label="Search countries"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <ul className="adp-list" ref={listRef} role="listbox">
            {filtered.length === 0 && (
              <li className="adp-empty">No matches</li>
            )}
            {filtered.map((o, idx) => {
              const FlagComp = flags[o.value];
              const isHi = idx === highlighted;
              const isSel = o.value === value;
              return (
                <li
                  key={o.value}
                  data-idx={idx}
                  role="option"
                  aria-selected={isSel}
                  className={
                    'adp-option' +
                    (isHi ? ' adp-optionHi' : '') +
                    (isSel ? ' adp-optionSel' : '')
                  }
                  onMouseEnter={() => setHighlighted(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o.value)}
                >
                  <span className="adp-optionFlag" aria-hidden>
                    {FlagComp ? <FlagComp title={`Flag of ${o.value}`} /> : null}
                  </span>
                  <span className="adp-optionName">{o.label}</span>
                  <span className="adp-optionDial">
                    +{getCountryCallingCode(o.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
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
  const [defaultCountry, setDefaultCountry] = useState<Country>(() =>
    detectCountry(fallbackCountry),
  );

  // When the user types or pastes a full international number,
  // react-phone-number-input updates `value` to E.164. If the parsed
  // country differs from what we're displaying, adopt the parsed one
  // so the flag matches the actual number.
  const handleChange = (next: string | undefined) => {
    const e164 = next ?? '';
    if (e164) {
      try {
        const parsed = parsePhoneNumber(e164);
        if (parsed?.country && parsed.country !== defaultCountry) {
          // Only switch if the parsed number is a valid one for that
          // country — avoids switching on partial input.
          if (parsed.isValid()) {
            setDefaultCountry(parsed.country);
          }
        }
      } catch {
        /* ignore */
      }
    }
    onChange(e164);
  };

  const memoFallback = useMemo(
    () => (value ? undefined : defaultCountry),
    [value, defaultCountry],
  );

  return (
    <div className="adp-phoneWrap" data-disabled={disabled || undefined}>
      <PhoneInput
        id={id}
        // ← The key change. Without this, the input shows
        //   "+234 802 224 0079" even though the country button
        //   already shows "+234". With it removed, the input shows
        //   only the national part: "802 224 0079".
        countryCallingCodeEditable={false}
        defaultCountry={memoFallback}
        value={value || undefined}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onBlur={onBlur}
        countrySelectComponent={CountrySelect}
        className="adp-phoneInput"
        smartCaret
      />
      <style>{PHONE_CSS}</style>
    </div>
  );
}

// ─── CSS ────────────────────────────────────────────────────────────
const PHONE_CSS = `
  .adp-phoneWrap { width: 100%; }

  .adp-phoneInput.PhoneInput {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 3px 6px 3px 3px;
    border-radius: 14px;
    border: 1.5px solid #E6E8F0;
    background: #FFFFFF;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    font-family: inherit;
    min-height: 52px;
    position: relative;
  }
  .adp-phoneInput.PhoneInput:hover:not(.PhoneInput--disabled) {
    border-color: #CBD5E1;
  }
  .adp-phoneInput.PhoneInput--focus,
  .adp-phoneInput.PhoneInput:focus-within {
    border-color: #0504AA;
    box-shadow: 0 0 0 4px rgba(5,4,170,0.10);
  }
  .adp-phoneInput.PhoneInput--disabled {
    background: #F8FAFC;
    cursor: not-allowed;
  }

  /* ── Country trigger ──────────────────────────────────────── */
  .adp-country {
    position: relative;
    flex-shrink: 0;
  }
  .adp-countryBtn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 44px;
    padding: 0 10px;
    border: none;
    background: transparent;
    border-radius: 10px;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s;
    color: #0B0B1A;
  }
  .adp-countryBtn:hover:not(:disabled) { background: #F1F5F9; }
  .adp-countryBtn:focus-visible {
    outline: 2px solid #0504AA;
    outline-offset: 2px;
  }
  .adp-countryBtn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .adp-flag {
    display: inline-flex;
    width: 22px;
    height: 16px;
    border-radius: 3px;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(15,23,42,0.08);
    flex-shrink: 0;
    background: #F1F5F9;
  }
  .adp-flag svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .adp-dial {
    font-size: 14.5px;
    font-weight: 700;
    color: #0B0B1A;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
  }

  .adp-chev {
    width: 0;
    height: 0;
    border-left: 3.5px solid transparent;
    border-right: 3.5px solid transparent;
    border-top: 3.5px solid #94A3B8;
    transition: transform 0.15s;
    flex-shrink: 0;
  }
  .adp-countryBtn[aria-expanded="true"] .adp-chev {
    transform: rotate(180deg);
  }

  /* ── Popover ──────────────────────────────────────────────── */
  .adp-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 50;
    width: 300px;
    max-width: 82vw;
    background: #FFFFFF;
    border: 1px solid #E6E8F0;
    border-radius: 16px;
    box-shadow:
      0 4px 8px rgba(15,23,42,0.04),
      0 16px 40px rgba(15,23,42,0.14);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: adpPop 0.14s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes adpPop {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .adp-searchWrap {
    padding: 10px 10px 8px;
    border-bottom: 1px solid #F1F5F9;
    background: #FFFFFF;
  }
  .adp-search {
    width: 100%;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1.5px solid #E6E8F0;
    background: #F8FAFC;
    font-size: 13.5px;
    font-family: inherit;
    color: #0B0B1A;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .adp-search::placeholder { color: #94A3B8; }
  .adp-search:focus {
    border-color: #0504AA;
    background: #FFFFFF;
    box-shadow: 0 0 0 3px rgba(5,4,170,0.10);
  }

  .adp-list {
    list-style: none;
    margin: 0;
    padding: 6px;
    max-height: 288px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #CBD5E1 transparent;
  }
  .adp-list::-webkit-scrollbar { width: 8px; }
  .adp-list::-webkit-scrollbar-thumb {
    background: #E2E8F0;
    border-radius: 999px;
  }
  .adp-list::-webkit-scrollbar-track { background: transparent; }

  .adp-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.1s;
    font-size: 13.5px;
  }
  .adp-optionHi { background: #F4F5FB; }
  .adp-optionSel { background: #EEF0FF; }
  .adp-optionSel .adp-optionName {
    color: #0504AA;
    font-weight: 800;
  }

  .adp-optionFlag {
    display: inline-flex;
    width: 22px;
    height: 16px;
    border-radius: 3px;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(15,23,42,0.08);
    flex-shrink: 0;
    background: #F1F5F9;
  }
  .adp-optionFlag svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .adp-optionName {
    flex: 1;
    min-width: 0;
    color: #0B0B1A;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .adp-optionDial {
    color: #94A3B8;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-size: 12.5px;
    flex-shrink: 0;
  }
  .adp-optionSel .adp-optionDial { color: #0504AA; }

  .adp-empty {
    padding: 22px 12px;
    text-align: center;
    color: #94A3B8;
    font-size: 13px;
    list-style: none;
  }

  /* ── Number input ─────────────────────────────────────────── */
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
  .adp-phoneInput .PhoneInputInput::placeholder { color: #94A3B8; }
  .adp-phoneInput .PhoneInputInput:disabled {
    color: #94A3B8;
    cursor: not-allowed;
  }
  .adp-phoneInput .PhoneInputInput::-webkit-outer-spin-button,
  .adp-phoneInput .PhoneInputInput::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Kill the library's default country styling */
  .adp-phoneInput .PhoneInputCountry { display: none !important; }

  @media (prefers-reduced-motion: reduce) {
    .adp-popover { animation: none !important; }
  }
`;