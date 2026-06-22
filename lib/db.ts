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

class ShadowSpeakDB extends Dexie {
  attempts!: Table<Attempt>;
  ttsCache!: Table<TTSCacheEntry>;

  constructor() {
    super('ShadowSpeakDB');
    this.version(2).stores({
      attempts: '++id, sentenceId, score, timestamp',
      ttsCache: 'text'
    });
  }
}

export const db = new ShadowSpeakDB();
