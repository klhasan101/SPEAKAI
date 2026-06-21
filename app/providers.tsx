'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { LanguageProvider } from '@/context/LanguageContext';

export function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        // Register service worker in production
        navigator.serviceWorker.register('/sw.js').then(
          (reg) => console.log('Service Worker registered successfully:', reg.scope),
          (err) => console.error('Service Worker registration failed:', err)
        );
      } else {
        // Unregister any active service workers in development to prevent caching issues and loops
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log('Unregistered active Service Worker for development compatibility');
                // Force a single clean reload to ensure the page runs with clean state
                window.location.reload();
              }
            });
          }
        });
      }
    }
  }, []);

  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </NextThemesProvider>
  );
}
