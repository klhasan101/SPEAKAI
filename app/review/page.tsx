'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronRight, CheckCircle2, BookOpen } from 'lucide-react';
import Header from '@/components/Header';
import { getDueToday } from '@/lib/spaced-repetition';
import { type SentenceProgress } from '@/lib/db';
import { useLanguage } from '@/context/LanguageContext';
import { AMERICAN_PHRASES, AMERICAN_PARAGRAPHS } from '@/lib/sentences';

// Helper: look up sentence text from the static bank by ID
function getSentenceText(id: string): { text: string; category: string } | null {
  const all = [...AMERICAN_PHRASES, ...AMERICAN_PARAGRAPHS];
  const found = all.find((s) => s.id === id);
  return found ? { text: found.text, category: found.category } : null;
}

function ScoreBadge({ score }: { score: number }) {
  const colorClass =
    score >= 85
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : score >= 60
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
      : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
      {score}%
    </span>
  );
}

function CategoryChip({ category }: { category: string }) {
  const label = category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
      {label}
    </span>
  );
}

interface ReviewItem {
  progress: SentenceProgress;
  text: string;
  category: string;
}

export default function ReviewPage() {
  const { lang, t } = useLanguage();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const due = await getDueToday();
        const enriched: ReviewItem[] = due
          .map((p) => {
            const info = getSentenceText(p.sentenceId);
            if (!info) return null;
            return { progress: p, text: info.text, category: info.category };
          })
          .filter(Boolean) as ReviewItem[];
        setItems(enriched);
      } catch (e) {
        console.error('Failed to load review items:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Header showBackButton backHref="/" title={t('reviewTitle')} />

      {/* Scrollable body */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto min-h-0">
        {/* Header summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-primary/10 blur-xl pointer-events-none" />
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground">{t('reviewTitle')}</h1>
            {!loading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('reviewCount').replace('{n}', String(items.length))}
              </p>
            )}
          </div>
        </motion.div>

        {loading ? (
          /* Loading skeleton */
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3.5 animate-pulse">
                <div className="h-3 bg-muted rounded w-3/4 mb-2.5" />
                <div className="h-2.5 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          /* Empty state */
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, type: 'spring', stiffness: 200, damping: 22 }}
              className="flex-1 flex flex-col items-center justify-center gap-4 py-12 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </motion.div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t('reviewEmpty')}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          /* Review list */
          <div className="space-y-2.5">
            {items.map((item, idx) => (
              <motion.div
                key={item.progress.sentenceId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                className="rounded-xl border border-border bg-card p-3.5 flex items-start gap-3 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-normal line-clamp-2" dir="ltr">
                    {item.text}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <CategoryChip category={item.category} />
                    <span className="text-[9px] text-muted-foreground">{t('lastScore')}:</span>
                    <ScoreBadge score={item.progress.lastScore} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Start Review CTA (Pinned Footer) */}
      {!loading && items.length > 0 && (
        <div className="flex-shrink-0 bg-background border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col">
          <Link href="/practice">
            <button className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-md cursor-pointer text-sm">
              <BookOpen className="w-4 h-4" />
              {t('reviewStart')}
              <ChevronRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
