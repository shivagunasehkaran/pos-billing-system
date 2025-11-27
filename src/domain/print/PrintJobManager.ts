/**
 * PrintJobManager - Manages print queue, priorities, and retries
 */

import { getDataStore } from '../../data/OfflineDataStore';
import { STORES, INDEXES } from '../../data/dbConfig';
import type { PrintJob, Order } from '../types';
import { eventBus } from '../../utils/eventBus';
import { logger } from '../../utils/logger';

export type PrintJobType = 'receipt' | 'kitchen' | 'bar';
export type PrintJobStatus = 'pending' | 'printing' | 'completed' | 'failed';

export class PrintJobManager {
  private dataStore = getDataStore();
  private processing = false;
  private printerBridgeUrl?: string; // URL to local print bridge if available

  /**
   * Enqueue a print job
   */
  async enqueue(
    type: PrintJobType,
    order: Order,
    options?: { priority?: number; printerId?: string }
  ): Promise<string> {
    const payload = this.renderTemplate(type, order);
    const priority = options?.priority ?? this.getDefaultPriority(type);

    const job: PrintJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      orderId: order.id,
      payload,
      status: 'pending',
      priority,
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
      printerId: options?.printerId,
    };

    await this.dataStore.put(STORES.PRINT_JOBS, job);
    logger.info(`Print job enqueued: ${job.id} (${type})`);

    eventBus.emit('print:job-queued', { jobId: job.id, job });
    
    // Trigger processing if not already running
    if (!this.processing) {
      this.processQueue().catch((error) => {
        logger.error('Error processing print queue:', error);
      });
    }

    return job.id;
  }

  /**
   * Process pending print jobs
   */
  async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      const pendingJobs = await this.getPendingJobs();
      
      for (const job of pendingJobs) {
        try {
          await this.processJob(job);
        } catch (error) {
          logger.error(`Failed to process job ${job.id}:`, error);
          await this.markJobFailed(job.id, error instanceof Error ? error.message : String(error));
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get pending jobs sorted by priority and creation time
   */
  private async getPendingJobs(): Promise<PrintJob[]> {
    const jobs = await this.dataStore.query<PrintJob>(
      STORES.PRINT_JOBS,
      INDEXES.PRINT_JOBS_BY_STATUS,
      IDBKeyRange.only('pending')
    );

    // Filter jobs that are ready to retry
    const now = Date.now();
    const readyJobs = jobs.filter(
      (job) => !job.nextAttemptAt || job.nextAttemptAt <= now
    );

    // Sort by priority (desc) then createdAt (asc)
    return readyJobs.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Process a single print job
   */
  private async processJob(job: PrintJob): Promise<void> {
    // Update status to printing
    const updatedJob: PrintJob = {
      ...job,
      status: 'printing',
      attempts: job.attempts + 1,
    };
    await this.dataStore.put(STORES.PRINT_JOBS, updatedJob);
    eventBus.emit('print:job-status-changed', { jobId: job.id, status: 'printing', job: updatedJob });

    try {
      // Send to printer
      await this.sendToPrinter(job);

      // Mark as completed
      const completedJob: PrintJob = {
        ...updatedJob,
        status: 'completed',
        completedAt: Date.now(),
      };
      await this.dataStore.put(STORES.PRINT_JOBS, completedJob);
      eventBus.emit('print:job-status-changed', { jobId: job.id, status: 'completed', job: completedJob });

      logger.info(`Print job completed: ${job.id}`);
    } catch (error) {
      // Will be handled by markJobFailed
      throw error;
    }
  }

  /**
   * Send print job to printer
   */
  private async sendToPrinter(job: PrintJob): Promise<void> {
    // Option 1: Send to local print bridge (if available)
    if (this.printerBridgeUrl) {
      const response = await fetch(`${this.printerBridgeUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: job.type,
          payload: job.payload,
          printerId: job.printerId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Print bridge error: ${response.statusText}`);
      }
      return;
    }

    // Option 2: Browser print (for demo/fallback)
    // In a real system, this would send ESC/POS commands
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Print ${job.type}</title></head>
          <body>
            <pre style="font-family: monospace; font-size: 12px;">${job.payload}</pre>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
      // Wait a bit for print dialog
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      throw new Error('Failed to open print window');
    }
  }

  /**
   * Mark job as failed and schedule retry if attempts remain
   */
  private async markJobFailed(jobId: string, error: string): Promise<void> {
    const job = await this.dataStore.get<PrintJob>(STORES.PRINT_JOBS, jobId);
    if (!job) return;

    if (job.attempts >= job.maxAttempts) {
      // Max attempts reached, mark as permanently failed
      const failedJob: PrintJob = {
        ...job,
        status: 'failed',
        error,
      };
      await this.dataStore.put(STORES.PRINT_JOBS, failedJob);
      eventBus.emit('print:job-status-changed', { jobId, status: 'failed', job: failedJob });
      logger.error(`Print job failed permanently: ${jobId} - ${error}`);
    } else {
      // Schedule retry with exponential backoff
      const backoffDelay = Math.pow(2, job.attempts) * 1000; // 1s, 2s, 4s...
      const retryJob: PrintJob = {
        ...job,
        status: 'pending',
        nextAttemptAt: Date.now() + backoffDelay,
        error,
      };
      await this.dataStore.put(STORES.PRINT_JOBS, retryJob);
      logger.warn(`Print job ${jobId} will retry in ${backoffDelay}ms (attempt ${job.attempts + 1}/${job.maxAttempts})`);
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.dataStore.get<PrintJob>(STORES.PRINT_JOBS, jobId);
    if (!job) {
      throw new Error(`Print job ${jobId} not found`);
    }

    const retryJob: PrintJob = {
      ...job,
      status: 'pending',
      nextAttemptAt: undefined,
      error: undefined,
    };
    await this.dataStore.put(STORES.PRINT_JOBS, retryJob);
    
    // Trigger processing
    this.processQueue().catch((error) => {
      logger.error('Error processing print queue:', error);
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<PrintJob | undefined> {
    return this.dataStore.get<PrintJob>(STORES.PRINT_JOBS, jobId);
  }

  /**
   * Get all jobs for an order
   */
  async getJobsForOrder(orderId: string): Promise<PrintJob[]> {
    const allJobs = await this.dataStore.getAll<PrintJob>(STORES.PRINT_JOBS);
    return allJobs.filter((job) => job.orderId === orderId);
  }

  /**
   * Render print template (simple text-based ESC/POS)
   */
  private renderTemplate(type: PrintJobType, order: Order): string {
    const lines: string[] = [];

    if (type === 'receipt') {
      lines.push('='.repeat(32));
      lines.push('RECEIPT');
      lines.push('='.repeat(32));
      lines.push(`Order #${order.id}`);
      lines.push(`Date: ${new Date(order.createdAt).toLocaleString()}`);
      lines.push('');
      lines.push('Items:');
      order.items.forEach((item) => {
        lines.push(`${item.productName} x${item.quantity}`);
        lines.push(`  $${item.subtotal.toFixed(2)}`);
      });
      lines.push('');
      lines.push(`Subtotal: $${order.subtotal.toFixed(2)}`);
      lines.push(`Tax: $${order.tax.toFixed(2)}`);
      lines.push(`Total: $${order.total.toFixed(2)}`);
      lines.push('');
      if (order.customerName) {
        lines.push(`Customer: ${order.customerName}`);
      }
      if (order.notes) {
        lines.push(`Notes: ${order.notes}`);
      }
      lines.push('='.repeat(32));
      lines.push('Thank you!');
    } else if (type === 'kitchen') {
      lines.push('='.repeat(32));
      lines.push('KITCHEN ORDER');
      lines.push('='.repeat(32));
      lines.push(`Order #${order.id}`);
      lines.push(`Time: ${new Date(order.createdAt).toLocaleTimeString()}`);
      lines.push('');
      lines.push('Items:');
      order.items.forEach((item) => {
        lines.push(`${item.productName} x${item.quantity}`);
        if (item.notes) {
          lines.push(`  Note: ${item.notes}`);
        }
      });
      lines.push('');
      if (order.notes) {
        lines.push(`Order Notes: ${order.notes}`);
      }
      lines.push('='.repeat(32));
    } else if (type === 'bar') {
      lines.push('='.repeat(32));
      lines.push('BAR ORDER');
      lines.push('='.repeat(32));
      lines.push(`Order #${order.id}`);
      lines.push('');
      // Filter only bar items (could be based on category)
      const barItems = order.items; // Simplified
      barItems.forEach((item) => {
        lines.push(`${item.productName} x${item.quantity}`);
      });
      lines.push('='.repeat(32));
    }

    return lines.join('\n');
  }

  /**
   * Get default priority for job type
   */
  private getDefaultPriority(type: PrintJobType): number {
    const priorities: Record<PrintJobType, number> = {
      receipt: 1,
      kitchen: 3,
      bar: 2,
    };
    return priorities[type];
  }

  /**
   * Set printer bridge URL
   */
  setPrinterBridgeUrl(url: string): void {
    this.printerBridgeUrl = url;
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 1): Promise<void> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const allJobs = await this.dataStore.getAll<PrintJob>(STORES.PRINT_JOBS);
    
    const toDelete = allJobs.filter(
      (job) => job.status === 'completed' && job.completedAt && job.completedAt < cutoff
    );

    await Promise.all(toDelete.map((job) => this.dataStore.delete(STORES.PRINT_JOBS, job.id)));
    logger.info(`Cleaned up ${toDelete.length} old print jobs`);
  }
}

// Singleton instance
let printJobManagerInstance: PrintJobManager | null = null;

export const getPrintJobManager = (): PrintJobManager => {
  if (!printJobManagerInstance) {
    printJobManagerInstance = new PrintJobManager();
  }
  return printJobManagerInstance;
};

