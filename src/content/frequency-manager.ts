import { PATHS } from '@/config/paths';

export class FrequencyManager {
  freqMap: Record<string, number>;

  constructor() {
    this.freqMap = {};
  }

  async loadFrequencyList(): Promise<void> {
    // Load all files in freq-dict/ that start with term_meta_bank
    // File paths are centralized in src/config/paths.ts
    this.freqMap = {};
    for (const file of PATHS.getFrequencyFiles()) {
      try {
        const response = await fetch(PATHS.url(file));
        if (!response.ok) continue;
        const freqArr: any[] = await response.json();
        for (const entry of freqArr) {
          if (entry.length === 3 && typeof entry[0] === 'string' && typeof entry[2] === 'number') {
            this.freqMap[entry[0]] = entry[2];
          }
        }
      } catch (e) {
        // Ignore errors for missing files
      }
    }
  }

  getFrequency(word: string): number | null {
    return this.freqMap[word] || null;
  }
}
