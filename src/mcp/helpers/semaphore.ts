/**
 * FIFO concurrency limiter for tool calls.
 *
 * Replaces the old reject-above-N limiter: bursts now queue (bounded) instead
 * of failing immediately. Queued waiters are naturally bounded in time by the
 * fetcher's 30s timeout on the calls ahead of them.
 */
export class Semaphore {
  private active = 0
  private readonly queue: Array<() => void> = []

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number
  ) {}

  async acquire(): Promise<() => void> {
    if (this.active >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error(
          "Server busy — too many queued requests. Try again shortly."
        )
      }
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.active++
    let released = false
    return () => {
      if (released) return
      released = true
      this.active--
      this.queue.shift()?.()
    }
  }

  get activeCount(): number {
    return this.active
  }

  get queuedCount(): number {
    return this.queue.length
  }
}
