'use client';

import { GlobeIcon } from 'lucide-react';
import { useTransition } from 'react';

import { setLocaleAction } from '@/lib/actions';
import { languages, type Locale } from '@/lib/i18n-client';
import { useI18n } from '@/components/i18n-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguageToggle() {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const selectedLanguage = languages.find((language) => language.code === locale) ?? languages[0];

  function changeLocale(value: string) {
    startTransition(async () => {
      await setLocaleAction(value as Locale);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={t('language.choose')} disabled={pending} size="sm" variant="outline">
            <GlobeIcon data-icon="inline-start" aria-hidden />
            <span className="hidden sm:inline">{selectedLanguage.nativeLabel}</span>
            <span className="sm:hidden">{selectedLanguage.code.toUpperCase()}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuRadioGroup onValueChange={changeLocale} value={locale}>
          {languages.map((language) => (
            <DropdownMenuRadioItem key={language.code} value={language.code}>
              {language.nativeLabel}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
