import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { getI18n } from '@/lib/i18n';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'JivaHQ Clinical Intake',
  description:
    'Conversational clinical intake with adaptive SOCRATES questioning and draft physician summaries.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const { language, locale, messages } = await getI18n();

  return (
    <html
      lang={language.intl}
      className={cn('h-full', 'antialiased', 'font-sans', inter.variable, 'font-serif')}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider locale={locale} messages={messages}>
            <TooltipProvider>{children}</TooltipProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
