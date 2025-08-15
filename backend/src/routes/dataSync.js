import express from 'express';
import { DataSyncService } from '../services/dataSyncService.js';
import { getAllDbConfigs } from '../dbUtil.js';
import sql from 'mssql';

const CENTRAL = {
  server: '192.168.100.222',
  database: 'PP_OCP',
  user: 'sa',
  password: '',
  options: { encrypt: false, trustServerCertificate: true }
};

const router = express.Router();
const dataSyncService = new DataSyncService();

// POST /api/bom - เริ่มการ sync BOM จาก Central ไป Local
router.post('/bom', async (req, res) => {
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

router.post('/check-p/:machine/sp', async (req, res) => {
	try {
		const { machine } = req.params;
		const machines = getAllDbConfigs();
		const targetMachine = machines.find(m => m.name === machine);
		if (!targetMachine) {
			return res.status(404).json({ success: false, error: `Machine '${machine}' not found` });
		}
		const result = await dataSyncService.syncCheckPViaCentralSP(targetMachine);
		res.json({ success: true, message: `Executed SP for ${machine}`, result, timestamp: new Date() });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message, timestamp: new Date() });
	}
});

// POST /api/bom/:machine - Sync BOM ไปยังเครื่องเฉพาะ
router.post('/bom/:machine', async (req, res) => {
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

// GET /api/status - ตรวจสอบสถานะการ sync
router.get('/status', async (req, res) => {
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

// GET /api/test-connection - ทดสอบการเชื่อมต่อ
router.get('/test-connection', async (req, res) => {
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

// GET /api/bom/central-data - ดูข้อมูล BOM ใน Central Database
router.get('/bom/central-data', async (req, res) => {
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

// GET /api/sync/check-p?search=&page=1&pageSize=10
router.get('/check-p', async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.max(parseInt(req.query.pageSize || '10', 10), 1);
  const offset = (page - 1) * pageSize;
  const start = offset + 1;
  const end = offset + pageSize;

  let pool;
  try {
    pool = await sql.connect(CENTRAL);

    const where = [];
    if (search) {
      where.push(`(
        matcode LIKE @kw OR
        [size] LIKE @kw OR
        matgroup LIKE @kw OR
        internal_size LIKE @kw OR
        sap_description LIKE @kw
      )`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Total count
    const countReq = pool.request();
    if (search) countReq.input('kw', sql.NVarChar, `%${search}%`);
    const countRes = await countReq.query(`SELECT COUNT(*) AS total FROM dbo.tbl_check_p ${whereSql}`);
    const total = countRes.recordset[0]?.total || 0;

    // Paged data using ROW_NUMBER for wide SQL Server compatibility
    const listReq = pool.request();
    if (search) listReq.input('kw', sql.NVarChar, `%${search}%`);
    listReq.input('start', sql.Int, start).input('end', sql.Int, end);
    const listRes = await listReq.query(`
      SELECT * FROM (
        SELECT 
          matcode, [length], [size], qty, matgroup,
          minweight, maxweight, mintisweight, maxtisweight,
          remark, internal_size, last_update, color, speed,
          table_weight, sap_description, actual_thickness, cIn, cOut,
          ROW_NUMBER() OVER (ORDER BY last_update DESC, matcode ASC) AS rn
        FROM dbo.tbl_check_p
        ${whereSql}
      ) t
      WHERE t.rn BETWEEN @start AND @end
      ORDER BY t.rn
    `);

    res.json({ success: true, data: listRes.recordset, total, page, pageSize });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    if (pool) await pool.close().catch(()=>{});
  }
});

// POST /api/sync/check-p
router.post('/check-p', async (req, res) => {
  const {
    matcode, length, size, qty, matgroup,
    minweight, maxweight, mintisweight, maxtisweight,
    remark, internal_size, color, speed, table_weight,
    sap_description, actual_thickness, cIn, cOut
  } = req.body;

  if (!matcode) return res.status(400).json({ success:false, error:'matcode is required' });

  let pool;
  try {
    pool = await sql.connect(CENTRAL);
    const q = `
      IF EXISTS (SELECT 1 FROM dbo.tbl_check_p WHERE matcode=@matcode)
        UPDATE dbo.tbl_check_p SET
          [length]=@length, [size]=@size, qty=@qty, matgroup=@matgroup,
          minweight=@minweight, maxweight=@maxweight,
          mintisweight=@mintisweight, maxtisweight=@maxtisweight,
          remark=@remark, internal_size=@internal_size, color=@color,
          speed=@speed, table_weight=@table_weight, sap_description=@sap_description,
          actual_thickness=@actual_thickness, cIn=@cIn, cOut=@cOut,
          last_update=GETDATE()
        WHERE matcode=@matcode;
      ELSE
        INSERT INTO dbo.tbl_check_p
          (matcode,[length],[size],qty,matgroup,minweight,maxweight,mintisweight,maxtisweight,
           remark,internal_size,last_update,color,speed,table_weight,sap_description,
           actual_thickness,cIn,cOut)
        VALUES
          (@matcode,@length,@size,@qty,@matgroup,@minweight,@maxweight,@mintisweight,@maxtisweight,
           @remark,@internal_size,GETDATE(),@color,@speed,@table_weight,@sap_description,
           @actual_thickness,@cIn,@cOut);
    `;
    await pool.request()
      .input('matcode', sql.NVarChar(40), matcode)
      .input('length', sql.NVarChar(100), length ?? null)
      .input('size', sql.NVarChar(100), size ?? null)
      .input('qty', sql.Int, qty ?? null)
      .input('matgroup', sql.NVarChar(100), matgroup ?? null)
      .input('minweight', sql.Float, minweight ?? null)
      .input('maxweight', sql.Float, maxweight ?? null)
      .input('mintisweight', sql.Float, mintisweight ?? null)
      .input('maxtisweight', sql.Float, maxtisweight ?? null)
      .input('remark', sql.NVarChar(40), remark ?? null)
      .input('internal_size', sql.NVarChar(100), internal_size ?? null)
      .input('color', sql.NVarChar(40), color ?? null)
      .input('speed', sql.Int, speed ?? null)
      .input('table_weight', sql.Decimal(18,3), table_weight ?? null)
      .input('sap_description', sql.NVarChar(100), sap_description ?? null)
      .input('actual_thickness', sql.Float, actual_thickness ?? null)
      .input('cIn', sql.Float, cIn ?? null)
      .input('cOut', sql.Float, cOut ?? null)
      .query(q);

    res.json({ success:true, message:'Saved to PP_OCP.tbl_check_p' });
  } catch (e) {
    res.status(500).json({ success:false, error:e.message });
  } finally {
    if (pool) await pool.close().catch(()=>{});
  }
});

export default router;
