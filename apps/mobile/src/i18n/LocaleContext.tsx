import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, translations, type Locale, type TranslationKey } from './translations';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * App-wide UI language. Changing `locale` re-renders every consumer of
 * `useTranslation` immediately — no reload, no waiting on the network — which
 * is what #7's "a language change applies immediately across the whole UI"
 * acceptance criterion needs. Persisting the choice is a separate step (the
 * profile screen PATCHes `locale` to the backend); this context only
 * controls what's on screen right now.
 *
 * Only UI chrome strings are covered here. Localized *interpretation* text
 * for calculation results is #18 (multilingual interpretation text) and is
 * not wired up yet.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  const t = useCallback(
    (key: TranslationKey) => translations[locale][key] ?? translations[DEFAULT_LOCALE][key] ?? key,
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useTranslation must be used within a LocaleProvider');
  return ctx;
}
