import cron from 'node-cron';
import { DataSyncService } from './dataSyncService.js';

export class JobScheduler {
  constructor() {
    this.dataSyncService = new DataSyncService();
    this.isRunning = false;
  }

  startScheduledJobs() {
    // Autosync disabled (moved to SQL Job and manual SP calls)
    console.log('Scheduled jobs are disabled.');
  }

  stopScheduledJobs() {
    console.log('Stopping scheduled jobs (none active).');
  }
}