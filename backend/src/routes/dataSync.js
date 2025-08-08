import express from 'express';
import { DataSyncService } from '../services/dataSyncService.js';
import { getAllDbConfigs } from '../dbUtil.js';

const router = express.Router();
const dataSyncService = new DataSyncService();

// POST /api/sync/bom - เริ่มการ sync BOM จาก Central ไป Local
router.post('/sync/bom', async (req, res) => {
  try {
    console.log('🔄 Manual BOM sync triggered');
    const results = await dataSyncService.syncBOMToAllMachines();
    res.json({ 
      success: true, 
      message: 'BOM sync completed',
      results: results,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Manual BOM sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date()
    });
  }
});

// POST /api/sync/bom/:machine - Sync BOM ไปยังเครื่องเฉพาะ
router.post('/sync/bom/:machine', async (req, res) => {
  try {
    const { machine } = req.params;
    const machines = getAllDbConfigs();
    const targetMachine = machines.find(m => m.name === machine);
    
    if (!targetMachine) {
      return res.status(404).json({ 
        success: false, 
        error: `Machine '${machine}' not found` 
      });
    }

    console.log(`🔄 Manual BOM sync to ${machine} triggered`);
    const result = await dataSyncService.syncBOMToLocalMachine(targetMachine);
    
    res.json({ 
      success: true, 
      message: `BOM sync to ${machine} completed`,
      result: result,
      timestamp: new Date()
    });
  } catch (error) {
    console.error(`❌ Manual BOM sync to ${req.params.machine} failed:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date()
    });
  }
});

// GET /api/sync/status - ตรวจสอบสถานะการ sync
router.get('/sync/status', async (req, res) => {
  try {
    const status = await dataSyncService.getSyncStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Failed to get sync status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date()
    });
  }
});

// GET /api/sync/test-connection - ทดสอบการเชื่อมต่อ
router.get('/sync/test-connection', async (req, res) => {
  try {
    const machines = getAllDbConfigs();
    const results = {};

    for (const machine of machines) {
      try {
        const isOnline = await dataSyncService.checkMachineOnline(machine);
        results[machine.name] = {
          online: isOnline,
          host: machine.host,
          database: machine.database
        };
      } catch (error) {
        results[machine.name] = {
          online: false,
          error: error.message,
          host: machine.host,
          database: machine.database
        };
      }
    }

    res.json({
      success: true,
      data: results,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date()
    });
  }
});

// GET /api/sync/bom/central-data - ดูข้อมูล BOM ใน Central Database
router.get('/sync/bom/central-data', async (req, res) => {
  try {
    const centralData = await dataSyncService.getBOMDataFromCentral();
    res.json({
      success: true,
      data: centralData,
      count: centralData.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Failed to get central BOM data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date()
    });
  }
});

export default router;
