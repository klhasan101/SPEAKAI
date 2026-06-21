'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

interface HeaderProps {
  showBackButton?: boolean;
  backHref?: string;
  title?: string;
}

export default function Header({ showBackButton = false, backHref, title }: HeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  // Determine back label and header title based on current language
  const backLabel = t('goBack');
  const headerTitle = title || 'ShadowSpeak AI';

  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBackButton && (
          <button
            onClick={handleBack}
            className="p-1.5 rounded-full hover:bg-muted transition-colors flex items-center gap-1 text-xs font-semibold text-foreground"
            aria-label={backLabel}
          >
            {/* Rotate back arrow if direction is RTL */}
            <ArrowLeft className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          </button>
        )}
        <Link href="/" className="flex items-center">
          <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
            {headerTitle}
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {mounted && (
          <>
            {/* Language Switch Toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="px-2.5 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted font-bold text-xs transition-all duration-200 shadow-sm"
              aria-label="Switch Language"
            >
              {lang === 'en' ? 'العربية' : 'English'}
            </button>

            {/* Dark/Light Toggle */}
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-all duration-200 shadow-sm"
              aria-label="Toggle dark/light theme"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500 animate-pulse" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
