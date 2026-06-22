'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Mic, Square, Loader2, Sparkles, Check, AlertCircle, ChevronRight, X } from 'lucide-react';
import Header from '@/components/Header';
import { AMERICAN_PHRASES, Sentence } from '@/lib/sentences';
import { db } from '@/lib/db';
import { useLanguage } from '@/context/LanguageContext';

type AppState = 'IDLE' | 'PLAYING_PROMPT' | 'RECORDING' | 'ANALYZING' | 'FEEDBACK_READY';

interface EvaluationResult {
  score: number;
  feedbackPositive: string;
  feedbackImprovement: string;
  words: { word: string; status: 'correct' | 'mispronounced' | 'missing' }[];
}

export default function PracticeEnvironment() {
  const router = useRouter();
  const { lang, t } = useLanguage();
  
  // State management
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [appState, setAppState] = useState<AppState>('IDLE');
  
  // Audio state
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Voice playback speed state (default to 1.0x)
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0);
  
  // Evaluation API State
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Timing state for session metrics
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  // Refs for cleanup
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load 10 sentences on mount
  useEffect(() => {
    // Select 10 random phrases, or if bank is 10, take all 10
    const shuffled = [...AMERICAN_PHRASES].sort(() => 0.5 - Math.random());
    setSentences(shuffled.slice(0, 10));
    setSessionStartTime(Date.now());
    
    // Warm up TTS voices in Chrome
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }

    return () => {
      cleanupAudio();
    };
  }, []);

  const currentSentence = sentences[currentIndex];

  // Clean up audio streams and recorders
  const cleanupAudio = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`Track ${track.label} stopped`);
      });
      streamRef.current = null;
    }
  };

  // Play Native TTS with controllable speed rate
  const playPrompt = () => {
    if (!currentSentence || typeof window === 'undefined') return;

    setAppState('PLAYING_PROMPT');
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(currentSentence.text);
    utterance.lang = 'en-US';
    
    // Explicitly apply selected playback rate/speed controls
    utterance.rate = voiceSpeed;

    // Set voice to American English if available
    const voices = window.speechSynthesis.getVoices();
    const americanVoice = voices.find(
      (voice) => voice.lang.includes('en-US') && voice.name.toLowerCase().includes('google')
    ) || voices.find(
      (v) => v.lang.includes('en-US')
    );

    if (americanVoice) {
      utterance.voice = americanVoice;
    }

    utterance.onend = () => {
      setAppState('IDLE');
    };

    utterance.onerror = () => {
      setAppState('IDLE');
    };

    window.speechSynthesis.speak(utterance);
  };

  // Start Recording
  const startRecording = async () => {
    setErrorMsg(null);
    setAudioChunks([]);
    setRecordingDuration(0);
    cleanupAudio();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let recorder: MediaRecorder;
      const options = { mimeType: 'audio/webm' };
      
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        // Fallback if audio/webm is not supported (e.g. on iOS Safari)
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;
      setMediaRecorder(recorder);

      const localChunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          localChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setAppState('ANALYZING');
        const finalBlob = new Blob(localChunks, { type: recorder.mimeType || 'audio/webm' });
        await submitForEvaluation(finalBlob);
      };

      recorder.start(250); // Get chunks every 250ms
      setAppState('RECORDING');

      // Track recording duration
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 15) { // Cap at 15 seconds
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setErrorMsg(t('micDenied'));
      setAppState('IDLE');
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      // Promptly stop tracks to turn off the record indicator light
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Call API for grading (P0 Fix: Enhanced error checks)
  const submitForEvaluation = async (audioBlob: Blob) => {
    if (!currentSentence) return;
    setErrorMsg(null);
    
    try {
      // Check offline status first
      if (typeof window !== 'undefined' && !navigator.onLine) {
        throw new Error('NETWORK_ERROR');
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('text', currentSentence.text);

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || '';
        if (errMsg.includes('GEMINI_API_KEY') || res.status === 500) {
          throw new Error('API_ERROR');
        }
        throw new Error(errMsg || 'UNKNOWN_ERROR');
      }

      let result: any;
      try {
        result = await res.json();
      } catch {
        throw new Error('INVALID_RESPONSE');
      }

      // Check structure (including V2 words array)
      if (
        typeof result.score !== 'number' ||
        typeof result.feedbackPositive !== 'string' ||
        typeof result.feedbackImprovement !== 'string' ||
        !Array.isArray(result.words)
      ) {
        throw new Error('INVALID_RESPONSE');
      }

      const evalResult = result as EvaluationResult;
      setEvaluation(evalResult);
      
      // Save attempt to IndexedDB Immediately for local-first durability
      await db.attempts.add({
        sentenceId: currentSentence.id,
        sentenceText: currentSentence.text,
        score: evalResult.score,
        feedbackPositive: evalResult.feedbackPositive,
        feedbackImprovement: evalResult.feedbackImprovement,
        timestamp: Date.now(),
        words: evalResult.words
      });

      setAppState('FEEDBACK_READY');
    } catch (err: any) {
      console.error('API Evaluation failed:', err);
      let errorMsgStr = t('unknownError');
      if (err.message === 'NETWORK_ERROR') {
        errorMsgStr = t('networkError');
      } else if (err.message === 'API_ERROR') {
        errorMsgStr = t('apiError');
      } else if (err.message === 'INVALID_RESPONSE') {
        errorMsgStr = t('invalidResponse');
      } else if (err.message && err.message !== 'UNKNOWN_ERROR') {
        errorMsgStr = err.message;
      }
      setErrorMsg(errorMsgStr);
      setAppState('IDLE');
    }
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setEvaluation(null);
      setErrorMsg(null);
      setCurrentIndex((prev) => prev + 1);
      setAppState('IDLE');
    } else {
      // Completed last sentence! Go to results
      router.push(`/result?start=${sessionStartTime}`);
    }
  };

  // Render focal prompt with word-level highlight coloring (P3 Task 8)
  const renderFocalPrompt = () => {
    if (!currentSentence) return null;

    if (appState === 'FEEDBACK_READY' && evaluation && evaluation.words) {
      return (
        <div dir="ltr" className="flex flex-wrap justify-center gap-x-2 gap-y-1 max-w-full px-4 select-none">
          {evaluation.words.map((w, index) => {
            let colorClass = 'text-foreground';
            if (w.status === 'correct') {
              colorClass = 'text-emerald-500 font-bold';
            } else if (w.status === 'mispronounced') {
              colorClass = 'text-amber-500 font-bold decoration-wavy underline decoration-2';
            } else if (w.status === 'missing') {
              colorClass = 'text-destructive font-bold line-through opacity-50';
            }
            return (
              <span 
                key={index} 
                className={`text-3xl md:text-4xl tracking-tight transition-all duration-300 ${colorClass}`}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      );
    }

    return (
      <span dir="ltr" className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-snug select-none block">
        {currentSentence.text}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
      <Header showBackButton backHref="/" title={t('shadowingPractice')} />

      {/* Main Content Area */}
      <div className="flex-1 px-6 py-6 flex flex-col justify-between gap-6 z-10">
        
        {/* Progress Tracker */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {t('progress')}
          </span>
          <span className="text-sm font-bold text-primary">
            {t('sentenceOf', { x: currentIndex + 1, y: sentences.length })}
          </span>
        </div>

        {/* Focal Prompt Card */}
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <AnimatePresence mode="wait">
            {currentSentence ? (
              <motion.div
                key={currentSentence.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="w-full text-center flex flex-col items-center gap-6"
              >
                <div className="relative group p-2 w-full">
                  {renderFocalPrompt()}
                </div>
                
                {appState === 'PLAYING_PROMPT' && (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full animate-pulse">
                    {t('playingPrompt')}
                  </span>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">{t('preparing')}</span>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{t('errorTitle')}</p>
              <p className="text-xs opacity-90 mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="p-0.5 hover:bg-destructive/10 rounded-full">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Apple-style loading shimmer during analysis */}
        {appState === 'ANALYZING' && (
          <div className="w-full bg-card border border-border rounded-3xl p-6 flex flex-col gap-4 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-sm font-semibold text-foreground">{t('analyzingAcoustics')}</span>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded-full w-full animate-shimmer" />
              <div className="h-4 bg-muted rounded-full w-5/6 animate-shimmer" />
            </div>
          </div>
        )}

        {/* Control Hub (Sticky Bottom Area) */}
        <div className="w-full flex flex-col gap-4 pt-4 border-t border-border">
          {appState !== 'ANALYZING' && appState !== 'FEEDBACK_READY' && (
            <>
              {/* Voice Speed Controls */}
              <div className="flex flex-col gap-2 p-3.5 rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                  <span>{t('voiceSpeed')}</span>
                  <span className="font-bold text-primary">{voiceSpeed.toFixed(1)}x</span>
                </div>
                <div className="flex gap-1" dir="ltr">
                  {[0.6, 0.8, 1.0, 1.2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setVoiceSpeed(speed)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all duration-200 ${
                        voiceSpeed === speed
                          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                          : 'bg-card border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Listen CTA */}
                <button
                  onClick={playPrompt}
                  disabled={appState === 'PLAYING_PROMPT' || !currentSentence}
                  className="py-4 rounded-2xl border border-border bg-card text-foreground font-semibold flex items-center justify-center gap-2 hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <Volume2 className="w-5 h-5 text-primary" />
                  {t('listen')}
                </button>

                {/* Record / Stop CTA */}
                {appState === 'RECORDING' ? (
                  <button
                    onClick={stopRecording}
                    className="py-4 rounded-2xl bg-foreground text-background font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all relative overflow-hidden"
                  >
                    <Square className="w-5 h-5 fill-current text-destructive animate-pulse" />
                    {t('stop')} ({15 - recordingDuration}s)
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    disabled={!currentSentence}
                    className="py-4 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md"
                  >
                    <Mic className="w-5 h-5 fill-current" />
                    {t('record')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sliding Feedback Modal from bottom */}
      <AnimatePresence>
        {appState === 'FEEDBACK_READY' && evaluation && (
          <>
            {/* Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black z-40"
              onClick={handleNext}
            />
            
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-card border-t border-border rounded-t-[32px] p-6 z-50 flex flex-col gap-6 shadow-2xl"
            >
              {/* Top notch indicator */}
              <div className="w-12 h-1 bg-border rounded-full mx-auto" />

              <div className="flex flex-col items-center text-center gap-4">
                {/* Score Indicator Badge */}
                <div className="relative flex items-center justify-center w-24 h-24">
                  {/* SVG Circle Track */}
                  <svg className="w-full h-full transform -rotate-95">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="var(--border)"
                      strokeWidth="6"
                      fill="transparent"
                      className="opacity-20"
                    />
                    <motion.circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke={evaluation.score >= 85 ? '#22c55e' : evaluation.score >= 70 ? '#eab308' : '#3b82f6'}
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray={251.2}
                      initial={{ strokeDashoffset: 251.2 }}
                      animate={{ strokeDashoffset: 251.2 - (251.2 * evaluation.score) / 100 }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </svg>
                  <span className="absolute text-2xl font-black text-foreground">
                    {evaluation.score}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">{t('acousticScore')}</h3>
                  <p className="text-xs text-muted-foreground">{t('accentAlignDetail')}</p>
                </div>
              </div>

              {/* Feedback Points */}
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 flex gap-3 text-sm">
                  <span className="text-emerald-500 font-semibold select-none flex-shrink-0 mt-0.5">🟢</span>
                  <p className="text-foreground leading-relaxed">
                    <strong className="text-emerald-500 font-bold block text-xs uppercase tracking-wider mb-0.5">{t('praiseLabel')}</strong>
                    {evaluation.feedbackPositive}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 flex gap-3 text-sm">
                  <span className="text-blue-500 font-semibold select-none flex-shrink-0 mt-0.5">🔵</span>
                  <p className="text-foreground leading-relaxed">
                    <strong className="text-blue-500 font-bold block text-xs uppercase tracking-wider mb-0.5">{t('correctionLabel')}</strong>
                    {evaluation.feedbackImprovement}
                  </p>
                </div>
              </div>

              {/* Next CTA */}
              <button
                onClick={handleNext}
                className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-md mt-2"
              >
                {currentIndex < sentences.length - 1 ? t('nextSentence') : t('finishSession')}
                <ChevronRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
