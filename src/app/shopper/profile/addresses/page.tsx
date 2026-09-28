'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { confirmDialog, alertDialog } from '../../../../components/ui/dialogs';
import { SettingsShell } from '../../../../components/settings/SettingsUI';
import {
  MdAdd,
  MdLocationOn,
  MdEdit,
  MdDeleteOutline,
  MdClose,
  MdHome,
  MdBusiness,
  MdCheck,
  MdStar,
} from 'react-icons/md';

interface Address {
  id: string;
  label?: string;
  recipient_name?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  is_default?: boolean;
  kind?: 'home' | 'work' | 'other';
  latitude?: number;
  longitude?: number;
}

const EMPTY: Omit<Address, 'id'> = {
  label: '',
  recipient_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  country: 'Nigeria',
  postal_code: '',
  is_default: false,
  kind: 'home',
};

export default function AddressesPage() {
  useAuthGuard();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Address | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Omit<Address, 'id'>>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const res = await api.getAddresses();
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setAddresses(Array.isArray(res) ? (res as Address[]) : []);
    } catch (err) {
      if (seq === reqSeq.current && isMountedRef.current) {
        await alertDialog({
          title: 'Could not load addresses',
          body: extractErrorDetail(err, 'Please try again.'),
          kind: 'danger',
        });
      }
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/shopper/profile');
    }
  };

  const openNew = () => {
    setEditing(null);
    setDraft({ ...EMPTY });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (a: Address) => {
    setEditing(a);
    setDraft({ ...a });
    setErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setDraft(EMPTY);
    setErrors({});
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!draft.line1.trim()) e.line1 = 'Street address is required';
    if (!draft.city?.trim()) e.city = 'City is required';
    if (!draft.state?.trim()) e.state = 'State is required';
    if (draft.phone && !/^\+?\d[\d\s-]{6,}$/.test(draft.phone)) {
      e.phone = 'Enter a valid phone number';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveForm = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updateAddress(editing.id, draft);
      } else {
        await api.createAddress(draft);
      }
      await load();
      closeForm();
    } catch (err) {
      await alertDialog({
        title: 'Could not save address',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  const removeAddress = async (a: Address) => {
    const ok = await confirmDialog({
      title: 'Delete address?',
      body: a.label || a.line1,
      kind: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteAddress(a.id);
      setAddresses((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err) {
      await alertDialog({
        title: 'Could not delete',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    }
  };

  const makeDefault = async (a: Address) => {
    try {
      await api.updateAddress(a.id, { ...a, is_default: true });
      await load();
    } catch (err) {
      await alertDialog({
        title: 'Could not update',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    }
  };

  if (loading) {
    return (
      <SettingsShell title="Delivery addresses" onBack={goBack}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title="Delivery addresses"
      onBack={goBack}
      action={
        <button onClick={openNew} style={css.headerAdd} className="ad-add">
          <MdAdd size={20} color="#0504AA" />
        </button>
      }
    >
      <style>{`
        .ad-add:active { transform: scale(0.94); }
        .ad-card:active { background-color: #F8FAFF; }
        .ad-input:focus { border-color: #0504AA; box-shadow: 0 0 0 3px rgba(5,4,170,0.10); }
      `}</style>

      {addresses.length === 0 ? (
        <div style={css.empty}>
          <div style={css.emptyIcon}>
            <MdLocationOn size={40} color="#0504AA" />
          </div>
          <h2 style={css.emptyTitle}>No addresses yet</h2>
          <p style={css.emptyBody}>
            Add a delivery address so sellers know where to send your items.
          </p>
          <button onClick={openNew} style={css.emptyCta}>
            <MdAdd size={18} color="#fff" />
            <span>Add address</span>
          </button>
        </div>
      ) : (
        <div style={css.list}>
          {addresses.map((a) => (
            <div key={a.id} style={css.card} className="ad-card">
              <button onClick={() => openEdit(a)} style={css.cardBody}>
                <span style={css.cardIcon}>
                  {a.kind === 'work' ? (
                    <MdBusiness size={20} color="#0504AA" />
                  ) : (
                    <MdHome size={20} color="#0504AA" />
                  )}
                </span>
                <span style={css.cardText}>
                  <span style={css.cardTopRow}>
                    <span style={css.cardLabel}>
                      {a.label || a.recipient_name || 'Address'}
                    </span>
                    {a.is_default && (
                      <span style={css.defaultChip}>
                        <MdStar size={11} color="#0504AA" />
                        <span>Default</span>
                      </span>
                    )}
                  </span>
                  <span style={css.cardLine}>{a.line1}</span>
                  {(a.line2 || a.city || a.state) && (
                    <span style={css.cardLine2}>
                      {[a.line2, a.city, a.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {a.phone && <span style={css.cardPhone}>{a.phone}</span>}
                </span>
              </button>
              <div style={css.cardActions}>
                {!a.is_default && (
                  <button
                    onClick={() => makeDefault(a)}
                    style={css.iconAction}
                    aria-label="Set as default"
                  >
                    <MdCheck size={18} color="#16A34A" />
                  </button>
                )}
                <button
                  onClick={() => openEdit(a)}
                  style={css.iconAction}
                  aria-label="Edit"
                >
                  <MdEdit size={18} color="#0504AA" />
                </button>
                <button
                  onClick={() => removeAddress(a)}
                  style={css.iconAction}
                  aria-label="Delete"
                >
                  <MdDeleteOutline size={18} color="#DC2626" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form sheet */}
      {showForm && (
        <div style={css.overlay} onClick={closeForm}>
          <div style={css.sheet} onClick={(e) => e.stopPropagation()}>
            <button onClick={closeForm} style={css.close} aria-label="Close">
              <MdClose size={20} color="#64748B" />
            </button>
            <h3 style={css.formTitle}>
              {editing ? 'Edit address' : 'New address'}
            </h3>
            <p style={css.formSub}>
              We use this to route your deliveries and estimate fees.
            </p>

            <div style={css.formGrid}>
              <F
                label="Label"
                placeholder="e.g. Home, Office"
                value={draft.label || ''}
                onChange={(v) => setDraft({ ...draft, label: v })}
              />
              <F
                label="Recipient name"
                placeholder="Who receives the package?"
                value={draft.recipient_name || ''}
                onChange={(v) => setDraft({ ...draft, recipient_name: v })}
              />
              <F
                label="Phone"
                placeholder="+234…"
                value={draft.phone || ''}
                onChange={(v) => setDraft({ ...draft, phone: v })}
                error={errors.phone}
              />
              <F
                label="Street address"
                placeholder="House number and street"
                value={draft.line1}
                onChange={(v) => setDraft({ ...draft, line1: v })}
                error={errors.line1}
                required
              />
              <F
                label="Apartment, suite (optional)"
                value={draft.line2 || ''}
                onChange={(v) => setDraft({ ...draft, line2: v })}
              />
              <F
                label="City"
                value={draft.city || ''}
                onChange={(v) => setDraft({ ...draft, city: v })}
                error={errors.city}
                required
              />
              <F
                label="State"
                value={draft.state || ''}
                onChange={(v) => setDraft({ ...draft, state: v })}
                error={errors.state}
                required
              />
              <F
                label="Postal code (optional)"
                value={draft.postal_code || ''}
                onChange={(v) => setDraft({ ...draft, postal_code: v })}
              />
            </div>

            <label style={css.checkRow}>
              <input
                type="checkbox"
                checked={!!draft.is_default}
                onChange={(e) =>
                  setDraft({ ...draft, is_default: e.target.checked })
                }
                style={css.check}
              />
              <span style={css.checkLabel}>Set as default address</span>
            </label>

            <button
              onClick={saveForm}
              disabled={saving}
              style={{ ...css.primaryBtn, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add address'}
            </button>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}

function F({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label style={css.field}>
      <span style={css.fieldLabel}>
        {label}
        {required && <span style={{ color: '#DC2626' }}> *</span>}
      </span>
      <input
        className="ad-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...css.input,
          borderColor: error ? '#FCA5A5' : '#E6E8F0',
        }}
      />
      {error && <span style={css.fieldError}>{error}</span>}
    </label>
  );
}

const css: Record<string, React.CSSProperties> = {
  headerAdd: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.12s',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '40px 20px',
  },
  emptyIcon: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748B',
    margin: '8px 0 24px',
    maxWidth: 300,
    lineHeight: 1.55,
  },
  emptyCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '13px 22px',
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
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
    transition: 'background-color 0.15s',
  },
  cardBody: {
    flex: 1,
    display: 'flex',
    gap: 12,
    padding: '14px 14px 14px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    minWidth: 0,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
    flex: 1,
  },
  cardTopRow: { display: 'flex', alignItems: 'center', gap: 8 },
  cardLabel: {
    fontSize: 14.5,
    fontWeight: 700,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },
  defaultChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 7px',
    borderRadius: 999,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.3,
  },
  cardLine: {
    fontSize: 13,
    color: '#475569',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardLine2: { fontSize: 12.5, color: '#94A3B8' },
  cardPhone: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    paddingRight: 8,
  },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: 'none',
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.48)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92vh',
    overflowY: 'auto',
    backgroundColor: '#fff',
    borderRadius: '24px 24px 0 0',
    padding: '24px 22px calc(28px + env(safe-area-inset-bottom))',
    boxShadow: '0 -8px 40px rgba(5,4,170,0.2)',
    position: 'relative',
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: '0 0 4px',
    letterSpacing: -0.3,
  },
  formSub: { fontSize: 13, color: '#64748B', margin: '0 0 18px' },
  formGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 14,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#334155',
    letterSpacing: 0.1,
  },
  fieldError: { fontSize: 12, color: '#DC2626', fontWeight: 600 },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 500,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 4px',
  },
  check: { width: 18, height: 18, accentColor: '#0504AA' },
  checkLabel: { fontSize: 14, color: '#0B0B1A', fontWeight: 500 },
  primaryBtn: {
    width: '100%',
    marginTop: 12,
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
  },
  skeleton: {
    height: 88,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};