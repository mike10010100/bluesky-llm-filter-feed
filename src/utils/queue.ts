export type Task = () => Promise<void>;

export class BoundedQueue {
  private queue: Task[] = [];
  private activeCount = 0;
  private limit: number;
  private concurrency: number;

  constructor(limit: number = 50, concurrency: number = 1) {
    this.limit = limit;
    this.concurrency = concurrency;
  }

  add(task: Task): boolean {
    if (this.queue.length >= this.limit) {
      return false; // Dropped
    }
    this.queue.push(task);
    this.process();
    return true; // Accepted
  }

  private async process() {
    // If we are already at max concurrency, or queue is empty, do nothing
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    // Start a new worker
    this.activeCount++;
    const task = this.queue.shift();

    if (task) {
      try {
        await task();
      } catch (err) {
        console.error("Queue task failed:", err);
      } finally {
        this.activeCount--;
        // After finishing, try to pick up the next task
        this.process();
      }
    } else {
        this.activeCount--;
    }
  }

  get size(): number {
    return this.queue.length;
  }

  get pending(): number {
      return this.activeCount;
  }
}