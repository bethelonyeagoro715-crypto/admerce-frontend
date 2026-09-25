'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdSearch,
  MdClose,
  MdPublic,
  MdCheck,
  MdErrorOutline,
} from 'react-icons/md';

// ISO 3166-1 alpha-2 codes. Full names come from Intl.DisplayNames — no
// hardcoded name strings, so this stays accurate across locales.
const ISO_CODES =
  'AD,AE,AF,AG,AI,AL,AM,AO,AQ,AR,AS,AT,AU,AW,AX,AZ,BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,BZ,CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CR,CU,CV,CW,CX,CY,CZ,DE,DJ,DK,DM,DO,DZ,EC,EE,EG,EH,ER,ES,ET,FI,FJ,FK,FM,FO,FR,GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY,HK,HM,HN,HR,HT,HU,ID,IE,IL,IM,IN,IO,IQ,IR,IS,IT,JE,JM,JO,JP,KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ,LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY,MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU,MV,MW,MX,MY,MZ,NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ,OM,PA,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY,QA,RE,RO,RS,RU,RW,SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,SS,ST,SV,SX,SY,SZ,TC,TD,TF,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,UA,UG,UM,US,UY,UZ,VA,VC,VE,VG,VI,VN,VU,WF,WS,YE,YT,ZA,ZM,ZW'
    .split(',');

interface Country {
  code: string;
  name: string;
}

interface CountryPickerProps {
  value: string; // ISO alpha-2 code or ''
  onChange: (code: string, name: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function CountryPicker({
  value,
  onChange,
  label = 'Country',
  placeholder = 'Select your country',
  required = false,
  disabled = false,
}: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Build once: [{ code, name }] using Intl for display names.
  const countries: Country[] = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      display = null;
    }
    const list = ISO_CODES.map((code) => ({
      code,
      name: display?.of(code) || code,
    }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countries, query]);

  const current = useMemo(
    () => countries.find((c) => c.code === value) || null,
    [countries, value],
  );

  // Focus search input when the sheet opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = useCallback(
    (c: Country) => {
      onChange(c.code, c.name);
      setOpen(false);
    },
    [onChange],
  );

  const isMissing = required && !value;

  const sheet =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => setOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(11,11,26,0.45)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    zIndex: 9998,
                  }}
                />

                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    maxHeight: '82vh',
                    margin: '0 auto',
                    maxWidth: 480,
                    background: '#FFFFFF',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    boxShadow: '0 -20px 60px rgba(15,23,42,0.24)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* Handle + header */}
                  <div
                    style={{
                      padding: '10px 20px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 4,
                        borderRadius: 999,
                        background: '#E2E8F0',
                        margin: '0 auto',
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: '#0B0B1A',
                          margin: 0,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {label}
                      </h3>
                      <button
                        onClick={() => setOpen(false)}
                        aria-label="Close"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          border: 'none',
                          background: '#F6F7FB',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MdClose size={18} color="#5A6178" />
                      </button>
                    </div>

                    {/* Search */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1.5px solid #E6E8F0',
                        background: '#FAFAFC',
                      }}
                    >
                      <MdSearch size={18} color="#94A3B8" />
                      <input
                        ref={searchRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search countries"
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: 14,
                          color: '#0B0B1A',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  </div>

                  {/* Country list */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '12px 12px calc(16px + env(safe-area-inset-bottom))',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    {filtered.length === 0 ? (
                      <div
                        style={{
                          padding: '32px 16px',
                          textAlign: 'center',
                          color: '#94A3B8',
                          fontSize: 13,
                        }}
                      >
                        No countries match &ldquo;{query}&rdquo;
                      </div>
                    ) : (
                      filtered.map((c) => {
                        const selected = c.code === value;
                        return (
                          <button
                            key={c.code}
                            onClick={() => pick(c)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '12px 14px',
                              borderRadius: 12,
                              border: 'none',
                              background: selected ? '#EEF0FF' : 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontFamily: 'inherit',
                              transition: 'background-color 0.12s',
                            }}
                            onMouseEnter={(e) => {
                              if (!selected)
                                e.currentTarget.style.background = '#F6F7FB';
                            }}
                            onMouseLeave={(e) => {
                              if (!selected)
                                e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: selected ? '#0504AA' : '#94A3B8',
                                minWidth: 30,
                                letterSpacing: 0.4,
                              }}
                            >
                              {c.code}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 14.5,
                                fontWeight: selected ? 700 : 600,
                                color: selected ? '#0504AA' : '#0B0B1A',
                              }}
                            >
                              {c.name}
                            </span>
                            {selected && <MdCheck size={18} color="#0504AA" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

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

      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setQuery('');
          setOpen(true);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 14,
          border: `1.5px solid ${
            isMissing ? '#FCA5A5' : focused ? '#C7CCFF' : '#E6E8F0'
          }`,
          backgroundColor: disabled
            ? '#F6F7FB'
            : focused
              ? '#FFFFFF'
              : '#FAFAFC',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          width: '100%',
          transition: 'border-color 0.15s, background-color 0.15s',
          boxShadow: focused ? '0 0 0 4px rgba(5,4,170,0.08)' : 'none',
        }}
      >
        <MdPublic
          size={18}
          color={focused ? '#0504AA' : '#94A3B8'}
          style={{ flexShrink: 0 }}
        />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 15,
            fontWeight: 500,
            color: current ? '#0B0B1A' : '#94A3B8',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {current ? current.name : placeholder}
        </span>
        {current && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#94A3B8',
              letterSpacing: 0.4,
            }}
          >
            {current.code}
          </span>
        )}
      </button>

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

      {sheet}
    </label>
  );
}