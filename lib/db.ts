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

class ShadowSpeakDB extends Dexie {
  attempts!: Table<Attempt>;
  ttsCache!: Table<TTSCacheEntry>;
  phonemeIssues!: Table<PhonemeIssue>;

  constructor() {
    super('ShadowSpeakDB');
    this.version(3).stores({
      attempts: '++id, sentenceId, score, timestamp',
      ttsCache: 'text',
      phonemeIssues: 'word, count, lastSeen'
    });
  }
}

export const db = new ShadowSpeakDB();
