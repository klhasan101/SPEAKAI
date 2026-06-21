'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Lang, translations } from '@/lib/lang';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: keyof typeof translations['en'], replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('shadowspeak_lang') as Lang;
    if (saved === 'en' || saved === 'ar') {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('shadowspeak_lang', newLang);
  };

  const t = (key: keyof typeof translations['en'], replacements?: Record<string, string | number>) => {
    let text = translations[lang][key] || translations['en'][key] || '';
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  // Prevent layout shifts during hydration by using English as fallback
  const currentLang = mounted ? lang : 'en';

  return (
    <LanguageContext.Provider value={{ lang: currentLang, setLang, t }}>
      <div 
        dir={currentLang === 'ar' ? 'rtl' : 'ltr'} 
        className={currentLang === 'ar' ? 'font-sans text-right' : 'font-sans text-left'}
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
