'use client';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import {
  AsYouType,
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  type CountryCode as Country,
} from 'libphonenumber-js';

// ─── Types ──────────────────────────────────────────────────────────
interface PhoneFieldProps {
  id: string;
  value?: string; // E.164 or ''
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  fallbackCountry?: Country;
  onBlur?: () => void;
}

// ─── Config ─────────────────────────────────────────────────────────
// Countries whose national trunk prefix ("0") we hide in the input.
// The dial code is already shown in the country button.
const STRIP_TRUNK_PREFIX: Set<Country> = new Set(['NG']);

// 3-digit prefixes that unambiguously identify a country.
// Nigeria: 070 / 080 / 081 / 090 / 091 are mobile prefixes.
const PREFIX_HINTS: Array<{ prefix: string; country: Country }> = [
  { prefix: '070', country: 'NG' },
  { prefix: '080', country: 'NG' },
  { prefix: '081', country: 'NG' },
  { prefix: '090', country: 'NG' },
  { prefix: '091', country: 'NG' },
];

// ─── Helpers ────────────────────────────────────────────────────────
function detectLocaleCountry(fallback: Country): Country {
  if (typeof navigator === 'undefined') return fallback;
  try {
    const tags = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    for (const tag of tags) {
      if (!tag) continue;
      const parts = tag.split('-');
      const region = parts.length > 1 ? parts[parts.length - 1] : null;
      if (region && region.length === 2) {
        const upper = region.toUpperCase() as Country;
        if (getCountries().includes(upper)) return upper;
      }
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function guessCountryFromDigits(digits: string): Country | null {
  if (digits.length < 3) return null;
  const head = digits.slice(0, 3);
  const hit = PREFIX_HINTS.find((h) => h.prefix === head);
  return hit ? hit.country : null;
}

function formatForDisplay(digits: string, c: Country): string {
  if (!digits) return '';
  const formatted = new AsYouType(c).input(digits);
  if (STRIP_TRUNK_PREFIX.has(c) && formatted.startsWith('0')) {
    return formatted.slice(1).replace(/^\s+/, '');
  }
  return formatted;
}

function buildE164(digits: string, c: Country): string {
  if (!digits) return '';
  return `+${getCountryCallingCode(c)}${digits}`;
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
  const [country, setCountry] = useState<Country>(() =>
    detectLocaleCountry(fallbackCountry),
  );
  // Subscriber digits WITHOUT the trunk prefix. This is the source of
  // truth for what the user has entered.
  const [digits, setDigits] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const lastEmittedRef = useRef<string>('');

  // Adopt parent's value if it changes externally (e.g. loaded profile).
  useEffect(() => {
    const incoming = value ?? '';
    if (incoming === lastEmittedRef.current) return;
    let cancelled = false;

    if (!incoming) {
      queueMicrotask(() => {
        if (!cancelled) setDigits('');
      });
      return () => {
        cancelled = true;
      };
    }
    const parsed = parsePhoneNumberFromString(incoming);
    if (parsed?.country) {
      const parsedCountry = parsed.country;
      queueMicrotask(() => {
        if (cancelled) return;
        setCountry(parsedCountry);
        setDigits(parsed.nationalNumber);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [value]);

  const display = useMemo(
    () => formatForDisplay(digits, country),
    [digits, country],
  );

  // Handle typing.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Pasted/typed international format (leading +)
    if (raw.trim().startsWith('+')) {
      const parsed = parsePhoneNumberFromString(raw.trim());
      if (parsed?.country) {
        setCountry(parsed.country);
        setDigits(parsed.nationalNumber);
        const e164 = parsed.number;
        lastEmittedRef.current = e164;
        onChange(e164);
        return;
      }
    }

    // National format — extract digits only
    let next = raw.replace(/\D/g, '');
    let nextCountry = country;

    // Auto-detect country from leading digits
    if (next.length >= 3) {
      const guess = guessCountryFromDigits(next);
      if (guess) nextCountry = guess;
    }

    // Strip the trunk prefix for countries that use one
    if (STRIP_TRUNK_PREFIX.has(nextCountry) && next.startsWith('0')) {
      next = next.slice(1);
    }

    setCountry(nextCountry);
    setDigits(next);
    const e164 = buildE164(next, nextCountry);
    lastEmittedRef.current = e164;
    onChange(e164);
  };

  // Country picked from the popover.
  const handleCountryPick = (c: Country) => {
    setCountry(c);
    setOpen(false);
    const e164 = buildE164(digits, c);
    lastEmittedRef.current = e164;
    onChange(e164);
  };

  const handleCountryButtonClick = () => {
    if (disabled) return;
    setOpen((wasOpen) => {
      if (!wasOpen) setQuery('');
      return !wasOpen;
    });
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Reset search + focus the search input when opened.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // All countries, sorted by English display name.
  const allCountries = useMemo(() => {
    let displayNames: Intl.DisplayNames | null = null;
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      displayNames = null;
    }
    const opts = getCountries().map((c) => ({
      value: c,
      label: displayNames?.of(c) || c,
      dial: getCountryCallingCode(c),
    }));
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCountries;
    const qDigits = q.replace(/\D/g, '');
    return allCountries.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        `+${o.dial}`.includes(q) ||
        (qDigits.length > 0 && o.dial.startsWith(qDigits)),
    );
  }, [allCountries, query]);

  useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex((o) => o.value === country);
    const timer = setTimeout(() => {
      setHighlighted(idx >= 0 ? idx : 0);
    }, 0);
    return () => clearTimeout(timer);
  }, [open, filtered, country]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${highlighted}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const onPopoverKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[highlighted];
      if (pick) handleCountryPick(pick.value);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  // Flag renderer with a text fallback.
  type FlagComponent = React.ComponentType<{ className?: string; title?: string }>;
  const renderFlag = (c: Country, className: string): React.ReactNode => {
    const Comp = (Flags as unknown as Record<string, FlagComponent>)[c];
    if (!Comp) {
      return <span className="adp-flagFallback">{c}</span>;
    }
    return <Comp className={className} />;
  };

  const dialCode = getCountryCallingCode(country);
  const flagForCountry = country; // readable alias

  return (
    <div className="adp-phoneWrap">
      <style>{CSS}</style>

      <div className="adp-phoneBox" data-disabled={disabled || undefined}>
        <div className="adp-country" ref={wrapperRef}>
          <button
            ref={buttonRef}
            type="button"
            className="adp-countryBtn"
            onClick={handleCountryButtonClick}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Country code, ${country}, +${dialCode}`}
          >
            <span className="adp-flag" aria-hidden>
              {renderFlag(flagForCountry, 'adp-flagSvg')}
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
                  onKeyDown={onPopoverKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Search countries"
                />
              </div>

              <ul className="adp-list" ref={listRef} role="listbox">
                {filtered.length === 0 && (
                  <li className="adp-empty">No matches</li>
                )}
                {filtered.map((o, idx) => {
                  const isHi = idx === highlighted;
                  const isSel = o.value === country;
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
                      onClick={() => handleCountryPick(o.value)}
                    >
                      <span className="adp-optionFlag" aria-hidden>
                        {renderFlag(o.value, 'adp-flagSvg')}
                      </span>
                      <span className="adp-optionName">{o.label}</span>
                      <span className="adp-optionDial">+{o.dial}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="adp-input"
          placeholder={placeholder}
          value={display}
          onChange={handleInputChange}
          onBlur={onBlur}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}

// ─── CSS ────────────────────────────────────────────────────────────
const CSS = `
  .adp-phoneWrap { width: 100%; }

  .adp-phoneBox {
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
  .adp-phoneBox:hover:not([data-disabled]) { border-color: #CBD5E1; }
  .adp-phoneBox:focus-within {
    border-color: #0504AA;
    box-shadow: 0 0 0 4px rgba(5,4,170,0.10);
  }
  .adp-phoneBox[data-disabled] { background: #F8FAFC; cursor: not-allowed; }

  .adp-country { position: relative; flex-shrink: 0; }
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
  .adp-countryBtn:disabled { cursor: not-allowed; opacity: 0.6; }

  .adp-flag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 16px;
    border-radius: 3px;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(15,23,42,0.08);
    flex-shrink: 0;
    background: #F1F5F9;
  }
  .adp-flagSvg { width: 100%; height: 100%; display: block; }
  .adp-flagFallback {
    font-size: 9px;
    font-weight: 800;
    color: #64748B;
    letter-spacing: 0.02em;
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
  .adp-list::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 999px; }
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
  .adp-optionSel .adp-optionName { color: #0504AA; font-weight: 800; }

  .adp-optionFlag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 16px;
    border-radius: 3px;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(15,23,42,0.08);
    flex-shrink: 0;
    background: #F1F5F9;
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

  .adp-input {
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
    font-variant-numeric: tabular-nums;
  }
  .adp-input::placeholder { color: #94A3B8; }
  .adp-input:disabled { color: #94A3B8; cursor: not-allowed; }
  .adp-input::-webkit-outer-spin-button,
  .adp-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .adp-popover { animation: none !important; }
  }
`;