'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ArrowRight, Play, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import { useLanguage } from '@/context/LanguageContext';
import { db, YoutubeVideo } from '@/lib/db';

interface VideoStats {
  completed: number;
  total: number;
  avgScore: number;
}

export default function YoutubeDashboard() {
  const router = useRouter();
  const { lang, t } = useLanguage();

  const [url, setUrl] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [stats, setStats] = useState<Record<string, VideoStats>>({});

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const allVideos = await db.youtubeVideos.orderBy('addedAt').reverse().toArray();
      setVideos(allVideos);

      // Load progress stats for each video
      const statsMap: Record<string, VideoStats> = {};
      for (const video of allVideos) {
        const lessons = await db.youtubeLessons.where({ youtubeId: video.youtubeId }).toArray();
        const total = lessons.length;
        
        let completed = 0;
        let totalScore = 0;
        let attemptsCount = 0;

        for (const lesson of lessons) {
          const attempts = await db.attempts.where({ sentenceId: lesson.id }).toArray();
          if (attempts.length > 0) {
            completed++;
            const bestScore = Math.max(...attempts.map(a => a.score));
            totalScore += bestScore;
            attemptsCount++;
          }
        }

        statsMap[video.youtubeId] = {
          completed,
          total,
          avgScore: attemptsCount > 0 ? Math.round(totalScore / attemptsCount) : 0,
        };
      }
      setStats(statsMap);
    } catch (e) {
      console.error('Failed to load videos from Dexie:', e);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/youtube/fetch-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, difficulty }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || t('unknownError'));
      }

      const data = await res.json();
      const { video, lessons } = data;

      // Save to local Dexie database
      await db.youtubeVideos.put({
        ...video,
        addedAt: Date.now(),
      });

      await db.youtubeLessons.bulkPut(lessons);

      setUrl('');
      await loadVideos();

      // Automatically navigate to practice page
      router.push(`/youtube/practice?id=${video.youtubeId}`);
    } catch (err: any) {
      setErrorMsg(err.message || t('unknownError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (youtubeId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering navigation
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا الفيديو وجميع محاولاته؟' : 'Are you sure you want to delete this video and all of its attempts?')) {
      try {
        await db.youtubeVideos.delete(youtubeId);
        
        // Find and delete lessons & attempts
        const lessons = await db.youtubeLessons.where({ youtubeId }).toArray();
        const lessonIds = lessons.map(l => l.id);
        
        await db.youtubeLessons.where({ youtubeId }).delete();
        
        for (const lessonId of lessonIds) {
          await db.attempts.where({ sentenceId: lessonId }).delete();
        }

        await loadVideos();
      } catch (err) {
        console.error('Failed to delete video:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans pb-10" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Header showBackButton backHref="/" title={t('youtubeTitle')} />

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
        
        {/* Intro section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sonic-magenta">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 animate-pulse">
              <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.528 3.545 12 3.545 12 3.545s-7.528 0-9.388.51a3.004 3.004 0 0 0-2.11 2.108C0 8.022 0 12 0 12s0 3.978.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.86.51 9.388.51 9.388.51s7.528 0 9.388-.51a3.003 3.003 0 0 0 2.11-2.108C24 15.978 24 12 24 12s0-3.978-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-sonic-magenta to-sonic-cyan bg-clip-text text-transparent">
              {t('youtubeTitle')}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('youtubeDesc')}
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleImport} className="rounded-3xl border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground block">
              {lang === 'ar' ? 'رابط الفيديو' : 'Video URL'}
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('youtubeUrlPlaceholder')}
              className="w-full px-3.5 py-3 rounded-xl border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all"
              disabled={isLoading}
            />
          </div>

          {/* Difficulty selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground block">
              {t('youtubeSelectDifficulty')}
            </label>
            <div className="flex gap-2">
              {(['beginner', 'intermediate', 'advanced'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all duration-200 ${
                    difficulty === diff
                      ? 'bg-primary border-primary text-primary-foreground shadow-md'
                      : 'bg-background border-border text-foreground hover:bg-muted'
                  }`}
                  disabled={isLoading}
                >
                  {t(`diff_${diff}` as any)}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full py-3 bg-sonic-magenta text-white font-bold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('importing')}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>{t('importBtn')}</span>
              </>
            )}
          </button>
        </form>

        {/* Video Library */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sonic-cyan" />
            {t('importedVideos')}
          </h2>

          <AnimatePresence mode="popLayout">
            {videos.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-3xl border border-border border-dashed p-10 flex flex-col items-center justify-center text-center gap-3 bg-muted/20"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-muted-foreground opacity-40">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.528 3.545 12 3.545 12 3.545s-7.528 0-9.388.51a3.004 3.004 0 0 0-2.11 2.108C0 8.022 0 12 0 12s0 3.978.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.86.51 9.388.51 9.388.51s7.528 0 9.388-.51a3.003 3.003 0 0 0 2.11-2.108C24 15.978 24 12 24 12s0-3.978-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  {t('noVideos')}
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-3">
                {videos.map((video) => {
                  const videoStat = stats[video.youtubeId] || { completed: 0, total: 0, avgScore: 0 };
                  const percent = videoStat.total > 0 ? Math.round((videoStat.completed / videoStat.total) * 100) : 0;
                  
                  return (
                    <motion.div
                      key={video.youtubeId}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      onClick={() => router.push(`/youtube/practice?id=${video.youtubeId}`)}
                      className="group rounded-2xl border border-border bg-card hover:border-sonic-cyan hover:shadow-md cursor-pointer transition-all duration-200 overflow-hidden flex"
                    >
                      {/* Video Thumbnail */}
                      <div className="w-24 relative aspect-video sm:w-28 flex-shrink-0 bg-muted">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>

                      {/* Video Info */}
                      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-sonic-magenta transition-colors">
                              {video.title}
                            </h3>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {video.channelName} • {t('videoDuration').replace('{n}', String(video.duration))}
                            </p>
                          </div>
                          
                          {/* Delete Button */}
                          <button
                            onClick={(e) => handleDelete(video.youtubeId, e)}
                            className="p-1 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                            aria-label="Delete Video"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Progress Bar & Stats */}
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground font-semibold">
                            <span>
                              {t('completedSentences')
                                .replace('{completed}', String(videoStat.completed))
                                .replace('{total}', String(videoStat.total))}
                            </span>
                            {videoStat.completed > 0 && (
                              <span className="text-sonic-cyan">
                                {t('averageScore')}: {videoStat.avgScore}%
                              </span>
                            )}
                          </div>
                          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-sonic-magenta to-sonic-cyan rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
