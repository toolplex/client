import { LogTelemetryRequest } from '../toolplexApi/types.js';
import Registry from '../registry.js';
import { FileLogger } from '../../shared/fileLogger.js';

const logger = FileLogger;

export class TelemetryLogger {
  private eventQueue: Array<{
    eventType: LogTelemetryRequest['event_type'];
    data: Partial<Omit<LogTelemetryRequest, 'event_type'>>;
  }> = [];
  private flushTimeout: NodeJS.Timeout | null = null;

  private readonly BATCH_SIZE = 10;
  private readonly FLUSH_INTERVAL = 30000;

  constructor() {
    this.scheduleFlush();
  }

  /**
   * Log a telemetry event
   */
  public async log(
    eventType: LogTelemetryRequest['event_type'],
    data: Partial<Omit<LogTelemetryRequest, 'event_type'>>
  ): Promise<void> {
    this.eventQueue.push({ eventType, data });
    if (this.eventQueue.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    try {
      const apiService = Registry.getToolplexApiService();
      const events = [...this.eventQueue];
      this.eventQueue = [];

      await logger.debug(`Flushing ${events.length} telemetry events`);
      await apiService.logTelemetryEvents(events);
    } catch (err) {
      await logger.error(`Error flushing telemetry events: ${err}`);
      this.eventQueue.unshift(...this.eventQueue);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }

    this.flushTimeout = setTimeout(async () => {
      await this.flush();
      this.scheduleFlush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Clean up resources - should be called when shutting down
   */
  public async dispose(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    await this.flush();
  }
}
