'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ─────────────────────────────────────────────────────────
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** What the user chose — system | light | dark */
  theme: ThemePreference;
  /** What's actually rendering right now — light | dark */
  resolvedTheme: ResolvedTheme;
  /** Change the preference. Persists to localStorage + <html data-theme>. */
  setTheme: (theme: ThemePreference) => void;
  /** Toggle between light and dark (ignores system). */
  toggle: () => void;
}

const STORAGE_KEY = 'admerce_theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Helpers ───────────────────────────────────────────────────────
function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // localStorage blocked; fall through
  }
  return 'system';
}

function systemPrefers(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
}

// ─── Provider ──────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    readStoredTheme(),
  );
  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>(() =>
    systemPrefers(),
  );

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? systemPreference : theme;

  // React to system preference changes when theme === 'system'
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (theme !== 'system') return;

    let mql: MediaQueryList;
    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }

    const handler = () => {
      const next: ResolvedTheme = mql.matches ? 'dark' : 'light';
      setSystemPreference(next);
      applyTheme(next);
    };

    handler();

    // Attach listener across browsers
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else if (typeof mql.addListener === 'function') {
      // Safari < 14 fallback
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
    return undefined;
  }, [theme]);

  // Apply `data-theme` whenever the effective theme changes.
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage blocked — in-memory only
    }
  }, []);

  const toggle = useCallback(() => {
    // Toggle ignores 'system'. Snap to the opposite of what's rendering now.
    const current: ResolvedTheme =
      theme === 'system' ? systemPreference : theme;
    const next: ResolvedTheme = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [systemPreference, theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside a <ThemeProvider>');
  }
  return ctx;
}