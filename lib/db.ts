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

class ShadowSpeakDB extends Dexie {
  attempts!: Table<Attempt>;

  constructor() {
    super('ShadowSpeakDB');
    this.version(1).stores({
      attempts: '++id, sentenceId, score, timestamp'
    });
  }
}

export const db = new ShadowSpeakDB();
