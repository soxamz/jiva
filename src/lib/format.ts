import type { Locale } from '@/lib/i18n-client';

const intlLocales: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  or: 'or-IN',
  bn: 'bn-IN',
  te: 'te-IN',
  ta: 'ta-IN',
};

export function formatDateTime(date: Date, locale: Locale = 'en') {
  return new Intl.DateTimeFormat(intlLocales[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDate(date: Date, locale: Locale = 'en') {
  return new Intl.DateTimeFormat(intlLocales[locale], {
    dateStyle: 'medium',
  }).format(date);
}

export function minutesUntil(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 60000));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
