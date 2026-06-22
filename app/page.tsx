'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Play, Flame, Award, ChevronRight, BarChart2, BookOpen } from 'lucide-react';
import Header from '@/components/Header';
import { checkStreakValidity, Streak } from '@/lib/streak';
import { db } from '@/lib/db';
import { useLanguage } from '@/context/LanguageContext';
import { getDueTodayCount } from '@/lib/spaced-repetition';

interface ChartDay {
  name: string;
  fullDate: string;
  count: number;
}

export default function HomeDashboard() {
  const { lang, t } = useLanguage();
  const [streak, setStreak] = useState<Streak>({ currentStreak: 0, longestStreak: 0, lastActiveDate: '' });
  const [last7Days, setLast7Days] = useState<ChartDay[]>([]);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    // 1. Verify and update streak on load
    const currentStreakData = checkStreakValidity();
    setStreak(currentStreakData);

    // 2. Fetch history from IndexedDB
    async function loadHistory() {
      try {
        const allAttempts = await db.attempts.toArray();
        setTotalAttempts(allAttempts.length);

        if (allAttempts.length > 0) {
          const totalScore = allAttempts.reduce((sum, att) => sum + att.score, 0);
          setAverageScore(Math.round(totalScore / allAttempts.length));
        }

        // Generate last 7 days structure
        const days: ChartDay[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' });
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const fullDate = `${year}-${month}-${day}`;
          days.push({ name: dateStr, fullDate, count: 0 });
        }

        // Aggregate attempts per day
        allAttempts.forEach((attempt) => {
          const attemptDate = new Date(attempt.timestamp);
          const year = attemptDate.getFullYear();
          const month = String(attemptDate.getMonth() + 1).padStart(2, '0');
          const day = String(attemptDate.getDate()).padStart(2, '0');
          const attemptDateStr = `${year}-${month}-${day}`;

          const dayObj = days.find((d) => d.fullDate === attemptDateStr);
          if (dayObj) {
            dayObj.count++;
          }
        });

        setLast7Days(days);
      } catch (error) {
        console.error('Failed to load database history:', error);
      }

      // Load review due count
      try {
        const count = await getDueTodayCount();
        setReviewCount(count);
      } catch (e) {
        console.error('Failed to load review count:', e);
      }
    }

    loadHistory();
  }, [lang]); // Reload weekdays formatting if language changes

  const maxCount = Math.max(...last7Days.map((d) => d.count), 1);

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 overflow-hidden">
      <Header />

      {/* Scrollable Dashboard Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {/* Welcome Section */}
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-foreground">{t('welcome')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t('ready')}</p>
        </div>

        {/* Streak Widget: Flame display */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 flex items-center justify-between shadow-sm"
        >
          {/* Background glowing circle for aesthetic depth */}
          <div className="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-amber-500/10 blur-xl dark:bg-amber-500/5 pointer-events-none" />
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl text-amber-500 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <Flame className="w-6 h-6 fill-amber-500 animate-pulse" />
            </div>
            <div>
              <div className="font-display text-lg font-extrabold tracking-tight">
                {streak.currentStreak} {streak.currentStreak === 1 ? t('day') : t('days')}
              </div>
              <div className="text-[10px] text-muted-foreground">{t('streak')}</div>
            </div>
          </div>
          
          <div className={`text-right ${lang === 'ar' ? 'border-r pr-3' : 'border-l pl-3'} border-border`}>
            <div className="font-display text-xs font-bold text-foreground">{streak.longestStreak} {t('days')}</div>
            <div className="text-[10px] text-muted-foreground">{t('longest')}</div>
          </div>
        </motion.div>

        {/* Analytics Summary Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-sonic-cyan/5 blur-md rounded-full pointer-events-none" />
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('totalShadowings')}</div>
            <div className="font-display text-2xl font-black text-foreground mt-0.5">{totalAttempts}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-sonic-magenta/5 blur-md rounded-full pointer-events-none" />
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('avgScore')}</div>
            <div className="font-mono text-2xl font-black text-sonic-magenta mt-0.5">
              {averageScore !== null ? `${averageScore}%` : '—'}
            </div>
          </div>
        </div>

        {/* Spaced Repetition: Review Due Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <Link href="/review">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center gap-3.5 hover:bg-muted/40 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden">
              <div className="absolute right-0 top-0 -mr-6 -mt-6 w-20 h-20 rounded-full bg-sonic-violet/10 blur-xl pointer-events-none" />
              <div className="p-2.5 bg-sonic-violet/15 rounded-xl text-sonic-violet flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.15)]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm font-extrabold text-foreground">{t('reviewDue')}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {reviewCount > 0
                    ? t('reviewCount').replace('{n}', String(reviewCount))
                    : t('reviewEmpty')}
                </div>
              </div>
              {reviewCount > 0 && (
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-sonic-violet text-white text-[10px] font-bold shadow-[0_0_8px_rgba(139,92,246,0.4)] animate-bounce">
                  {reviewCount}
                </span>
              )}
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground ${lang === 'ar' ? 'rotate-180' : ''}`} />
            </div>
          </Link>
        </motion.div>

        {/* Progress Summary: Last 7 Days Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-sonic-cyan" />
              <h2 className="font-display text-xs font-bold text-foreground">{t('weeklyProgress')}</h2>
            </div>
            <span className="text-[10px] text-muted-foreground">{t('attemptsPerDay')}</span>
          </div>

          {/* Bar Chart */}
          <div className="h-24 flex items-end justify-between gap-2 pt-1">
            {last7Days.map((day) => {
              const heightPercent = `${Math.max((day.count / maxCount) * 100, 8)}%`;
              const isToday = day.fullDate === new Date().toISOString().split('T')[0];
              return (
                <div key={day.fullDate} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full relative group flex justify-center">
                    <span className="absolute -top-7 scale-0 group-hover:scale-100 transition-all rounded-md bg-foreground text-background px-1.5 py-0.5 text-[9px] font-semibold">
                      {day.count}
                    </span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: heightPercent }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`w-2.5 rounded-full ${
                        isToday
                          ? 'bg-sonic-magenta shadow-[0_0_8px_rgba(236,72,153,0.5)]'
                          : day.count > 0
                          ? 'bg-sonic-cyan'
                          : 'bg-muted'
                      }`}
                    />
                  </div>
                  <span className={`text-[9px] font-bold ${isToday ? 'text-sonic-magenta' : 'text-muted-foreground'}`}>
                    {day.name}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Motivational Card / Quick Tips */}
        <div className="rounded-2xl bg-neutral-900/50 border border-neutral-800 text-neutral-200 p-4 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
            <Award className="w-20 h-20 text-white" />
          </div>
          <h3 className="font-display text-xs font-bold text-white uppercase tracking-wider">{t('focusTip')}</h3>
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            {t('tipBody')}
          </p>
        </div>

        {/* Practice Categories Section */}
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-xs font-bold text-foreground">{t('categoriesTitle')}</h2>
          <div className="flex overflow-x-auto gap-2.5 pb-1 scrollbar-none">
            {[
              { id: 'daily-conversation', label: t('cat_daily'), image: '/images/categories/daily_conversation.png' },
              { id: 'business', label: t('cat_business'), image: '/images/categories/business.png' },
              { id: 'travel', label: t('cat_travel'), image: '/images/categories/travel.png' },
              { id: 'news', label: t('cat_news'), image: '/images/categories/news.png' },
              { id: 'movies', label: t('cat_movies'), image: '/images/categories/movies.png' },
            ].map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Link href={`/practice?category=${cat.id}`}>
                  <div className="min-w-[90px] flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border bg-card hover:bg-muted transition-all cursor-pointer">
                    <img
                      src={cat.image}
                      alt={cat.label}
                      className="w-11 h-11 rounded-lg object-cover shadow-sm"
                    />
                    <span className="text-[10px] font-bold text-foreground text-center leading-tight truncate w-full">{cat.label}</span>
                    <ChevronRight className={`w-3 h-3 text-muted-foreground ${lang === 'ar' ? 'rotate-180' : ''}`} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur-md border-t border-border px-4 pt-3 pb-safe-lg flex flex-col">
        <Link href="/practice">
          <button className="w-full py-3.5 bg-gradient-to-r from-sonic-magenta to-sonic-violet text-white font-display font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all shadow-[0_4px_12px_rgba(236,72,153,0.25)]">
            <Play className="w-4 h-4 fill-current" />
            {t('startPractice')}
            <ChevronRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          </button>
        </Link>
      </div>
    </div>
  );
}
