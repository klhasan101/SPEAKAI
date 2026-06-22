'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Mic, Square, Loader2, Sparkles, AlertCircle, ChevronRight, X, Play, Repeat, Award, ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import Header from '@/components/Header';
import { db, YoutubeVideo, YoutubeLesson } from '@/lib/db';
import { useLanguage } from '@/context/LanguageContext';
import {
  evaluateLocally,
  isSpeechRecognitionSupported,
  startOfflineRecording,
  type OfflineEvaluationResult,
} from '@/lib/offline-evaluator';
import { recordAttempt } from '@/lib/spaced-repetition';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

type AppState = 'IDLE' | 'PLAYING_PROMPT' | 'RECORDING' | 'ANALYZING' | 'FEEDBACK_READY';

interface EvaluationResult {
  score: number;
  feedbackPositive: string;
  feedbackImprovement: string;
  words: { word: string; status: 'correct' | 'mispronounced' | 'missing' }[];
}

function YoutubePracticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();

  const id = searchParams.get('id');

  // Load States
  const [video, setVideo] = useState<YoutubeVideo | null>(null);
  const [lessons, setLessons] = useState<YoutubeLesson[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [appState, setAppState] = useState<AppState>('IDLE');
  
  // YouTube Player States
  const [isPlayerApiReady, setIsPlayerApiReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [loopAudio, setLoopAudio] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0);

  // Audio recording states
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [userAudioBlob, setUserAudioBlob] = useState<Blob | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Offline state
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineController, setOfflineController] = useState<{ stop: () => void } | null>(null);

  // Refs for tracking player and timers
  const playerRef = useRef<any>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentLesson = lessons[currentIndex];

  // Online/offline detection
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, []);

  // 1. Fetch Video and Lesson data from local Dexie
  useEffect(() => {
    if (id) {
      loadVideoData(id);
    }
  }, [id]);

  const loadVideoData = async (videoId: string) => {
    try {
      const v = await db.youtubeVideos.get(videoId);
      if (v) {
        setVideo(v);
        const l = await db.youtubeLessons.where({ youtubeId: videoId }).toArray();
        setLessons(l);
      } else {
        router.push('/youtube');
      }
    } catch (e) {
      console.error('Failed to load video lessons from Dexie:', e);
      router.push('/youtube');
    }
  };

  // 2. Load YouTube API Script
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setIsPlayerApiReady(true);
      };
    } else {
      setIsPlayerApiReady(true);
    }
  }, []);

  // 3. Initialize YouTube Player
  useEffect(() => {
    if (!isPlayerApiReady || !id || playerRef.current || typeof window === 'undefined') return;

    playerRef.current = new window.YT.Player('youtube-player', {
      videoId: id,
      playerVars: {
        playsinline: 1,
        controls: 1,
        rel: 0,
        showinfo: 0,
        modestbranding: 1,
        disablekb: 1,
      },
      events: {
        onReady: () => {
          setIsPlayerReady(true);
        },
        onStateChange: (event: any) => {
          // If user manually pauses the video, clear playback interval and update state
          if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
            if (appState === 'PLAYING_PROMPT') {
              setAppState('IDLE');
            }
            if (playbackTimerRef.current) {
              clearInterval(playbackTimerRef.current);
              playbackTimerRef.current = null;
            }
          }
        }
      }
    });

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [isPlayerApiReady, id]);

  // 4. Update Playback speed reactively
  useEffect(() => {
    if (playerRef.current && isPlayerReady) {
      try {
        playerRef.current.setPlaybackRate(voiceSpeed);
      } catch (e) {
        console.error('Failed to set YouTube playback rate:', e);
      }
    }
  }, [voiceSpeed, isPlayerReady]);

  // Audio cleaning helper
  const cleanupAudio = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    // Pause player
    if (playerRef.current && isPlayerReady) {
      try {
        playerRef.current.pauseVideo();
      } catch (e) {}
    }
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  // Play segment logic
  const playPrompt = () => {
    if (!playerRef.current || !isPlayerReady || !currentLesson) return;

    cleanupAudio();
    setAppState('PLAYING_PROMPT');

    const start = currentLesson.startTime;
    const end = currentLesson.endTime;

    playerRef.current.seekTo(start, true);
    playerRef.current.playVideo();

    playbackTimerRef.current = setInterval(() => {
      try {
        const currentTime = playerRef.current.getCurrentTime();
        if (currentTime >= end) {
          if (loopAudio) {
            playerRef.current.seekTo(start, true);
          } else {
            playerRef.current.pauseVideo();
            setAppState('IDLE');
            if (playbackTimerRef.current) {
              clearInterval(playbackTimerRef.current);
              playbackTimerRef.current = null;
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 100);
  };

  const playUserComparison = () => {
    if (!userAudioBlob) return;
    const url = URL.createObjectURL(userAudioBlob);
    const audio = new Audio(url);
    audio.play();
  };

  // Recording triggers
  const startRecording = async () => {
    setErrorMsg(null);
    setUserAudioBlob(null);
    setRecordingDuration(0);
    cleanupAudio();

    if (!isOnline) {
      // Offline implementation
      if (!isSpeechRecognitionSupported()) {
        setErrorMsg(t('micDenied'));
        return;
      }
      setAppState('RECORDING');
      const durationLimit = Math.max(15, Math.ceil(currentLesson.endTime - currentLesson.startTime) + 2);
      
      const ctrl = startOfflineRecording(
        durationLimit,
        (elapsed) => setRecordingDuration(elapsed),
        async (blob, transcript) => {
          setUserAudioBlob(blob);
          setAppState('ANALYZING');
          if (!currentLesson) return;

          const result: OfflineEvaluationResult = evaluateLocally(
            currentLesson.sentence,
            transcript,
            lang as 'en' | 'ar'
          );
          setEvaluation(result);

          // Save attempt
          await db.attempts.add({
            sentenceId: currentLesson.id,
            sentenceText: currentLesson.sentence,
            score: result.score,
            feedbackPositive: result.feedbackPositive,
            feedbackImprovement: result.feedbackImprovement,
            timestamp: Date.now(),
            words: result.words,
          });

          setAppState('FEEDBACK_READY');
          
          try {
            await recordAttempt(currentLesson.id, result.score);
          } catch (e) {
            console.warn(e);
          }
        },
        (errKey) => {
          setErrorMsg(t(errKey as any));
          setAppState('IDLE');
        }
      );
      setOfflineController(ctrl);
      return;
    }

    // Online implementation
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let recorder: MediaRecorder;
      const options = { 
        mimeType: 'audio/webm',
        audioBitsPerSecond: 32000 // 32kbps compression
      };

      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        try {
          recorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
        } catch {
          recorder = new MediaRecorder(stream);
        }
      }

      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        setAppState('ANALYZING');
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        setUserAudioBlob(blob);
        await submitForEvaluation(blob);
      };

      recorder.start(250);
      setAppState('RECORDING');

      const maxRecSecs = Math.max(15, Math.ceil(currentLesson.endTime - currentLesson.startTime) + 3);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= maxRecSecs) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (e) {
      console.error(e);
      setErrorMsg(t('micDenied'));
      setAppState('IDLE');
    }
  };

  const stopRecording = () => {
    if (!isOnline && offlineController) {
      offlineController.stop();
      setOfflineController(null);
      return;
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const submitForEvaluation = async (blob: Blob) => {
    if (!currentLesson) return;
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');
      formData.append('text', currentLesson.sentence);

      const headers: Record<string, string> = {};
      const customKey = typeof window !== 'undefined' ? localStorage.getItem('shadowspeak_custom_api_key') : null;
      if (customKey) {
        headers['x-gemini-api-key'] = customKey;
      }
      const customModel = typeof window !== 'undefined' ? localStorage.getItem('shadowspeak_gemini_model') : null;
      if (customModel) {
        headers['x-gemini-model'] = customModel;
      }
      headers['x-ui-language'] = lang;

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || t('apiError'));
      }

      const result = await res.json();
      const evalResult = result as EvaluationResult;
      setEvaluation(evalResult);

      // Save locally to IndexedDB
      await db.attempts.add({
        sentenceId: currentLesson.id,
        sentenceText: currentLesson.sentence,
        score: evalResult.score,
        feedbackPositive: evalResult.feedbackPositive,
        feedbackImprovement: evalResult.feedbackImprovement,
        timestamp: Date.now(),
        words: evalResult.words,
      });

      // Track phoneme issues
      if (evalResult.words) {
        for (const w of evalResult.words) {
          if (w.status === 'mispronounced' || w.status === 'missing') {
            const clean = w.word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '').trim().toLowerCase();
            if (clean) {
              const existing = await db.phonemeIssues.get(clean);
              if (existing) {
                await db.phonemeIssues.put({ word: clean, count: existing.count + 1, lastSeen: Date.now() });
              } else {
                await db.phonemeIssues.put({ word: clean, count: 1, lastSeen: Date.now() });
              }
            }
          }
        }
      }

      setAppState('FEEDBACK_READY');

      try {
        await recordAttempt(currentLesson.id, evalResult.score);
      } catch (e) {
        console.warn(e);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || t('unknownError'));
      setAppState('IDLE');
    }
  };

  const handleNext = () => {
    if (currentIndex < lessons.length - 1) {
      setEvaluation(null);
      setErrorMsg(null);
      setUserAudioBlob(null);
      setCurrentIndex((prev) => prev + 1);
      setAppState('IDLE');
    } else {
      router.push('/youtube');
    }
  };

  const renderWordTokens = () => {
    if (!currentLesson) return null;

    if (appState === 'FEEDBACK_READY' && evaluation?.words) {
      return (
        <div dir="ltr" className="flex flex-wrap justify-center gap-2 max-w-full px-4 select-none py-1">
          {evaluation.words.map((w, index) => {
            if (w.status === 'correct') {
              return (
                <span key={index} className="word-token word-token-correct text-xs md:text-sm font-bold flex items-center gap-0.5">
                  {w.word}
                  <span className="text-[9px]">✓</span>
                </span>
              );
            } else if (w.status === 'mispronounced') {
              return (
                <span key={index} className="word-token word-token-mispronounced text-xs md:text-sm font-bold flex items-center gap-0.5">
                  {w.word}
                  <span className="text-[9px]">~</span>
                </span>
              );
            } else {
              return (
                <span key={index} className="word-token word-token-missing text-xs md:text-sm font-bold flex items-center gap-0.5 line-through">
                  {w.word}
                  <span className="text-[8px]">✕</span>
                </span>
              );
            }
          })}
        </div>
      );
    }

    return (
      <span dir="ltr" className="font-display text-xl md:text-2xl font-extrabold tracking-tight text-foreground leading-relaxed select-none block text-center">
        {currentLesson.sentence}
      </span>
    );
  };

  if (!video || lessons.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">{t('preparing')}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans relative overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Header showBackButton backHref="/youtube" title={t('youtubeTitle')} />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4 flex flex-col justify-between min-h-0 overflow-y-auto scrollbar-none gap-4">
        
        {/* Top Info Bar */}
        <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex-shrink-0">
          <span>{video.title.slice(0, 30)}...</span>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
              isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-600'
            }`}>
              {isOnline ? <><Wifi className="w-2.5 h-2.5" />{t('onlineBadge')}</> : <><WifiOff className="w-2.5 h-2.5" />{t('offlineBadge')}</>}
            </span>
            <span>{t('sentenceOf').replace('{x}', String(currentIndex + 1)).replace('{y}', String(lessons.length))}</span>
          </div>
        </div>

        {/* 1. Sleek Video Player Wrapper */}
        <div className="w-full aspect-video rounded-2xl overflow-hidden border border-border bg-black shadow-sm relative flex-shrink-0">
          <div id="youtube-player" className="w-full h-full" />
          {!isPlayerReady && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading YouTube Stream...</span>
            </div>
          )}
        </div>

        {/* 2. active sentence card */}
        {appState !== 'ANALYZING' && (
          <div className="flex-1 flex flex-col justify-center min-h-[120px] py-1 flex-shrink-0">
            <div className="w-full relative rounded-3xl border border-border bg-card p-5 shadow-sm overflow-hidden min-h-[110px] flex flex-col justify-center items-center">
              
              {/* Animated Waveform Background */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl opacity-15">
                <svg className={`absolute top-1/2 left-0 w-[200%] h-10 -translate-y-1/2 text-sonic-magenta fill-none animate-wave-ripple-l transition-all duration-500 ${
                  appState === 'PLAYING_PROMPT' ? 'opacity-85 stroke-[1.5px]' : 'opacity-35'
                }`} viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path d="M0,10 C10,12 15,4 25,10 C35,16 40,8 50,10 C60,12 65,4 75,10 C85,16 90,8 100,10" stroke="currentColor" strokeWidth="0.8" />
                </svg>
                <svg className={`absolute top-1/2 right-0 w-[200%] h-10 -translate-y-1/2 text-sonic-cyan fill-none animate-wave-ripple-r transition-all duration-500 ${
                  appState === 'RECORDING' ? 'opacity-85 stroke-[1.5px] scale-y-[1.8]' : 'opacity-35'
                }`} viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path d="M0,10 C10,4 15,16 25,10 C35,4 40,16 50,10 C60,4 65,16 75,10 C85,4 90,16 100,10" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 1" />
                </svg>
              </div>

              {/* Text tokens */}
              <div className="relative z-10 w-full flex flex-col gap-2 items-center">
                {renderWordTokens()}
              </div>

              {appState === 'PLAYING_PROMPT' && (
                <span className="mt-2 text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-pulse z-10">
                  {t('playingPrompt')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 3. Loading shimmer screen during acoustic AI scoring */}
        {appState === 'ANALYZING' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 border border-border bg-card rounded-3xl gap-3 animate-pulse min-h-[140px] flex-shrink-0">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
            <div className="text-center space-y-1">
              <span className="text-xs font-semibold text-foreground">
                {isOnline ? t('analyzingAcoustics') : t('offlineAnalyzing')}
              </span>
              <p className="text-[9px] text-muted-foreground leading-tight">Analyzing phonetic accuracy using Gemini AI</p>
            </div>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-[10px]">{t('errorTitle')}</p>
              <p className="opacity-90 leading-tight mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="p-0.5 hover:bg-destructive/10 rounded-full cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4. Controls layout */}
        <div className="flex flex-col gap-4 bg-card border border-border rounded-3xl p-4 shadow-sm flex-shrink-0">
          
          {/* Loop and Speed selector */}
          <div className="flex justify-between items-center border-b border-border pb-3">
            
            {/* Speed modifier */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground">{t('voiceSpeed')}:</span>
              <div className="flex gap-1">
                {([0.5, 0.75, 1.0] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setVoiceSpeed(spd)}
                    className={`py-1 px-2 text-[9px] font-bold rounded-lg border transition-all cursor-pointer ${
                      voiceSpeed === spd
                        ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                        : 'bg-background border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Loop Toggle */}
            <button
              onClick={() => setLoopAudio(!loopAudio)}
              className={`flex items-center gap-1 py-1 px-2.5 text-[9px] font-bold rounded-lg border transition-all cursor-pointer ${
                loopAudio
                  ? 'bg-sonic-cyan/10 border-sonic-cyan/20 text-sonic-cyan'
                  : 'bg-background border-border text-muted-foreground'
              }`}
            >
              <Repeat className="w-3 h-3" />
              <span>{lang === 'ar' ? 'تكرار' : 'Loop'}</span>
            </button>

          </div>

          {/* Active Listening / Recording buttons */}
          <div className="flex justify-center items-center gap-6 py-1">
            
            {/* Listen native speaker */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={playPrompt}
                disabled={appState === 'RECORDING' || appState === 'ANALYZING' || !isPlayerReady}
                className="w-12 h-12 rounded-full border border-border bg-background hover:bg-muted text-foreground flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Listen"
              >
                <Volume2 className="w-5 h-5 text-sonic-cyan" />
              </button>
              <span className="text-[9px] font-bold text-muted-foreground">{t('listen')}</span>
            </div>

            {/* Micro Record / Stop */}
            <div className="flex flex-col items-center gap-1">
              {appState === 'RECORDING' ? (
                <button
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center text-white shadow-lg animate-pulse transition-all cursor-pointer"
                  aria-label="Stop Recording"
                >
                  <Square className="w-6 h-6" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={appState === 'ANALYZING' || !isPlayerReady}
                  className="w-16 h-16 rounded-full bg-sonic-magenta text-white flex items-center justify-center shadow-[0_4px_12px_rgba(236,72,153,0.3)] hover:scale-105 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Record Voice"
                >
                  <Mic className="w-6 h-6" />
                </button>
              )}
              
              <span className="text-[9px] font-bold text-muted-foreground">
                {appState === 'RECORDING'
                  ? `${recordingDuration}s / 15s`
                  : t('record')}
              </span>
            </div>

            {/* Dummy slot to align layout */}
            <div className="w-12 flex flex-col items-center opacity-0 pointer-events-none">
              <div className="w-12 h-12 rounded-full" />
              <span>Align</span>
            </div>

          </div>

        </div>

        {/* 5. slide-up evaluation feedback panel */}
        <AnimatePresence>
          {appState === 'FEEDBACK_READY' && evaluation && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="rounded-3xl border border-border bg-card p-5 shadow-lg flex flex-col gap-4 flex-shrink-0"
            >
              
              {/* Score Gauge */}
              <div className="flex items-center gap-4 border-b border-border pb-3">
                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-display font-extrabold shadow-sm ${
                  evaluation.score >= 85
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : evaluation.score >= 60
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  <span className="text-xl leading-none">{evaluation.score}</span>
                  <span className="text-[8px] uppercase tracking-wider font-bold mt-0.5">Score</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Award className="w-4 h-4 text-sonic-magenta" />
                    {evaluation.score >= 85 ? t('nativeGrade') : evaluation.score >= 60 ? t('clearArtic') : t('keepPractice')}
                  </h3>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                    {evaluation.score >= 85 ? t('nativeGradeDesc') : evaluation.score >= 60 ? t('clearArticDesc') : t('keepPracticeDesc')}
                  </p>
                </div>
              </div>

              {/* Feedbacks */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{t('praiseLabel')}</span>
                  <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/30 p-2.5 rounded-xl">
                    {evaluation.feedbackPositive}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{t('correctionLabel')}</span>
                  <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/30 p-2.5 rounded-xl">
                    {evaluation.feedbackImprovement}
                  </p>
                </div>
              </div>

              {/* A/B playback */}
              {userAudioBlob && (
                <div className="flex gap-2 bg-muted/20 p-2 rounded-2xl border border-border justify-center items-center">
                  <button
                    onClick={playPrompt}
                    className="flex-1 py-2 px-3 text-[10px] font-bold rounded-xl border border-border bg-background hover:bg-muted text-foreground flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3 text-sonic-cyan" />
                    {t('playReference')}
                  </button>
                  <button
                    onClick={playUserComparison}
                    className="flex-1 py-2 px-3 text-[10px] font-bold rounded-xl border border-border bg-background hover:bg-muted text-foreground flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3 text-sonic-magenta" />
                    {t('recordedUser')}
                  </button>
                </div>
              )}

              {/* Continue Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEvaluation(null);
                    setErrorMsg(null);
                    setUserAudioBlob(null);
                    setAppState('IDLE');
                  }}
                  className="flex-1 py-3 text-xs font-semibold rounded-2xl border border-border hover:bg-muted text-foreground active:scale-[0.98] transition-all cursor-pointer"
                >
                  {lang === 'ar' ? 'أعد المحاولة' : 'Try Again'}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 py-3 bg-sonic-magenta text-white font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{currentIndex < lessons.length - 1 ? t('nextSentence') : t('finishSession')}</span>
                  <ChevronRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}

export default function YoutubePractice() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Preparing practice blocks...</span>
      </div>
    }>
      <YoutubePracticeContent />
    </Suspense>
  );
}
