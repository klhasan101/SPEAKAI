'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Flame, Clock, Award, Home, RotateCcw, CheckCircle2, ChevronDown, ChevronUp, Loader2, AlertTriangle } from 'lucide-react';
import Header from '@/components/Header';
import { db, Attempt, PhonemeIssue } from '@/lib/db';
import { recordSessionCompletion, Streak } from '@/lib/streak';
import { useLanguage } from '@/context/LanguageContext';

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startParam = searchParams.get('start');
  const { lang, t } = useLanguage();

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [durationStr, setDurationStr] = useState<string>('00:00');
  const [streak, setStreak] = useState<Streak | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  // Weakness tracking state (V2 Task 9)
  const [topWeaknesses, setTopWeaknesses] = useState<PhonemeIssue[]>([]);

  useEffect(() => {
    // Trigger confetti burst on mount
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Handle streak update immediately
    const updatedStreak = recordSessionCompletion();
    setStreak(updatedStreak);

    // Fetch session attempts
    async function loadSessionData() {
      if (!startParam) return;
      const startTime = parseInt(startParam, 10);
      if (isNaN(startTime)) return;

      try {
        // Query attempts logged during this session
        const sessionAttempts = await db.attempts
          .where('timestamp')
          .aboveOrEqual(startTime)
          .toArray();

        // Sort chronologically
        sessionAttempts.sort((a, b) => a.timestamp - b.timestamp);
        setAttempts(sessionAttempts);

        if (sessionAttempts.length > 0) {
          const totalScore = sessionAttempts.reduce((sum, att) => sum + att.score, 0);
          setAvgScore(Math.round(totalScore / sessionAttempts.length));
        }

        // Calculate duration
        const elapsedMs = Date.now() - startTime;
        const totalSecs = Math.max(Math.round(elapsedMs / 1000), 1);
        const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const secs = String(totalSecs % 60).padStart(2, '0');
        setDurationStr(`${mins}:${secs}`);

        // Fetch top 3 weaknesses from database history (V2 Task 9)
        const allIssues = await db.phonemeIssues.toArray();
        allIssues.sort((a, b) => b.count - a.count);
        setTopWeaknesses(allIssues.slice(0, 3));

      } catch (err) {
        console.error('Failed to load session results:', err);
      }
    }

    loadSessionData();
  }, [startParam]);

  // Motivational copy logic
  const getMotivationalContent = (score: number) => {
    if (score >= 85) {
      return {
        tag: t('nativeGrade'),
        desc: t('nativeGradeDesc'),
        color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
      };
    } else if (score >= 70) {
      return {
        tag: t('clearArtic'),
        desc: t('clearArticDesc'),
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      };
    } else {
      return {
        tag: t('keepPractice'),
        desc: t('keepPracticeDesc'),
        color: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
      };
    }
  };

  const finalScore = avgScore !== null ? avgScore : 0;
  const motivation = getMotivationalContent(finalScore);

  return (
    <div className="flex-1 flex flex-col bg-background">
      <Header title={t('sessionComplete')} />

      <div className="flex-1 px-6 py-6 flex flex-col gap-6">
        
        {/* Confetti & Trophy Section */}
        <div className="flex flex-col items-center text-center py-4">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4"
          >
            <Award className="w-10 h-10" />
          </motion.div>
          <h1 className="text-2xl font-black text-foreground">{t('sessionComplete')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('sessionDesc')}</p>
        </div>

        {/* Aggregated Analytics Score & Streak */}
        <div className="grid grid-cols-3 gap-3">
          {/* Average Score */}
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t('avgScoreLabel')}</span>
            <span className="text-2xl font-extrabold text-foreground mt-1">
              {avgScore !== null ? `${avgScore}%` : '—'}
            </span>
          </div>

          {/* Time spent */}
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              {t('time')}
            </div>
            <span className="text-2xl font-extrabold text-foreground mt-1">{durationStr}</span>
          </div>

          {/* Streak */}
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              {t('streak').split(' ')[0]}
            </div>
            <span className="text-2xl font-extrabold text-foreground mt-1">
              {streak ? `${streak.currentStreak}${t('day').slice(0, 1)}` : '—'}
            </span>
          </div>
        </div>

        {/* Contextual Motivational Banner */}
        <div className={`p-5 rounded-3xl border ${motivation.color} flex flex-col gap-2`}>
          <span className="text-sm font-extrabold tracking-tight">{motivation.tag}</span>
          <p className="text-xs opacity-90 leading-relaxed">{motivation.desc}</p>
        </div>

        {/* V2 Task 9: Phoneme Weaknesses Summary Widget */}
        {topWeaknesses.length > 0 && (
          <div className="rounded-3xl border border-border bg-card p-5 flex flex-col gap-3 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-destructive/5 blur-xl pointer-events-none" />
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-extrabold text-foreground">{t('weaknessesTitle')}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t('weaknessesDesc')}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {topWeaknesses.map((issue) => (
                <span
                  key={issue.word}
                  className="px-3.5 py-1.5 rounded-2xl bg-destructive/10 text-destructive text-xs font-bold flex items-center gap-1.5 border border-destructive/20"
                >
                  <span className="font-extrabold select-all">{issue.word}</span>
                  <span className={`opacity-60 text-[10px] font-medium ${lang === 'ar' ? 'border-r pr-1.5 mr-1.5' : 'border-l pl-1.5 ml-1.5'} border-destructive/30`}>
                    {t('timesMispronounced', { count: issue.count })}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Practice Attempts Breakdown */}
        {attempts.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-foreground px-1">{t('sessionLog')} ({attempts.length})</h2>
            
            <div className="flex flex-col gap-2">
              {attempts.map((att, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <div
                    key={att.id || index}
                    className="rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200"
                  >
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 pr-2">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          att.score >= 85
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : att.score >= 70
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-blue-500/10 text-blue-500'
                        }`}>
                          {att.score}
                        </span>
                        <p dir="ltr" className="text-sm font-medium text-foreground truncate max-w-[200px] md:max-w-[240px]">
                          {att.sentenceText}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/20 flex flex-col gap-2 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-500 select-none">🟢</span>
                          <p className="text-foreground font-medium">
                            <strong className="text-emerald-500 font-bold block text-[10px] uppercase tracking-wide">{t('praiseLabel')}</strong>
                            {att.feedbackPositive}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-blue-500 select-none">🔵</span>
                          <p className="text-foreground font-medium">
                            <strong className="text-blue-500 font-bold block text-[10px] uppercase tracking-wide">{t('correctionLabel')}</strong>
                            {att.feedbackImprovement}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-[4rem]" />
      </div>

      {/* Sticky Bottom Actions */}
      <div className="sticky bottom-0 bg-background/90 backdrop-blur-md border-t border-border px-6 py-4 grid grid-cols-2 gap-4 mt-auto">
        <Link href="/">
          <button className="w-full py-4 border border-border bg-card text-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-muted active:scale-[0.98] transition-all">
            <Home className="w-4 h-4" />
            {t('home')}
          </button>
        </Link>
        <Link href="/practice">
          <button className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-md">
            <RotateCcw className="w-4 h-4" />
            {t('restart')}
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function SessionCompletionMetrics() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Generating results summary...</span>
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
