import { Job, JobStatus } from "./types";

export class JobQueue {
  private queue: Job[] = [];
  private isProcessing: boolean = false;
  private currentJob: Job | null = null;

  public enqueue<T>(job: Omit<Job<T>, "createdAt" | "retries">): void {
    const fullJob: Job<T> = {
      ...job,
      retries: 0,
      maxRetries: job.maxRetries ?? 3,
      createdAt: Date.now(),
    };

    this.queue.push(fullJob);
    this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.processNext();
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public isBusy(): boolean {
    return this.isProcessing;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.currentJob = this.queue.shift() || null;

    if (!this.currentJob) {
      this.isProcessing = false;
      return;
    }

    try {
      await this.currentJob.execute();
    } catch (error) {
      console.error(
        `[JobQueue] Error saat menjalankan task ${this.currentJob.name}:`,
        error,
      );

      if ((this.currentJob.retries ?? 0) < (this.currentJob.maxRetries ?? 3)) {
        this.currentJob.retries = (this.currentJob.retries ?? 0) + 1;
        this.queue.push(this.currentJob);
      }
    } finally {
      this.currentJob = null;
      this.isProcessing = false;
      this.processNext();
    }
  }

  public clear(): void {
    this.queue = [];
    this.currentJob = null;
    this.isProcessing = false;
  }
}

export const globalJobQueue = new JobQueue();
