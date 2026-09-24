'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import {
  MdArrowBack,
  MdVerified,
  MdHourglassEmpty,
  MdErrorOutline,
  MdClose,
  MdAddPhotoAlternate,
  MdInfoOutline,
  MdDelete,
  MdRefresh,
  MdCheckCircle,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'suspended';

interface MyStore {
  store_id: string;
  name?: string;
  verification_status?: VerificationStatus;
  verified?: boolean;
  verified_at?: string;
  [key: string]: unknown;
}

interface LatestRequest {
  id?: string;
  reference_code?: string;
  status?: string;
  legal_name?: string;
  business_type?: string;
  cac_number?: string | null;
  business_address?: string;
  contact_phone?: string;
  evidence?: string[];
  submitted_at?: string;
  reviewed_at?: string | null;
  review_reason?: string | null;
}

interface VerificationStatusResponse {
  store_id: string;
  verification_status: VerificationStatus;
  verified: boolean;
  verified_at: string | null;
  latest_request: LatestRequest | null;
  events: unknown[];
}

// ─── Constants ──────────────────────────────────────────────────────
const BUSINESS_TYPES = [
  'Retail shop',
  'Wholesale',
  'Food & beverage',
  'Restaurant / kitchen',
  'Pharmacy / health',
  'Beauty & wellness',
  'Services',
  'Manufacturing',
  'Other',
];

const MAX_EVIDENCE_FILES = 4;
const MAX_FILE_MB = 8;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// ─── Display helpers ────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  let d: Date;
  if (value instanceof Date) d = value;
  else if (typeof value === 'string') {
    d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  } else return '—';
  if (isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// ─── Page ───────────────────────────────────────────────────────────
export default function StorekeeperVerificationPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [store, setStore] = useState<MyStore | null>(null);
  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);

  // ── Form state ──────────────────────────────────────────────────
  const [legalName, setLegalName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [cacNumber, setCacNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // ── Load ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const myStore = (await api.getMyStore()) as MyStore | null;
      if (!myStore) {
        setLoadError(
          'You need to create a store before you can request verification.',
        );
        setLoading(false);
        return;
      }
      setStore(myStore);

      const vs = (await api.getStoreVerificationStatus(
        myStore.store_id,
      )) as VerificationStatusResponse;
      setStatus(vs);

      // Pre-fill the form from the latest request (so a rejected
      // storekeeper can fix and resubmit without retyping)
      const req = vs.latest_request;
      if (req && (vs.verification_status === 'rejected' ||
                  vs.verification_status === 'unverified')) {
        setLegalName(req.legal_name ?? '');
        setBusinessType(req.business_type ?? '');
        setCacNumber(req.cac_number ?? '');
        setBusinessAddress(req.business_address ?? '');
        setContactPhone(req.contact_phone ?? '');
        setEvidenceUrls(Array.isArray(req.evidence) ? req.evidence : []);
      }
    } catch (err) {
      setLoadError(extractErrorDetail(err, 'Could not load verification status.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // ── Evidence upload ─────────────────────────────────────────────
  // Uses the existing /storekeeper/upload-store-image endpoint. Not
  // ideal (folder is "store_images") but returns a URL and works today.
  const handleEvidencePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = evidenceUrls.length;
    const selected = Array.from(files).slice(0, MAX_EVIDENCE_FILES - currentCount);
    if (selected.length === 0) {
      alert(`You can attach up to ${MAX_EVIDENCE_FILES} documents.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    for (const file of selected) {
      if (file.size > MAX_FILE_BYTES) {
        alert(
          `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Max is ${MAX_FILE_MB}MB per document.`,
        );
        continue;
      }
      try {
        setUploadingCount((c) => c + 1);
        const res = (await api.uploadStoreImage(file)) as { image_url?: string };
        if (res?.image_url) {
          setEvidenceUrls((prev) => [...prev, res.image_url!]);
        }
      } catch (err) {
        alert('Upload failed: ' + extractErrorDetail(err, 'Unknown error'));
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeEvidence = (url: string) => {
    setEvidenceUrls((prev) => prev.filter((u) => u !== url));
  };

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!store || isSubmitting) return;

    const trimmed = {
      legalName: legalName.trim(),
      businessType: businessType.trim(),
      cacNumber: cacNumber.trim(),
      businessAddress: businessAddress.trim(),
      contactPhone: contactPhone.trim(),
    };

    if (trimmed.legalName.length < 2) return alert('Enter your registered business name.');
    if (!trimmed.businessType) return alert('Pick a business type.');
    if (trimmed.businessAddress.length < 4) return alert('Enter a business address.');
    if (trimmed.contactPhone.length < 7) return alert('Enter a contact phone number.');

    setIsSubmitting(true);
    try {
      await api.submitStoreVerification(store.store_id, {
        legal_name: trimmed.legalName,
        business_type: trimmed.businessType,
        cac_number: trimmed.cacNumber || undefined,
        business_address: trimmed.businessAddress,
        contact_phone: trimmed.contactPhone,
        evidence: evidenceUrls,
      });
      showToast('Verification submitted');
      await load();
    } catch (err) {
      alert(extractErrorDetail(err, 'Could not submit verification.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Cancel ──────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!store || isSubmitting) return;
    if (!window.confirm('Withdraw your verification request? You can resubmit at any time.')) {
      return;
    }
    setIsSubmitting(true);
    try {
      await api.cancelStoreVerification(store.store_id);
      showToast('Request withdrawn');
      await load();
    } catch (err) {
      alert(extractErrorDetail(err, 'Could not cancel.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render gates ────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="kv-root">
        <style>{CSS}</style>
        <header className="kv-header">
          <button className="kv-backBtn" onClick={() => router.back()} aria-label="Back">
            <MdArrowBack size={22} color="#0B0B1A" />
          </button>
          <span className="kv-headerTitle">Store verification</span>
          <div style={{ width: 36 }} />
        </header>
        <div className="kv-scroll">
          <div className="kv-card">
            <div className="kv-skel kv-skelLine" style={{ width: '40%' }} />
            <div className="kv-skel kv-skelLine" style={{ width: '80%' }} />
            <div className="kv-skel kv-skelLine" style={{ width: '60%' }} />
          </div>
        </div>
      </main>
    );
  }

  if (loadError || !store) {
    return (
      <main className="kv-root">
        <style>{CSS}</style>
        <header className="kv-header">
          <button className="kv-backBtn" onClick={() => router.back()} aria-label="Back">
            <MdArrowBack size={22} color="#0B0B1A" />
          </button>
          <span className="kv-headerTitle">Store verification</span>
          <div style={{ width: 36 }} />
        </header>
        <div className="kv-center">
          <MdErrorOutline size={48} color="#cbd5e1" />
          <p className="kv-centerText">{loadError || 'Something went wrong.'}</p>
          <button className="kv-primaryBtn" onClick={load}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  const currentStatus: VerificationStatus =
    status?.verification_status || 'unverified';
  const latest = status?.latest_request || null;

  const showForm =
    currentStatus === 'unverified' || currentStatus === 'rejected';
  const showPending = currentStatus === 'pending';
  const showVerified = currentStatus === 'verified';
  const showSuspended = currentStatus === 'suspended';

  return (
    <main className="kv-root">
      <style>{CSS}</style>

      <header className="kv-header">
        <button className="kv-backBtn" onClick={() => router.back()} aria-label="Back">
          <MdArrowBack size={22} color="#0B0B1A" />
        </button>
        <span className="kv-headerTitle">Store verification</span>
        <button className="kv-backBtn" onClick={load} aria-label="Refresh">
          <MdRefresh size={20} color="#0B0B1A" />
        </button>
      </header>

      <div className="kv-scroll">
        {/* Status banner — always visible at the top */}
        <section
          className={
            'kv-banner' +
            (currentStatus === 'verified'
              ? ' kv-bannerOk'
              : currentStatus === 'pending'
              ? ' kv-bannerWait'
              : currentStatus === 'rejected' || currentStatus === 'suspended'
              ? ' kv-bannerBad'
              : ' kv-bannerNeutral')
          }
        >
          <div className="kv-bannerIcon">
            {showVerified && <MdVerified size={26} color="#16A34A" />}
            {showPending && <MdHourglassEmpty size={26} color="#D97706" />}
            {currentStatus === 'rejected' && <MdClose size={26} color="#DC2626" />}
            {showSuspended && <MdErrorOutline size={26} color="#DC2626" />}
            {currentStatus === 'unverified' && (
              <MdInfoOutline size={26} color="#64748B" />
            )}
          </div>
          <div className="kv-bannerText">
            <div className="kv-bannerTitle">
              {currentStatus === 'verified' && 'Verified'}
              {currentStatus === 'pending' && 'Under review'}
              {currentStatus === 'rejected' && 'Not approved'}
              {currentStatus === 'suspended' && 'Suspended'}
              {currentStatus === 'unverified' && 'Not verified yet'}
            </div>
            <p className="kv-bannerBody">
              {currentStatus === 'verified' && (
                <>Your store was verified on {formatDate(status?.verified_at)}.</>
              )}
              {currentStatus === 'pending' && (
                <>We received your submission on{' '}
                  {formatDate(latest?.submitted_at)}. Review usually takes 1–2 business days.</>
              )}
              {currentStatus === 'rejected' && (
                <>
                  {latest?.review_reason
                    ? `Reason: ${latest.review_reason}`
                    : 'Your last submission was not approved. Review and resubmit.'}
                </>
              )}
              {currentStatus === 'suspended' && (
                <>Your store is temporarily suspended. Contact support for details.</>
              )}
              {currentStatus === 'unverified' && (
                <>Submit a request below to get the verified badge. Verified stores appear higher in search.</>
              )}
            </p>
          </div>
        </section>

        {/* FORM — unverified or rejected */}
        {showForm && (
          <section className="kv-card">
            <h2 className="kv-section">Business details</h2>

            <label className="kv-label">Registered business name *</label>
            <input
              type="text"
              className="kv-input"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="As it appears on your CAC certificate"
              disabled={isSubmitting}
            />

            <label className="kv-label">Business type *</label>
            <select
              className="kv-input"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Select…</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <label className="kv-label">
              CAC registration number <span className="kv-optional">(optional)</span>
            </label>
            <input
              type="text"
              className="kv-input"
              value={cacNumber}
              onChange={(e) => setCacNumber(e.target.value)}
              placeholder="e.g. RC1234567"
              disabled={isSubmitting}
            />

            <label className="kv-label">Business address *</label>
            <textarea
              className="kv-input kv-textarea"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="Street, area, city, state"
              rows={3}
              disabled={isSubmitting}
            />

            <label className="kv-label">Contact phone *</label>
            <input
              type="tel"
              className="kv-input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+234…"
              disabled={isSubmitting}
            />

            <h2 className="kv-section kv-sectionMt">Supporting documents</h2>
            <p className="kv-hint">
              Optional, but faster to review. Upload up to {MAX_EVIDENCE_FILES} files
              (CAC certificate, business permit, utility bill, etc.). Max {MAX_FILE_MB}MB each.
            </p>

            <div className="kv-evidenceGrid">
              {evidenceUrls.map((url) => (
                <div key={url} className="kv-evidenceItem">
                  <img
                    src={resolveImageUrl(url) || ''}
                    alt="Evidence"
                    className="kv-evidenceThumb"
                  />
                  <button
                    type="button"
                    className="kv-evidenceRemove"
                    onClick={() => removeEvidence(url)}
                    aria-label="Remove"
                    disabled={isSubmitting}
                  >
                    <MdClose size={14} color="#fff" />
                  </button>
                </div>
              ))}

              {evidenceUrls.length < MAX_EVIDENCE_FILES && (
                <button
                  type="button"
                  className="kv-evidenceAdd"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || uploadingCount > 0}
                >
                  {uploadingCount > 0 ? (
                    <div className="kv-spinner" />
                  ) : (
                    <>
                      <MdAddPhotoAlternate size={22} color="#0504AA" />
                      <span>Add document</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleEvidencePick}
              disabled={isSubmitting}
            />

            <button
              type="button"
              className="kv-primaryBtn kv-submitBtn"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting…' : 'Submit for review'}
            </button>

            <p className="kv-fineprint">
              By submitting, you confirm the information above is accurate. Submitting
              false information may result in permanent removal from Admerce.
            </p>
          </section>
        )}

        {/* PENDING — read-only summary + cancel */}
        {showPending && latest && (
          <section className="kv-card">
            <h2 className="kv-section">What we received</h2>
            <InfoRow label="Legal name" value={latest.legal_name || '—'} />
            <InfoRow label="Business type" value={latest.business_type || '—'} />
            {latest.cac_number && (
              <InfoRow label="CAC number" value={latest.cac_number} />
            )}
            <InfoRow label="Address" value={latest.business_address || '—'} />
            <InfoRow label="Contact phone" value={latest.contact_phone || '—'} />
            <InfoRow
              label="Documents"
              value={
                Array.isArray(latest.evidence) && latest.evidence.length > 0
                  ? `${latest.evidence.length} attached`
                  : 'None'
              }
            />

            {Array.isArray(latest.evidence) && latest.evidence.length > 0 && (
              <div className="kv-evidenceGrid kv-evidenceGridView">
                {latest.evidence.map((url) => (
                  <a
                    key={url}
                    href={resolveImageUrl(url) || ''}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="kv-evidenceItem"
                  >
                    <img
                      src={resolveImageUrl(url) || ''}
                      alt="Evidence"
                      className="kv-evidenceThumb"
                    />
                  </a>
                ))}
              </div>
            )}

            <div className="kv-cancelWrap">
              <button
                type="button"
                className="kv-ghostDangerBtn"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                <MdDelete size={16} />
                Withdraw request
              </button>
            </div>
          </section>
        )}

        {/* VERIFIED — badge-only */}
        {showVerified && (
          <section className="kv-card kv-cardVerified">
            <div className="kv-verifiedMark">
              <MdVerified size={48} color="#16A34A" />
            </div>
            <h2 className="kv-verifiedTitle">You&apos;re verified</h2>
            <p className="kv-verifiedBody">
              Shoppers see a verified badge on your store. Keep your business details
              up to date — if they change significantly, you may need to re-verify.
            </p>
          </section>
        )}

        {/* SUSPENDED — contact support */}
        {showSuspended && (
          <section className="kv-card">
            <p className="kv-body">
              We suspended this store because of a policy issue. Reach out to
              support to understand what happened and how to appeal.
            </p>
          </section>
        )}
      </div>

      {toast && (
        <div className="kv-toast">
          <MdCheckCircle size={16} color="#fff" />
          <span>{toast}</span>
        </div>
      )}
    </main>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv-row">
      <span className="kv-rowLabel">{label}</span>
      <span className="kv-rowValue">{value}</span>
    </div>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes kv-fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes kv-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes kv-toastIn {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes kv-spin { to { transform: rotate(360deg); } }

  .kv-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: #F4F5FB;
  }

  .kv-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fff;
    border-bottom: 1px solid #EAECF3;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .kv-backBtn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .kv-backBtn:hover { background: #F1F3FA; }
  .kv-headerTitle {
    flex: 1;
    font-size: 16px;
    font-weight: 700;
    color: #0B0B1A;
    letter-spacing: -0.01em;
    text-align: center;
  }

  .kv-scroll { flex: 1; padding: 16px 16px 40px; }

  /* Banner */
  .kv-banner {
    display: flex;
    gap: 14px;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid;
    margin-bottom: 16px;
    align-items: flex-start;
  }
  .kv-bannerOk {
    background: #F0FDF4;
    border-color: #BBF7D0;
  }
  .kv-bannerWait {
    background: #FFFBEB;
    border-color: #FDE68A;
  }
  .kv-bannerBad {
    background: #FEF2F2;
    border-color: #FECACA;
  }
  .kv-bannerNeutral {
    background: #F8FAFC;
    border-color: #E2E8F0;
  }
  .kv-bannerIcon {
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: rgba(255,255,255,0.7);
  }
  .kv-bannerText { flex: 1; min-width: 0; }
  .kv-bannerTitle {
    font-size: 15px;
    font-weight: 800;
    color: #0B0B1A;
    margin-bottom: 4px;
  }
  .kv-bannerBody {
    font-size: 13.5px;
    color: #334155;
    line-height: 1.5;
    margin: 0;
  }

  /* Card */
  .kv-card {
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(11, 11, 26, 0.03);
  }
  .kv-cardVerified {
    text-align: center;
    padding: 32px 20px;
  }
  .kv-verifiedMark { margin-bottom: 14px; }
  .kv-verifiedTitle {
    font-size: 20px;
    font-weight: 800;
    color: #065F46;
    margin: 0 0 8px;
  }
  .kv-verifiedBody {
    font-size: 14px;
    color: #475569;
    line-height: 1.55;
    margin: 0;
    max-width: 420px;
    margin-left: auto;
    margin-right: auto;
  }

  .kv-section {
    font-size: 15px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0 0 14px;
    letter-spacing: -0.01em;
  }
  .kv-sectionMt { margin-top: 28px; }

  .kv-label {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: #334155;
    margin-bottom: 6px;
    margin-top: 14px;
  }
  .kv-optional {
    font-weight: 500;
    color: #94A3B8;
    font-size: 12px;
  }
  .kv-input {
    width: 100%;
    box-sizing: border-box;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #E2E8F0;
    font-size: 14.5px;
    outline: none;
    background: #fff;
    color: #0B0B1A;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .kv-input:focus {
    border-color: #0504AA;
    box-shadow: 0 0 0 3px rgba(5, 4, 170, 0.10);
  }
  .kv-input:disabled { background: #F8FAFC; color: #94A3B8; }
  .kv-textarea {
    resize: vertical;
    min-height: 76px;
    font-family: inherit;
  }

  .kv-hint {
    font-size: 13px;
    color: #64748B;
    line-height: 1.55;
    margin: 0 0 14px;
  }

  .kv-evidenceGrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }
  .kv-evidenceGridView { margin-top: 14px; }
  .kv-evidenceItem {
    position: relative;
    aspect-ratio: 1 / 1;
    border-radius: 12px;
    overflow: hidden;
    background: #F1F5F9;
    border: 1px solid #E2E8F0;
    display: block;
  }
  .kv-evidenceThumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .kv-evidenceRemove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(11, 11, 26, 0.65);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .kv-evidenceRemove:hover { background: rgba(11, 11, 26, 0.85); }
  .kv-evidenceAdd {
    aspect-ratio: 1 / 1;
    border-radius: 12px;
    border: 2px dashed #CBD5E1;
    background: #F8FAFC;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #0504AA;
    transition: background 0.15s, border-color 0.15s;
    padding: 8px;
    text-align: center;
  }
  .kv-evidenceAdd:hover:not(:disabled) {
    background: #EEF0FF;
    border-color: #C9CBFF;
  }
  .kv-evidenceAdd:disabled { cursor: not-allowed; opacity: 0.6; }

  .kv-spinner {
    width: 22px;
    height: 22px;
    border: 3px solid #E2E8F0;
    border-top-color: #0504AA;
    border-radius: 50%;
    animation: kv-spin 0.7s linear infinite;
  }

  .kv-primaryBtn {
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: none;
    background: #0504AA;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
    font-family: inherit;
  }
  .kv-primaryBtn:hover:not(:disabled) { opacity: 0.92; }
  .kv-primaryBtn:disabled { opacity: 0.6; cursor: not-allowed; }
  .kv-submitBtn { margin-top: 8px; }

  .kv-fineprint {
    font-size: 12px;
    color: #94A3B8;
    line-height: 1.5;
    margin: 14px 0 0;
    text-align: center;
  }

  /* Info rows (pending view) */
  .kv-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #F1F5F9;
  }
  .kv-row:last-child { border-bottom: none; }
  .kv-rowLabel {
    flex: 0 0 110px;
    font-size: 12.5px;
    font-weight: 600;
    color: #8A8F99;
  }
  .kv-rowValue {
    flex: 1;
    font-size: 14px;
    color: #1A1A1A;
    font-weight: 500;
    word-break: break-word;
  }

  .kv-cancelWrap {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #F1F5F9;
  }
  .kv-ghostDangerBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid #FECACA;
    background: transparent;
    color: #DC2626;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .kv-ghostDangerBtn:hover:not(:disabled) { background: #FEF2F2; }
  .kv-ghostDangerBtn:disabled { opacity: 0.5; cursor: not-allowed; }

  .kv-body {
    font-size: 14px;
    color: #475569;
    line-height: 1.55;
    margin: 0;
  }

  .kv-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
  }
  .kv-centerText {
    font-size: 14px;
    color: #64748B;
    margin: 6px 0 14px;
    max-width: 380px;
    line-height: 1.55;
  }

  .kv-skel {
    background: linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%);
    background-size: 800px 100%;
    animation: kv-shimmer 1.4s infinite linear;
    border-radius: 8px;
    margin-bottom: 10px;
  }
  .kv-skelLine { height: 14px; width: 100%; }

  .kv-toast {
    position: fixed;
    left: 50%;
    bottom: 32px;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 999px;
    background: #0B0B1A;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 12px 30px rgba(0,0,0,0.25);
    z-index: 2000;
    animation: kv-toastIn 0.2s ease;
  }
`;