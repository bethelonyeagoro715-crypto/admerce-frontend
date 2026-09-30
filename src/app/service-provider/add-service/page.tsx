'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { alertDialog } from '../../../components/ui/dialogs';
import {
  MdArrowBack,
  MdCheck,
  MdClose,
  MdErrorOutline,
  MdVideocam,
  MdLocationOn,
  MdInsertDriveFile,
  MdAccessTime,
  MdOutlineAttachMoney,
  MdDesignServices,
} from 'react-icons/md';

interface ServiceCategory {
  id: string;
  label: string;
  emoji: string;
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'grooming_beauty', label: 'Grooming & Beauty', emoji: '💈' },
  { id: 'repair_maintenance', label: 'Repair & Maintenance', emoji: '🔧' },
  { id: 'cleaning_care', label: 'Cleaning & Care', emoji: '🧹' },
  { id: 'automotive', label: 'Automotive', emoji: '🚗' },
  { id: 'education', label: 'Education', emoji: '👨‍🏫' },
  { id: 'health_wellness', label: 'Health & Wellness', emoji: '⚕️' },
  { id: 'home_garden', label: 'Home & Garden', emoji: '🛋️' },
  { id: 'event_entertainment', label: 'Events & Entertainment', emoji: '📸' },
  { id: 'digital_creative', label: 'Digital & Creative', emoji: '🎨' },
];

const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

export default function CreateServicePage() {
  useAuthGuard();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<ServiceCategory | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lat, setLat] = useState(5.5103);
  const [lng, setLng] = useState(7.0265);
  const [locationReady, setLocationReady] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const seq = ++reqSeq.current;
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationReady(true);
      },
      () => {
        if (seq === reqSeq.current && isMountedRef.current) {
          setLocationReady(false);
        }
      },
      { timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    return () => {
      if (videoPreview && videoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(videoPreview);
      }
    };
  }, [videoPreview]);

  const handleVideoChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      void alertDialog({
        title: 'Video too large',
        body: 'Please pick a video under 30 MB. Trim it or lower the resolution.',
        kind: 'warning',
      });
      return;
    }
    if (videoPreview && videoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoFile(file);
    try {
      setVideoPreview(URL.createObjectURL(file));
    } catch {
      setVideoPreview(null);
    }
  };

  const removeVideo = () => {
    if (videoPreview && videoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoFile(null);
    setVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const priceNum = Number(price);
  const durationNum = Number(duration);

  const missingField = (): string | null => {
    if (!title.trim()) return 'Add a service title to continue';
    if (!selectedCategory) return 'Pick a category to continue';
    if (!price.trim() || !Number.isFinite(priceNum) || priceNum <= 0)
      return 'Enter how much you charge';
    if (
      !duration.trim() ||
      !Number.isFinite(durationNum) ||
      durationNum <= 0
    )
      return 'Enter how long this service takes';
    return null;
  };

  const ready = missingField() === null;

  const submitService = async () => {
    const missing = missingField();
    if (missing) {
      await alertDialog({
        title: 'Check your details',
        body: missing + '.',
        kind: 'warning',
      });
      return;
    }
    if (!selectedCategory) return;

    setIsSubmitting(true);
    try {
      const result = (await api.createService(
        title.trim(),
        selectedCategory.id,
        description.trim(),
        priceNum,
        durationNum,
        lat,
        lng,
      )) as { service_id?: string };

      const serviceId = result.service_id;
      if (!serviceId)
        throw new Error('Service created but no ID returned');

      let videoWarning: string | null = null;
      if (videoFile) {
        try {
          await api.uploadServiceVideo(serviceId, videoFile);
        } catch (err) {
          videoWarning = extractErrorDetail(err, 'Unknown error');
        }
      }

      if (videoWarning) {
        await alertDialog({
          title: 'Service live, video failed',
          body: `Your service was created but the video didn't upload: ${videoWarning}. You can add it later from Edit Service.`,
          kind: 'warning',
          confirmLabel: 'Got it',
        });
      } else {
        await alertDialog({
          title: 'Service published',
          body: `"${title.trim()}" is now live for shoppers to book.`,
          kind: 'success',
          confirmLabel: 'View dashboard',
        });
      }

      router.replace('/service-provider/home');
    } catch (err) {
      await alertDialog({
        title: "Couldn't create service",
        body: extractErrorDetail(
          err,
          'Please check your details and try again.',
        ),
        kind: 'danger',
      });
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (
      typeof window !== 'undefined' &&
      window.history.length > 1
    ) {
      router.back();
    } else {
      router.push('/service-provider/home');
    }
  };

  return (
    <main style={css.root} className="sp-add">
      <style>{CSS}</style>

      <div style={css.headerWrap}>
        <div style={css.headerInner}>
          <button
            type="button"
            onClick={goBack}
            style={css.backBtn}
            aria-label="Back"
          >
            <MdArrowBack size={20} color="var(--brand-on-gradient)" />
          </button>
          <div style={css.headerText}>
            <h1 style={css.headerTitle}>Add service</h1>
            <div style={css.headerSub}>
              {ready ? 'Ready to publish' : 'Fill in the details below'}
            </div>
          </div>
          <div style={css.headerSpacer} />
        </div>
      </div>

      <div style={css.sheet}>
        <h3 style={css.sectionLabel}>Service reel</h3>

        <div style={css.videoCard} className="sp-video-card">
          {videoPreview ? (
            <>
              <video
                src={videoPreview}
                style={css.videoEl}
                controls
                muted
                playsInline
                loop
              />
              <button
                type="button"
                onClick={removeVideo}
                style={css.mediaRemoveBtn}
                aria-label="Remove video"
              >
                <MdClose size={16} color="#fff" />
              </button>
              <div style={css.videoBadge}>9:16 reel</div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              style={css.videoPlaceholder}
              aria-label="Add vertical video"
            >
              <div style={css.videoPlaceholderHalo}>
                <MdVideocam
                  size={38}
                  color="var(--brand-on-gradient)"
                />
              </div>
              <div style={css.videoPlaceholderTitle}>
                Add a vertical video
              </div>
              <div style={css.videoPlaceholderHint}>
                This is what shoppers see in the feed · 9:16 · under 30
                MB
              </div>
            </button>
          )}
        </div>

        <div style={css.mediaControls}>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            style={css.mediaBtn}
            className="sp-media-btn"
          >
            <MdVideocam size={16} color="var(--brand-primary)" />
            <span>{videoFile ? 'Change video' : 'Add video'}</span>
          </button>
          {videoFile && (
            <button
              type="button"
              onClick={removeVideo}
              style={{ ...css.mediaBtn, ...css.mediaBtnDanger }}
              className="sp-media-btn"
            >
              <MdClose size={16} color="var(--danger-fg)" />
              <span>Remove</span>
            </button>
          )}
        </div>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleVideoChange}
        />

        {videoFile && (
          <div style={css.fileChip}>
            <MdInsertDriveFile
              size={14}
              color="var(--brand-primary)"
            />
            <span style={css.fileChipText} title={videoFile.name}>
              {videoFile.name}
            </span>
            <button
              type="button"
              onClick={removeVideo}
              style={css.fileChipRemove}
              aria-label="Remove video"
            >
              <MdClose size={14} color="var(--text-tertiary)" />
            </button>
          </div>
        )}

        <h3 style={css.sectionLabel}>The basics</h3>
        <div style={css.card}>
          <div style={css.fieldWrap}>
            <label style={css.fieldLabel}>Service title</label>
            <input
              type="text"
              placeholder="e.g. Home AC installation, plumbing, hair styling"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              style={css.input}
              className="sp-input"
            />
            <div style={css.fieldFooter}>
              <span style={css.fieldHint}>
                Short and clear — shoppers skim titles
              </span>
              <span style={css.charCount}>{title.length}/120</span>
            </div>
          </div>

          <div style={css.fieldWrap}>
            <label style={css.fieldLabel}>Description</label>
            <textarea
              placeholder="What's included, what you'll need, anything the customer should know"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={800}
              rows={5}
              style={css.textarea}
              className="sp-input"
            />
            <div style={css.fieldFooter}>
              <span style={css.fieldHint}>
                Optional — but services with details get booked 2× more
              </span>
              <span style={css.charCount}>
                {description.length}/800
              </span>
            </div>
          </div>
        </div>

        <h3 style={css.sectionLabel}>Price & duration</h3>
        <div style={css.card}>
          <div style={css.fieldWrap}>
            <label style={css.fieldLabel}>
              <MdOutlineAttachMoney
                size={14}
                color="var(--brand-primary)"
              />{' '}
              Price (₦)
            </label>
            <div style={css.currencyRow}>
              <span style={css.currencySymbol}>₦</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                style={{ ...css.input, paddingLeft: 34 }}
                className="sp-input"
              />
            </div>
            <div style={css.fieldFooter}>
              <span style={css.fieldHint}>
                {Number.isFinite(priceNum) && priceNum > 0
                  ? `₦${priceNum.toLocaleString('en-NG')}`
                  : 'What do you charge for this service?'}
              </span>
            </div>
          </div>

          <div style={css.fieldWrap}>
            <label style={css.fieldLabel}>
              <MdAccessTime size={14} color="var(--info-fg)" />{' '}
              Duration (minutes)
            </label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="60"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min={1}
              style={css.input}
              className="sp-input"
            />
            <div style={css.fieldFooter}>
              <span style={css.fieldHint}>
                {Number.isFinite(durationNum) && durationNum > 0
                  ? durationNum >= 60
                    ? `${(durationNum / 60).toFixed(
                        durationNum % 60 === 0 ? 0 : 1,
                      )} hours`
                    : `${durationNum} minutes`
                  : 'How long does this usually take?'}
              </span>
            </div>
          </div>
        </div>

        <h3 style={css.sectionLabel}>Category</h3>
        <div style={css.chipsWrap}>
          {SERVICE_CATEGORIES.map((cat) => {
            const active = selectedCategory?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  ...css.chip,
                  borderColor: active
                    ? 'var(--brand-primary)'
                    : 'var(--border-default)',
                  backgroundColor: active
                    ? 'var(--brand-soft)'
                    : 'var(--bg-secondary)',
                  color: active
                    ? 'var(--brand-primary)'
                    : 'var(--text-secondary)',
                }}
                className="sp-chip"
              >
                <span style={css.chipEmoji} aria-hidden>
                  {cat.emoji}
                </span>
                <span style={{ fontWeight: active ? 800 : 700 }}>
                  {cat.label}
                </span>
                {active && (
                  <MdCheck size={14} color="var(--brand-primary)" />
                )}
              </button>
            );
          })}
        </div>

        {!ready && (
          <div style={css.missingNudge}>
            <MdErrorOutline size={16} color="var(--warning-fg)" />
            <span>{missingField()}</span>
          </div>
        )}

        <div style={css.locationPill}>
          <MdLocationOn
            size={16}
            color={
              locationReady
                ? 'var(--success-fg)'
                : 'var(--text-muted)'
            }
          />
          <div style={css.locationText}>
            <div style={css.locationTitle}>
              {locationReady
                ? 'Location set'
                : 'Fetching location…'}
            </div>
            <div style={css.locationHint}>
              {locationReady
                ? `Shoppers within range will see your service · ${lat.toFixed(
                    4,
                  )}, ${lng.toFixed(4)}`
                : 'Enable location to appear in the nearby feed'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={submitService}
          disabled={isSubmitting}
          style={{
            ...css.submitBtn,
            opacity: isSubmitting ? 0.7 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
          className="sp-submit"
        >
          {isSubmitting ? (
            <>
              <div style={css.spinnerWhite} />
              <span>Publishing…</span>
            </>
          ) : (
            <>
              <MdDesignServices
                size={20}
                color="var(--brand-on-gradient)"
              />
              <span>{ready ? 'Publish service' : 'Continue'}</span>
            </>
          )}
        </button>

        <div style={{ height: 24 }} />
      </div>
    </main>
  );
}

const CSS = `
  @keyframes spSpin { to { transform: rotate(360deg); } }

  .sp-add, .sp-add *, .sp-add *::before, .sp-add *::after {
    box-sizing: border-box;
  }

  .sp-input:focus {
    border-color: var(--brand-primary) !important;
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--brand-primary) 12%, transparent);
  }

  .sp-chip {
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .sp-chip:active { transform: scale(0.97); }

  .sp-media-btn {
    transition: background-color 0.15s, transform 0.12s;
  }
  .sp-media-btn:active { transform: scale(0.97); }

  .sp-video-card {
    transition: box-shadow 0.15s;
  }
  .sp-video-card:hover {
    box-shadow: 0 12px 32px
      color-mix(in srgb, var(--brand-primary) 10%, transparent);
  }

  .sp-submit {
    transition: transform 0.12s;
  }
  .sp-submit:active:not(:disabled) { transform: scale(0.98); }
`;

const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    overflowX: 'hidden',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },

  headerWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'var(--brand-gradient)',
    padding: '12px 20px',
    transition: 'background 0.18s ease',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    maxWidth: 880,
    margin: '0 auto',
    width: '100%',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 12%, transparent)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    margin: 0,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 72%, transparent)',
    fontWeight: 600,
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 38, flexShrink: 0 },

  sheet: {
    flex: 1,
    padding: '20px 20px 40px',
    maxWidth: 880,
    margin: '0 auto',
    width: '100%',
  },

  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: 'var(--text-tertiary)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '20px 0 10px 4px',
  },

  videoCard: {
    position: 'relative',
    width: '100%',
    maxWidth: 320,
    aspectRatio: '9 / 16',
    margin: '0 auto 14px',
    borderRadius: 22,
    backgroundColor: 'var(--bg-tertiary)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.18s ease',
  },
  videoEl: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  videoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    padding: '4px 9px',
    borderRadius: 8,
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--brand-on-primary)',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.5,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  mediaRemoveBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  videoPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 24,
    gap: 8,
    background: 'var(--brand-gradient)',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--brand-on-gradient)',
  },
  videoPlaceholderHalo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 14%, transparent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  videoPlaceholderTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    letterSpacing: -0.2,
  },
  videoPlaceholderHint: {
    fontSize: 12,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 72%, transparent)',
    fontWeight: 500,
    lineHeight: 1.5,
    maxWidth: 240,
  },

  mediaControls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
  },
  mediaBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1.5px solid var(--border-default)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  mediaBtnDanger: {
    borderColor: 'var(--danger-strong)',
    backgroundColor: 'var(--danger-bg)',
    color: 'var(--danger-fg)',
  },

  fileChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    marginTop: 12,
    backgroundColor: 'var(--brand-soft)',
    border:
      '1px solid color-mix(in srgb, var(--brand-primary) 40%, transparent)',
    borderRadius: 10,
  },
  fileChipText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--brand-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileChipRemove: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 18,
    border: '1px solid var(--border-default)',
    overflow: 'hidden',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '16px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: 700,
    color: 'var(--text-secondary)',
    letterSpacing: 0.1,
    marginBottom: 2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid var(--border-default)',
    fontSize: 14.5,
    fontWeight: 500,
    color: 'var(--text-primary)',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: 'var(--bg-tertiary)',
    transition:
      'border-color 0.15s, box-shadow 0.15s, background-color 0.18s ease',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid var(--border-default)',
    fontSize: 14.5,
    fontWeight: 500,
    color: 'var(--text-primary)',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: 'var(--bg-tertiary)',
    resize: 'vertical',
    lineHeight: 1.5,
    minHeight: 110,
    transition:
      'border-color 0.15s, box-shadow 0.15s, background-color 0.18s ease',
    boxSizing: 'border-box',
  },
  currencyRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  currencySymbol: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--brand-primary)',
    pointerEvents: 'none',
  },
  fieldFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  fieldHint: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  charCount: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    marginLeft: 'auto',
  },

  chipsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 14px',
    borderRadius: 999,
    border: '1.5px solid',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.05,
  },
  chipEmoji: {
    fontSize: 14,
    lineHeight: 1,
  },

  missingNudge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    padding: '12px 14px',
    backgroundColor: 'var(--warning-bg)',
    border: '1px solid var(--warning-strong)',
    borderRadius: 12,
    color: 'var(--warning-fg)',
    fontSize: 12.5,
    fontWeight: 600,
    lineHeight: 1.4,
  },

  locationPill: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    padding: '12px 14px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 14,
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  locationText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  locationTitle: {
    fontSize: 13.5,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: -0.1,
  },
  locationHint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 500,
    lineHeight: 1.45,
  },

  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginTop: 20,
    padding: 17,
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 16,
    fontSize: 15.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    boxShadow: 'var(--shadow-brand)',
  },

  spinnerWhite: {
    width: 18,
    height: 18,
    border:
      '2px solid color-mix(in srgb, var(--brand-on-gradient) 40%, transparent)',
    borderTopColor: 'var(--brand-on-gradient)',
    borderRadius: '50%',
    animation: 'spSpin 0.8s linear infinite',
  },
};