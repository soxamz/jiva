export const languages = [
  { code: 'en', intl: 'en-IN', label: 'English', nativeLabel: 'English' },
  { code: 'hi', intl: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'or', intl: 'or-IN', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ' },
  { code: 'bn', intl: 'bn-IN', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'te', intl: 'te-IN', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'ta', intl: 'ta-IN', label: 'Tamil', nativeLabel: 'தமிழ்' },
] as const;

export type Locale = (typeof languages)[number]['code'];

export type Messages = Record<string, string>;
export type MessageKey = keyof Messages;

export function translate(
  _locale: Locale,
  messages: Messages,
  key: MessageKey,
  values: Record<string, string | number> = {}
) {
  return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name] ?? `{${name}}`)
  );
}
