/**
 * PrintSettings - Print queue management and settings
 */

import { useState, useEffect } from 'react';
import { getPrintJobManager } from '../../domain/print/PrintJobManager';
import type { PrintJob } from '../../domain/types';
import { SyncStatus } from '../common/SyncStatus';
import { getDataStore } from '../../data/OfflineDataStore';
import { STORES } from '../../data/dbConfig';
import { eventBus } from '../../utils/eventBus';

export function PrintSettings() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const printManager = getPrintJobManager();

  const loadJobs = async () => {
    try {
      setLoading(true);
      const dataStore = getDataStore();
      const allJobs = await dataStore.getAll<PrintJob>(STORES.PRINT_JOBS);
      setJobs(allJobs.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error('Failed to load print jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();

    // Subscribe to print job events
    const unsubscribe = eventBus.on('print:job-status-changed', () => {
      loadJobs();
    });

    // Poll for updates
    const interval = setInterval(loadJobs, 2000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const handleRetry = async (jobId: string) => {
    try {
      await printManager.retryJob(jobId);
      await loadJobs();
    } catch (error) {
      console.error('Failed to retry job:', error);
      alert('Failed to retry print job');
    }
  };

  const statusColors: Record<PrintJob['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    printing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading print jobs...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm p-3 md:p-4 flex-shrink-0">
        <div className="flex justify-between items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold">Print Queue</h1>
          <SyncStatus />
        </div>
      </header>

      {/* Print Jobs List */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4">
        <div className="space-y-2 md:space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow p-3 md:p-4 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm md:text-base">
                    {job.type.toUpperCase()} - Order #{job.orderId.slice(-6)}
                  </h3>
                  <p className="text-xs md:text-sm text-gray-500">
                    {new Date(job.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium self-start sm:self-auto ${statusColors[job.status]}`}>
                  {job.status}
                </span>
              </div>

              {job.status === 'failed' && (
                <div className="mb-2">
                  <p className="text-xs md:text-sm text-red-600 mb-2 break-words">{job.error}</p>
                  <button
                    onClick={() => handleRetry(job.id)}
                    className="px-4 py-2 md:py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    style={{ touchAction: 'manipulation', minHeight: '44px' }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {job.status === 'printing' && (
                <div className="text-sm text-blue-600">Printing...</div>
              )}

              {job.attempts > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Attempts: {job.attempts}/{job.maxAttempts}
                </div>
              )}
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No print jobs
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

