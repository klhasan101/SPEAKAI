'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Flame, Clock, Award, Home, RotateCcw, ChevronDown, ChevronUp, Loader2, AlertTriangle, Trophy, Sparkles, Share2, Check } from 'lucide-react';
import Header from '@/components/Header';
import { db, Attempt, PhonemeIssue, Achievement } from '@/lib/db';
import { recordSessionCompletion, Streak } from '@/lib/streak';
import { useLanguage } from '@/context/LanguageContext';

interface UnlockedAchievementNotify {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

function ResultContent() {
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

  // Achievements States
  const [newAchievements, setNewAchievements] = useState<UnlockedAchievementNotify[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [showNotificationOverlay, setShowNotificationOverlay] = useState<boolean>(false);

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

        // Check achievements (V2 Task 13)
        const totalAttemptsCount = await db.attempts.count();
        const hasPerfectAttempt = (await db.attempts.where('score').aboveOrEqual(95).count()) > 0;
        const currentStreakValue = updatedStreak ? updatedStreak.currentStreak : 0;

        const achievementsToCheck = [
          {
            id: 'first_step',
            titleEn: 'First Step',
            titleAr: 'الخطوة الأولى',
            descriptionEn: 'Completed your first shadowing attempt.',
            descriptionAr: 'أكملت محاولتك الأولى في المحاكاة الصوتية.',
            condition: totalAttemptsCount >= 1
          },
          {
            id: 'perfect_pitch',
            titleEn: 'Perfect Pitch',
            titleAr: 'النغمة المثالية',
            descriptionEn: 'Achieved an accuracy score of 95% or higher.',
            descriptionAr: 'حققت درجة دقة نطق 95% أو أعلى.',
            condition: hasPerfectAttempt
          },
          {
            id: 'super_shadow',
            titleEn: 'Super Shadower',
            titleAr: 'المحاكي الخارق',
            descriptionEn: 'Completed 10 shadowing attempts.',
            descriptionAr: 'أكملت 10 محاولات محاكاة صوتية.',
            condition: totalAttemptsCount >= 10
          },
          {
            id: 'persistence',
            titleEn: 'Streak Starter',
            titleAr: 'بداية الاستمرار',
            descriptionEn: 'Reached a 3-day practice streak.',
            descriptionAr: 'وصلت إلى سلسلة ممارسة لمدة 3 أيام.',
            condition: currentStreakValue >= 3
          },
          {
            id: 'fluent_focus',
            titleEn: 'Fluent Focus',
            titleAr: 'التركيز الطليق',
            descriptionEn: 'Reached a 7-day practice streak.',
            descriptionAr: 'وصلت إلى سلسلة ممارسة لمدة 7 أيام.',
            condition: currentStreakValue >= 7
          }
        ];

        const newlyUnlocked: UnlockedAchievementNotify[] = [];

        for (const ach of achievementsToCheck) {
          if (ach.condition) {
            const existing = await db.achievements.get(ach.id);
            if (!existing) {
              await db.achievements.put({
                id: ach.id,
                titleEn: ach.titleEn,
                titleAr: ach.titleAr,
                descriptionEn: ach.descriptionEn,
                descriptionAr: ach.descriptionAr,
                unlockedAt: Date.now()
              });
              newlyUnlocked.push(ach);
            }
          }
        }

        if (newlyUnlocked.length > 0) {
          setNewAchievements(newlyUnlocked);
          setShowNotificationOverlay(true);
          
          confetti({
            particleCount: 55,
            angle: 60,
            spread: 60,
            origin: { x: 0, y: 0.8 }
          });
          confetti({
            particleCount: 55,
            angle: 120,
            spread: 60,
            origin: { x: 1, y: 0.8 }
          });
        }

        const allUnlocked = await db.achievements.toArray();
        setUnlockedAchievements(allUnlocked);

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

  const [isGeneratingCard, setIsGeneratingCard] = useState<boolean>(false);

  const generateShareCard = () => {
    setIsGeneratingCard(true);
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsGeneratingCard(false);
      return;
    }

    // 1. Draw premium background gradient (Deep slate navy to Royal Violet)
    const gradient = ctx.createLinearGradient(0, 0, 0, 1000);
    gradient.addColorStop(0, '#0f172a'); // slate-900
    gradient.addColorStop(0.5, '#1e1b4b'); // violet-950
    gradient.addColorStop(1, '#020617'); // slate-955
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 1000);

    // 2. Draw glowing aesthetic background accents (fuzzy radial circles)
    const circleGrad = ctx.createRadialGradient(800, 0, 10, 800, 0, 300);
    circleGrad.addColorStop(0, 'rgba(99, 102, 241, 0.15)'); // indigo
    circleGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = circleGrad;
    ctx.beginPath();
    ctx.arc(800, 0, 300, 0, Math.PI * 2);
    ctx.fill();

    const circleGrad2 = ctx.createRadialGradient(0, 1000, 10, 0, 1000, 400);
    circleGrad2.addColorStop(0, 'rgba(168, 85, 247, 0.15)'); // purple
    circleGrad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = circleGrad2;
    ctx.beginPath();
    ctx.arc(0, 1000, 400, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw border card frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 16;
    ctx.strokeRect(20, 20, 760, 960);

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)'; // Indigo accent thin inner border
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, 728, 928);

    // 4. Header: Brand Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SHADOWSPEAK AI', 400, 100);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(lang === 'ar' ? 'بطاقة ممارسة المحاكاة الصوتية' : 'English Shadowing Practice Card', 400, 130);

    // 5. Drawing the main accuracy score circle ring
    const centerX = 400;
    const centerY = 370;
    const radius = 130;

    // Track circle shadow/glow
    ctx.shadowColor = avgScore !== null && avgScore >= 85 ? '#10b981' : avgScore !== null && avgScore >= 70 ? '#f59e0b' : '#3b82f6';
    ctx.shadowBlur = 30;
    
    // Outer track ring background
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 20;
    ctx.stroke();

    // Active progress arc
    ctx.shadowBlur = 0; // reset shadow for core stroke
    ctx.beginPath();
    const startAngle = -Math.PI / 2;
    const scoreVal = avgScore !== null ? avgScore : 0;
    const endAngle = startAngle + (Math.PI * 2 * scoreVal) / 100;
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = scoreVal >= 85 ? '#10b981' : scoreVal >= 70 ? '#f59e0b' : '#3b82f6';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'extrabold 84px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${scoreVal}%`, centerX, centerY - 10);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(lang === 'ar' ? 'درجة النطق' : 'ACOUSTIC SCORE', centerX, centerY + 55);

    // 6. Motivational statement card (drawn in the center bottom)
    const cardY = 570;
    const cardH = 120;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.roundRect(100, cardY, 600, cardH, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const getMotivationText = (score: number) => {
      if (score >= 85) {
        return {
          title: lang === 'ar' ? 'طلاقة بمستوى المتحدث الأصلي' : 'Native-grade fluency',
          desc: lang === 'ar' ? 'نطقك ومخارج الحروف لديك قريبة جداً من اللهجة الأمريكية.' : 'Your articulation closely mimics native American parameters.'
        };
      } else if (score >= 70) {
        return {
          title: lang === 'ar' ? 'نطق واضح ومفهوم' : 'Clear articulation',
          desc: lang === 'ar' ? 'عمل رائع! نطقك واضح. استمر في تلميع التفاصيل الصوتية.' : 'Great work! You have clean phrasing. Keep polishing details.'
        };
      } else {
        return {
          title: lang === 'ar' ? 'استمر في التدرب على الإيقاع' : 'Keep practicing rhythm mechanics',
          desc: lang === 'ar' ? 'واصل التدريب! ركز على نطق حرف الـ R الأمريكي وتدفق الجملة.' : 'Keep at it! Pay attention to rhoticity and smooth pacing.'
        };
      }
    };

    const motiv = getMotivationText(scoreVal);
    ctx.fillStyle = scoreVal >= 85 ? '#34d399' : scoreVal >= 70 ? '#fbbf24' : '#60a5fa';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(motiv.title, 400, cardY + 45);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '500 17px system-ui, -apple-system, sans-serif';
    ctx.fillText(motiv.desc, 400, cardY + 85);

    // 7. Grid with stats: Duration & Streak
    const gridY = 740;
    const col1X = 270;
    const col2X = 530;

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, gridY);
    ctx.lineTo(400, gridY + 110);
    ctx.stroke();

    // Col 1: Duration
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '600 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(lang === 'ar' ? 'وقت التدريب' : 'PRACTICE TIME', col1X, gridY + 25);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
    ctx.fillText(durationStr, col1X, gridY + 85);

    // Col 2: Streak
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '600 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(lang === 'ar' ? 'سلسلة الممارسة' : 'PRACTICE STREAK', col2X, gridY + 25);

    ctx.fillStyle = '#f59e0b'; // Amber streak color
    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
    const streakDays = streak ? streak.currentStreak : 0;
    const streakLabel = lang === 'ar' ? `${streakDays} يوم` : `${streakDays} Days`;
    ctx.fillText(streakLabel, col2X, gridY + 85);

    // 8. Footer info (date & watermark)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '500 16px system-ui, -apple-system, sans-serif';
    const dateStr = new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    ctx.fillText(dateStr, 400, 920);

    // 9. Generate download link and click it
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `ShadowSpeak_Result_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to export canvas to PNG:', e);
    } finally {
      setIsGeneratingCard(false);
    }
  };

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

        {/* V2 Task 13: Local Achievements Widget */}
        <div className="rounded-3xl border border-border bg-card p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500 fill-amber-500/10" />
            <h3 className="text-sm font-extrabold text-foreground">{t('achievementsTitle')}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{t('achievementsDesc')}</p>
          
          <div className="flex flex-col gap-2.5 mt-1">
            {['first_step', 'perfect_pitch', 'super_shadow', 'persistence', 'fluent_focus'].map((id) => {
              const staticMeta = {
                first_step: {
                  title: lang === 'ar' ? 'الخطوة الأولى' : 'First Step',
                  desc: lang === 'ar' ? 'أكملت محاولتك الأولى في المحاكاة الصوتية.' : 'Completed your first shadowing attempt.',
                  icon: Sparkles,
                  color: 'text-sky-500 bg-sky-500/5 dark:bg-sky-500/10 border-sky-500/20'
                },
                perfect_pitch: {
                  title: lang === 'ar' ? 'النغمة المثالية' : 'Perfect Pitch',
                  desc: lang === 'ar' ? 'حققت درجة دقة نطق 95% أو أعلى.' : 'Achieved an accuracy score of 95% or higher.',
                  icon: Trophy,
                  color: 'text-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20'
                },
                super_shadow: {
                  title: lang === 'ar' ? 'المحاكي الخارق' : 'Super Shadower',
                  desc: lang === 'ar' ? 'أكملت 10 محاولات محاكاة صوتية.' : 'Completed 10 shadowing attempts.',
                  icon: Award,
                  color: 'text-purple-500 bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/20'
                },
                persistence: {
                  title: lang === 'ar' ? 'بداية الاستمرار' : 'Streak Starter',
                  desc: lang === 'ar' ? 'وصلت إلى سلسلة ممارسة لمدة 3 أيام.' : 'Reached a 3-day practice streak.',
                  icon: Flame,
                  color: 'text-amber-500 bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20'
                },
                fluent_focus: {
                  title: lang === 'ar' ? 'التركيز الطليق' : 'Fluent Focus',
                  desc: lang === 'ar' ? 'وصلت إلى سلسلة ممارسة لمدة 7 أيام.' : 'Reached a 7-day practice streak.',
                  icon: Flame,
                  color: 'text-rose-500 bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20'
                }
              }[id as 'first_step' | 'perfect_pitch' | 'super_shadow' | 'persistence' | 'fluent_focus'];

              const unlocked = unlockedAchievements.find(a => a.id === id);
              const Icon = staticMeta.icon;

              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                    unlocked
                      ? `${staticMeta.color} opacity-100`
                      : 'bg-card border-border/40 opacity-40 grayscale'
                  }`}
                >
                  <div className={`p-2 rounded-xl bg-background/50 border border-current flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4 fill-current" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h4 className={`text-xs font-bold text-foreground flex items-center gap-1.5 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                      {staticMeta.title}
                      {unlocked && (
                        <span className="text-[8px] px-1 rounded-full bg-emerald-500/15 text-emerald-500 font-extrabold uppercase">
                          {lang === 'ar' ? 'مفتوح' : 'Unlocked'}
                        </span>
                      )}
                    </h4>
                    <p className={`text-[10px] text-muted-foreground mt-0.5 leading-normal truncate ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                      {staticMeta.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
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
      <div className="sticky bottom-0 bg-background/90 backdrop-blur-md border-t border-border px-6 py-4 flex flex-col gap-3 mt-auto">
        <button
          onClick={generateShareCard}
          disabled={isGeneratingCard}
          className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md"
        >
          {isGeneratingCard ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('generatingShareCard')}</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>{t('downloadCard')}</span>
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-4">
          <Link href="/">
            <button className="w-full py-3.5 border border-border bg-card text-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-muted active:scale-[0.98] transition-all">
              <Home className="w-4 h-4" />
              {t('home')}
            </button>
          </Link>
          <Link href="/practice">
            <button className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-md">
              <RotateCcw className="w-4 h-4" />
              {t('restart')}
            </button>
          </Link>
        </div>
      </div>

      {/* Newly Unlocked Achievements Notification Popup Overlay */}
      <AnimatePresence>
        {showNotificationOverlay && newAchievements.length > 0 && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center gap-5 relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
              
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner relative">
                <Trophy className="w-8 h-8 fill-amber-500 animate-bounce" />
                <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1 animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">
                  {t('achievementsUnlockedNotify')}
                </span>
                <h3 className="text-lg font-black text-foreground">
                  {lang === 'ar' ? newAchievements[0].titleAr : newAchievements[0].titleEn}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed px-2">
                  {lang === 'ar' ? newAchievements[0].descriptionAr : newAchievements[0].descriptionEn}
                </p>
              </div>

              <button
                onClick={() => {
                  if (newAchievements.length > 1) {
                    setNewAchievements(prev => prev.slice(1));
                  } else {
                    setShowNotificationOverlay(false);
                  }
                }}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1 shadow-md"
              >
                <Check className="w-4 h-4" />
                {lang === 'ar' ? 'حسناً' : 'Awesome'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
