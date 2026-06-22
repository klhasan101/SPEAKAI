'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Play, Flame, Award, ChevronRight, BarChart2 } from 'lucide-react';
import Header from '@/components/Header';
import { checkStreakValidity, Streak } from '@/lib/streak';
import { db } from '@/lib/db';
import { useLanguage } from '@/context/LanguageContext';

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
    }

    loadHistory();
  }, [lang]); // Reload weekdays formatting if language changes

  const maxCount = Math.max(...last7Days.map((d) => d.count), 1);

  return (
    <div className="flex-1 flex flex-col bg-background">
      <Header />

      <div className="flex-1 px-6 py-6 flex flex-col gap-6">
        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('welcome')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('ready')}</p>
        </div>

        {/* Streak Widget: Flame display */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 flex items-center justify-between shadow-sm"
        >
          {/* Background glowing circle for aesthetic depth */}
          <div className="absolute right-0 top-0 -mr-6 -mt-6 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl dark:bg-amber-500/5 pointer-events-none" />
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 rounded-2xl text-amber-500 flex items-center justify-center shadow-inner">
              <Flame className="w-8 h-8 fill-amber-500 animate-bounce" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">
                {streak.currentStreak} {streak.currentStreak === 1 ? t('day') : t('days')}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{t('streak')}</div>
            </div>
          </div>
          
          <div className={`text-right ${lang === 'ar' ? 'border-r pr-4' : 'border-l pl-4'} border-border`}>
            <div className="text-sm font-semibold text-foreground">{streak.longestStreak} {t('days')}</div>
            <div className="text-xs text-muted-foreground">{t('longest')}</div>
          </div>
        </motion.div>

        {/* Analytics Summary Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground font-medium">{t('totalShadowings')}</div>
            <div className="text-xl font-bold text-foreground mt-1">{totalAttempts}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground font-medium">{t('avgScore')}</div>
            <div className="text-xl font-bold text-foreground mt-1">
              {averageScore !== null ? `${averageScore}%` : '—'}
            </div>
          </div>
        </div>

        {/* Progress Summary: Last 7 Days Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-3xl border border-border bg-card p-6 flex flex-col gap-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">{t('weeklyProgress')}</h2>
            </div>
            <span className="text-xs text-muted-foreground">{t('attemptsPerDay')}</span>
          </div>

          {/* Bar Chart */}
          <div className="h-28 flex items-end justify-between gap-2 pt-2">
            {last7Days.map((day) => {
              const heightPercent = `${Math.max((day.count / maxCount) * 100, 8)}%`;
              const isToday = day.fullDate === new Date().toISOString().split('T')[0];
              return (
                <div key={day.fullDate} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative group flex justify-center">
                    {/* Tooltip */}
                    <span className="absolute -top-7 scale-0 group-hover:scale-100 transition-all rounded-md bg-foreground text-background px-1.5 py-0.5 text-[10px] font-semibold">
                      {day.count}
                    </span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: heightPercent }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`w-2.5 rounded-full ${
                        isToday
                          ? 'bg-primary shadow-[0_0_8px_rgba(0,113,227,0.5)]'
                          : day.count > 0
                          ? 'bg-foreground'
                          : 'bg-muted'
                      }`}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {day.name}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Motivational Card / Quick Tips */}
        <div className="rounded-3xl bg-neutral-900 border border-neutral-800 text-neutral-200 p-5 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
            <Award className="w-24 h-24 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-white">{t('focusTip')}</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {t('tipBody')}
          </p>
        </div>

        {/* Spacing to offset the bottom-fixed button */}
        <div className="flex-1 min-h-[4rem]" />
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="sticky bottom-0 bg-background/90 backdrop-blur-md border-t border-border px-6 py-4 mt-auto">
        <Link href="/practice">
          <button className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-md">
            <Play className="w-4 h-4 fill-current" />
            {t('startPractice')}
            <ChevronRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          </button>
        </Link>
      </div>
    </div>
  );
}
