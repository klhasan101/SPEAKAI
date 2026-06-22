'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, ArrowLeft, Settings, Check, X, Key } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

interface HeaderProps {
  showBackButton?: boolean;
  backHref?: string;
  title?: string;
}

export default function Header({ showBackButton = false, backHref, title }: HeaderProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'cleared'>('idle');

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('shadowspeak_custom_api_key') || '';
    setCustomKey(saved);
    const savedModel = localStorage.getItem('shadowspeak_gemini_model') || 'gemini-3.5-flash';
    setSelectedModel(savedModel);
  }, []);

  const handleSaveSettings = () => {
    if (typeof window !== 'undefined') {
      if (customKey.trim()) {
        localStorage.setItem('shadowspeak_custom_api_key', customKey.trim());
      } else {
        localStorage.removeItem('shadowspeak_custom_api_key');
      }
      localStorage.setItem('shadowspeak_gemini_model', selectedModel);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const handleClearSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('shadowspeak_custom_api_key');
      localStorage.removeItem('shadowspeak_gemini_model');
      setCustomKey('');
      setSelectedModel('gemini-3.5-flash');
      setSaveStatus('cleared');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

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
    <>
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
              {/* Settings Toggle */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-all duration-200 shadow-sm animate-none"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Settings Modal Dialog Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                {t('settingsTitle')}
              </h3>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setSaveStatus('idle');
                }}
                className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 py-2">
              {/* Language Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  {t('selectLanguage')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all duration-200 ${
                      lang === 'en'
                        ? 'bg-primary border-primary text-primary-foreground shadow-md'
                        : 'bg-background border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('ar')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all duration-200 ${
                      lang === 'ar'
                        ? 'bg-primary border-primary text-primary-foreground shadow-md'
                        : 'bg-background border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    العربية
                  </button>
                </div>
              </div>

              {/* Theme Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  {t('selectTheme')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center gap-2 ${
                      resolvedTheme === 'light'
                        ? 'bg-primary border-primary text-primary-foreground shadow-md'
                        : 'bg-background border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    {t('themeLight')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center gap-2 ${
                      resolvedTheme === 'dark'
                        ? 'bg-primary border-primary text-primary-foreground shadow-md'
                        : 'bg-background border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    {t('themeDark')}
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  {t('selectModel')}
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs outline-none focus:border-primary transition-all font-semibold"
                >
                  <option value="gemini-3.5-flash">
                    gemini-3.5-flash ({t('modelRecommended')})
                  </option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                </select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-primary" />
                  {t('customApiKeyLabel')}
                </label>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  {t('customApiKeyDesc')}
                </p>
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder={t('customApiKeyPlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all font-mono"
                />
              </div>

              {saveStatus !== 'idle' && (
                <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  saveStatus === 'saved'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                }`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>{saveStatus === 'saved' ? t('settingsSaved') : t('settingsCleared')}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClearSettings}
                className="flex-1 py-3 text-xs font-semibold rounded-2xl border border-border hover:bg-muted text-foreground active:scale-[0.98] transition-all"
              >
                {t('clearBtn')}
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all shadow-md"
              >
                {t('saveBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
