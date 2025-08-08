import cron from 'node-cron';
import { DataSyncService } from './dataSyncService.js';

export class JobScheduler {
  constructor() {
    this.dataSyncService = new DataSyncService();
    this.isRunning = false;
  }

  startScheduledJobs() {
    console.log(' Starting scheduled BOM sync jobs...');
    
    // ทุก 5 นาที - Sync BOM Data
    cron.schedule('*/5 * * * *', async () => {
      if (!this.isRunning) {
        this.isRunning = true;
        console.log('🔄 Starting BOM sync...');
        try {
          await this.dataSyncService.syncBOMToAllMachines();
        } catch (error) {
          console.error('❌ BOM sync failed:', error);
        } finally {
          this.isRunning = false;
        }
      }
    });

    // ทุก 15 นาที - Full BOM sync
    cron.schedule('*/15 * * * *', async () => {
      if (!this.isRunning) {
        this.isRunning = true;
        console.log(' Starting full BOM sync...');
        try {
          await this.dataSyncService.syncBOMToAllMachines();
        } catch (error) {
          console.error('❌ Full BOM sync failed:', error);
        } finally {
          this.isRunning = false;
        }
      }
    });

    console.log('✅ Scheduled BOM sync jobs started');
  }

  stopScheduledJobs() {
    console.log(' Stopping scheduled jobs...');
  }
}
