import type { Metadata } from 'next';
import { Geist, Geist_Mono, Inter, Lora } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { getI18n } from '@/lib/i18n';

const lora = Lora({ subsets: ['latin'], variable: '--font-serif' });

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'JivaHQ',
  description: 'Digital health vault and clinical intake prototype',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const { language, locale, messages } = await getI18n();

  return (
    <html
      lang={language.intl}
      className={cn(
        'h-full',
        'antialiased',
        geistSans.variable,
        geistMono.variable,
        'font-sans',
        inter.variable,
        'font-serif',
        lora.variable
      )}
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
