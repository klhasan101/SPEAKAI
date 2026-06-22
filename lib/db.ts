import Dexie, { type Table } from 'dexie';

export interface Attempt {
  id?: number; // Auto-incrementing primary key
  sentenceId: string;
  sentenceText: string;
  score: number;
  feedbackPositive: string;
  feedbackImprovement: string;
  timestamp: number;
  words?: { word: string; status: 'correct' | 'mispronounced' | 'missing' }[];
}

export interface TTSCacheEntry {
  text: string;
  audioBlob: Blob;
  timestamp: number;
}

export interface PhonemeIssue {
  word: string;
  count: number;
  lastSeen: number;
}

export interface SentenceProgress {
  sentenceId: string;   // primary key
  lastScore: number;    // 0-100
  nextReview: number;   // timestamp (ms) when due
  interval: number;     // days until next review
  repetitions: number;  // number of times reviewed
}

export interface Achievement {
  id: string; // unique ID, e.g. 'first_step', 'perfect_pitch', 'super_shadow', 'persistence', 'fluent_focus'
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  unlockedAt: number; // timestamp
}

export interface YoutubeVideo {
  youtubeId: string; // e.g. "dQw4w9WgXcQ"
  title: string;
  thumbnail: string;
  duration: number; // in seconds
  channelName: string;
  addedAt: number; // timestamp
}

export interface YoutubeLesson {
  id: string; // e.g. "yt_dQw4w9WgXcQ_0"
  youtubeId: string;
  sentence: string;
  startTime: number;
  endTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

class ShadowSpeakDB extends Dexie {
  attempts!: Table<Attempt>;
  ttsCache!: Table<TTSCacheEntry>;
  phonemeIssues!: Table<PhonemeIssue>;
  achievements!: Table<Achievement>;
  sentenceProgress!: Table<SentenceProgress>;
  youtubeVideos!: Table<YoutubeVideo>;
  youtubeLessons!: Table<YoutubeLesson>;

  constructor() {
    super('ShadowSpeakDB');
    this.version(4).stores({
      attempts: '++id, sentenceId, score, timestamp',
      ttsCache: 'text',
      phonemeIssues: 'word, count, lastSeen',
      achievements: 'id, unlockedAt'
    });
    this.version(5).stores({
      attempts: '++id, sentenceId, score, timestamp',
      ttsCache: 'text',
      phonemeIssues: 'word, count, lastSeen',
      achievements: 'id, unlockedAt',
      sentenceProgress: 'sentenceId, nextReview'
    });
    this.version(6).stores({
      attempts: '++id, sentenceId, score, timestamp',
      ttsCache: 'text',
      phonemeIssues: 'word, count, lastSeen',
      achievements: 'id, unlockedAt',
      sentenceProgress: 'sentenceId, nextReview',
      youtubeVideos: 'youtubeId, addedAt',
      youtubeLessons: 'id, youtubeId, difficulty'
    });
  }
}

export const db = new ShadowSpeakDB();

