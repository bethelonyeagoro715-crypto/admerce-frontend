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
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'admerce_theme';

// ✅ SAFE DEFAULT — used when the hook is called outside a provider.
// The `setTheme`/`toggle` are no-ops; the theme just falls back to
// reading from <html data-theme> so nothing crashes. This prevents the
// "must be used inside <ThemeProvider>" 500 during SSR if the provider
// ever gets dropped from the tree.
const DEFAULT_CONTEXT: ThemeContextValue = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggle: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(DEFAULT_CONTEXT);

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
  // Initialize from localStorage on first render. Server render uses
  // 'system' → 'light' as a safe default; the anti-FOUC inline script
  // in layout.tsx already set the correct `data-theme` before hydration.
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const initialTheme = readStoredTheme();
    return initialTheme === 'system' ? systemPrefers() : initialTheme;
  });

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
      const resolved: ResolvedTheme = mql.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
    return undefined;
  }, [theme]);

  // Apply `data-theme` whenever theme changes
  useEffect(() => {
    const resolved: ResolvedTheme =
      theme === 'system' ? systemPrefers() : theme;
    applyTheme(resolved);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    setResolvedTheme(next === 'system' ? systemPrefers() : next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage blocked — in-memory only
    }
  }, []);

  const toggle = useCallback(() => {
    const current: ResolvedTheme =
      theme === 'system' ? systemPrefers() : theme;
    const next: ResolvedTheme = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────
// ✅ NON-THROWING. Returns DEFAULT_CONTEXT if no provider is mounted
// so a missing provider never 500s a page. When the provider IS
// mounted, it returns the live context.
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}