import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'orbislink-theme';

const applyTheme = (t: Theme) => {
  const root = document.documentElement;
  if (t === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  root.style.colorScheme = t;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    applyTheme(theme);
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark')), []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for components rendered outside provider (shouldn't happen, but safe)
    return {
      theme: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      toggle: () => {
        const isDark = document.documentElement.classList.toggle('dark');
        try { localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light'); } catch {}
      },
      setTheme: (t) => applyTheme(t),
    };
  }
  return ctx;
};
