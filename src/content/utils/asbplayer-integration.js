class AsbplayerIntegration {
  constructor(pageProcessor) {
    this.pageProcessor = pageProcessor;
    this.intervalId = null;
    this.stopTimeout = null;
  }

  start() {
    this.pageProcessor.detectAsbplayerElements();
    this.intervalId = setInterval(() => {
      this.pageProcessor.detectAsbplayerElements();
    }, 2000);
    this.stopTimeout = setTimeout(() => {
      this.stop();
    }, 60000);
  }

  stop() {
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