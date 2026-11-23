import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'agrilink-theme';

const applyTheme = (t: Theme) => {
  const root = document.documentElement;
  root.classList.remove('dark');
  root.style.colorScheme = 'light';
  root.style.background = '#f7f9f7';
  document.body.style.background = '#f7f9f7';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light') return 'light';
    return 'light';
  });

  useEffect(() => {
    applyTheme(theme);
    try { window.localStorage.setItem(STORAGE_KEY, 'light'); } catch {}
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
