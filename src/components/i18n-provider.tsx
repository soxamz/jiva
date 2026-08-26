'use client';

import { createContext, useContext } from 'react';

import { type Locale, type MessageKey, type Messages, translate } from '@/lib/i18n-client';

type I18nContextValue = {
  locale: Locale;
  messages: Messages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  locale,
  messages,
}: I18nContextValue & { children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider.');
  }

  return {
    ...context,
    t: (key: MessageKey, values?: Record<string, string | number>) =>
      translate(context.locale, context.messages, key, values),
  };
}
