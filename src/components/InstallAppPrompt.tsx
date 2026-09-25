'use client';

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MdClose, MdDownload, MdIosShare, MdAddBox } from 'react-icons/md';

// ─── Types ────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ─── Tuning ───────────────────────────────────────────────────────
const DISMISS_KEY = 'admerce_install_prompt_dismissed_at';
const SESSION_KEY = 'admerce_install_prompt_shown_session';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const AUTO_TRIGGER_MS = 12_000;
const SCROLL_TRIGGER_PX = 500;

// Paths where we never show the prompt — focused flows.
const SUPPRESS_PATHS = [
  '/login',
  '/signup',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
  '/wallet-pin-setup',
];

// ─── Global capture ───────────────────────────────────────────────
// The beforeinstallprompt event can fire before the component mounts,
// so we capture it at module scope and cache it. Component reads from
// the cache, not from a fresh listener.
let _deferredPrompt: BeforeInstallPromptEvent | null = null;
let _listenerAttached = false;

function ensureGlobalListener() {
  if (_listenerAttached || typeof window === 'undefined') return;
  _listenerAttached = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e as BeforeInstallPromptEvent;
    // Notify any live components that the install is now available.
    window.dispatchEvent(new CustomEvent('admerce:install-available'));
  });

  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  });
}

/** Public API — call from anywhere (e.g. a Settings → Install App button). */
export function triggerInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('admerce:open-install-prompt'));
}

// ─── Detection helpers ────────────────────────────────────────────
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isiPadOS =
    /Macintosh/.test(ua) && (window.navigator.maxTouchPoints ?? 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || isiPadOS;
}

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (!Number.isFinite(t)) return false;
    return Date.now() - t < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function wasShownThisSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markShownThisSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

// ─── Component ────────────────────────────────────────────────────
export default function InstallAppPrompt() {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [iosVariant, setIosVariant] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);

  // Attach the global listener once.
  useEffect(() => {
    ensureGlobalListener();
  }, []);

  // Track whether native install is ready. Polls every 2s in case the
  // event fires late; cheap enough.
  useEffect(() => {
    if (!mounted) return;
    const refresh = () => setNativeAvailable(_deferredPrompt !== null);
    refresh();
    const onAvail = () => setNativeAvailable(true);
    window.addEventListener('admerce:install-available', onAvail);
    const id = setInterval(refresh, 2000);
    return () => {
      clearInterval(id);
      window.removeEventListener('admerce:install-available', onAvail);
    };
  }, [mounted]);

  const shouldSuppress = useCallback(() => {
    if (isStandalone()) return true;
    if (wasDismissedRecently()) return true;
    if (wasShownThisSession()) return true;
    if (
      SUPPRESS_PATHS.some(
        (p) => pathname === p || pathname?.startsWith(p + '/'),
      )
    ) {
      return true;
    }
    return false;
  }, [pathname]);

  const showSheet = useCallback(
    (manual = false) => {
      if (!manual && shouldSuppress()) return;
      const ios = isIOS();
      // Non-iOS with no native prompt ready → nothing to show.
      if (!manual && !ios && !_deferredPrompt) return;
      setIosVariant(ios);
      setOpen(true);
      markShownThisSession();
    },
    [shouldSuppress],
  );

  // Manual trigger via `triggerInstallPrompt()`
  useEffect(() => {
    const handler = () => showSheet(true);
    window.addEventListener('admerce:open-install-prompt', handler);
    return () =>
      window.removeEventListener('admerce:open-install-prompt', handler);
  }, [showSheet]);

  // Auto trigger: 12s OR 500px scroll, whichever comes first.
  useEffect(() => {
    if (!mounted) return;
    if (shouldSuppress()) return;

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      showSheet();
    };

    const timer = setTimeout(fire, AUTO_TRIGGER_MS);
    const onScroll = () => {
      if (window.scrollY >= SCROLL_TRIGGER_PX) fire();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [mounted, shouldSuppress, showSheet]);

  const handleInstall = async () => {
    if (iosVariant) return;
    if (!_deferredPrompt) return;
    setInstalling(true);
    try {
      await _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      _deferredPrompt = null;
      setNativeAvailable(false);
      if (outcome === 'accepted') {
        setOpen(false);
      } else {
        markDismissed();
        setOpen(false);
      }
    } catch {
      _deferredPrompt = null;
      setOpen(false);
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setOpen(false);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={handleDismiss}
            style={styles.backdrop}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Install Admerce"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={styles.sheet}
          >
            <div style={styles.handle} />

            <button
              onClick={handleDismiss}
              style={styles.closeBtn}
              aria-label="Close"
            >
              <MdClose size={18} color="#64748B" />
            </button>

            <div style={styles.heroWrap}>
              <div className="iap-glow" aria-hidden />
              <div style={styles.iconBox}>
                {/* The icon we just deployed as part of the manifest */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/android-chrome-192x192.png"
                  alt=""
                  width={64}
                  height={64}
                  style={styles.iconImg}
                />
              </div>
            </div>

            <h2 style={styles.title}>Install Admerce</h2>
            <p style={styles.body}>
              {iosVariant
                ? 'Add Admerce to your home screen for a faster, full-screen experience.'
                : 'Faster launches, offline browsing, and one-tap access to nearby stores.'}
            </p>

            {iosVariant && (
              <div style={styles.iosSteps}>
                <div style={styles.iosStep}>
                  <span style={styles.iosStepNum}>1</span>
                  <span style={styles.iosStepText}>
                    Tap the{' '}
                    <span style={styles.iosInlineIcon}>
                      <MdIosShare size={15} color="#0504AA" />
                    </span>{' '}
                    Share button at the bottom of Safari
                  </span>
                </div>
                <div style={styles.iosStep}>
                  <span style={styles.iosStepNum}>2</span>
                  <span style={styles.iosStepText}>
                    Scroll and tap{' '}
                    <span style={styles.iosInlineIcon}>
                      <MdAddBox size={15} color="#0504AA" />
                    </span>{' '}
                    <strong>Add to Home Screen</strong>
                  </span>
                </div>
                <div style={styles.iosStep}>
                  <span style={styles.iosStepNum}>3</span>
                  <span style={styles.iosStepText}>
                    Tap <strong>Add</strong> — the app will appear on your
                    home screen
                  </span>
                </div>
              </div>
            )}

            {!iosVariant && (
              <>
                <button
                  onClick={handleInstall}
                  disabled={installing || !nativeAvailable}
                  className="iap-primary"
                  style={{
                    ...styles.primaryBtn,
                    opacity:
                      installing || !nativeAvailable ? 0.5 : 1,
                    cursor: installing
                      ? 'wait'
                      : !nativeAvailable
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  <MdDownload size={20} color="#fff" />
                  <span>
                    {installing ? 'Installing…' : 'Install app'}
                  </span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="iap-secondary"
                  style={styles.secondaryBtn}
                >
                  Maybe later
                </button>
              </>
            )}

            {iosVariant && (
              <button
                onClick={handleDismiss}
                className="iap-primary"
                style={styles.primaryBtn}
              >
                <span>Got it</span>
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── Keyframes (once) ─────────────────────────────────────────────
if (
  typeof document !== 'undefined' &&
  !document.getElementById('iap-keyframes')
) {
  const s = document.createElement('style');
  s.id = 'iap-keyframes';
  s.textContent = `
    @keyframes iapPulse {
      0%, 100% { transform: scale(1);    opacity: 0.45; }
      50%      { transform: scale(1.15); opacity: 0.75; }
    }
    .iap-glow {
      position: absolute;
      inset: -14px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(5,4,170,0.28) 0%,
        rgba(5,4,170,0.06) 45%,
        rgba(5,4,170,0) 70%
      );
      animation: iapPulse 3.4s ease-in-out infinite;
      pointer-events: none;
    }
    .iap-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 12px 26px rgba(5,4,170,0.32);
    }
    .iap-primary:active:not(:disabled) {
      transform: translateY(0) scale(0.985);
    }
    .iap-secondary:hover {
      background-color: #F6F7FB;
    }
    @media (prefers-reduced-motion: reduce) {
      .iap-glow { animation: none !important; }
    }
  `;
  document.head.appendChild(s);
}

// ─── Styles ───────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(11,11,26,0.5)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 9990,
  },
  sheet: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: 480,
    margin: '0 auto',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: '10px 24px calc(28px + env(safe-area-inset-bottom))',
    boxShadow: '0 -20px 60px rgba(15,23,42,0.24)',
    zIndex: 9991,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginBottom: 18,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 12,
    border: 'none',
    background: '#F6F7FB',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    position: 'relative',
    width: 96,
    height: 96,
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    position: 'relative',
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow:
      '0 12px 32px rgba(5,4,170,0.20), 0 2px 6px rgba(15,23,42,0.06)',
    overflow: 'hidden',
  },
  iconImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 14,
    color: '#5A6178',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 1.55,
    maxWidth: 320,
  },
  primaryBtn: {
    width: '100%',
    padding: '15px 20px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: '0 10px 24px rgba(5,4,170,0.28)',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    transition: 'transform 0.15s, box-shadow 0.2s, opacity 0.15s',
  },
  secondaryBtn: {
    width: '100%',
    padding: '13px 20px',
    marginTop: 8,
    borderRadius: 14,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748B',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  iosSteps: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 22,
    textAlign: 'left',
  },
  iosStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 12px',
    backgroundColor: '#F8FAFC',
    border: '1px solid #EEF0F7',
    borderRadius: 12,
  },
  iosStepNum: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    fontSize: 12,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosStepText: {
    fontSize: 13.5,
    color: '#0B0B1A',
    lineHeight: 1.5,
    fontWeight: 500,
  },
  iosInlineIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#EEF0FF',
    verticalAlign: 'middle',
    margin: '0 2px',
  },
};