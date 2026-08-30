import { ScheduledTask } from "./types";
import { globalJobQueue } from "./JobQueue";

export class UniversalScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timer: any = null;
  private isRunning: boolean = false;
  private lastCheckedDate: string = new Date().toISOString().slice(0, 10);

  public register(task: ScheduledTask): void {
    this.tasks.set(task.id, task);
  }

  public unregister(taskId: string): void {
    this.tasks.delete(taskId);
  }

  public start(checkIntervalMs: number = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(() => {
      this.tick();
    }, checkIntervalMs);

    // Jalankan pengecekan pertama saat boot
    this.tick();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const currentDate = new Date().toISOString().slice(0, 10);
    const isDateChanged = currentDate !== this.lastCheckedDate;

    if (isDateChanged) {
      this.lastCheckedDate = currentDate;
    }

    for (const [id, task] of this.tasks.entries()) {
      if (!task.enabled) continue;

      let shouldRun = false;

      if (task.type === "interval" && task.intervalMs) {
        if (!task.lastRunAt || now - task.lastRunAt >= task.intervalMs) {
          shouldRun = true;
        }
      } else if (
        task.type === "daily_midnight" ||
        task.type === "date_change"
      ) {
        if (isDateChanged) {
          shouldRun = true;
        }
      }

      if (shouldRun) {
        task.lastRunAt = now;
        globalJobQueue.enqueue({
          id: `job-${task.id}-${now}`,
          name: `Scheduled: ${task.name}`,
          execute: async () => {
            await task.task();
          },
        });
      }
    }
  }

  public async runNow(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      globalJobQueue.enqueue({
        id: `manual-${task.id}-${Date.now()}`,
        name: `Manual Run: ${task.name}`,
        execute: async () => {
          await task.task();
        },
      });
    }
  }
}

export const globalScheduler = new UniversalScheduler();
