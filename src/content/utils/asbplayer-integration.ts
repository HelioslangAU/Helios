import type { PageProcessor } from '@/content/page-processor';

export class AsbplayerIntegration {
  pageProcessor: PageProcessor;
  intervalId: ReturnType<typeof setInterval> | null;
  stopTimeout: ReturnType<typeof setTimeout> | null;

  constructor(pageProcessor: PageProcessor) {
    this.pageProcessor = pageProcessor;
    this.intervalId = null;
    this.stopTimeout = null;
  }

  start(): void {
    this.pageProcessor.detectAsbplayerElements();
    this.intervalId = setInterval(() => {
      this.pageProcessor.detectAsbplayerElements();
    }, 2000);
    this.stopTimeout = setTimeout(() => {
      this.stop();
    }, 60000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
  }
}
