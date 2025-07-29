import express from 'express';
import sql from 'mssql';
import { getAllDbConfigs, getDbConfigByName, checkDbOnline, queryA2Rpt, queryA2RptSummary, queryA2RptSum, queryA2RptSummarySizeSum, queryStationData, queryPlanningData, updateProductionPlan } from './dbUtil.js';
import xlsx from 'xlsx';

const router = express.Router();

// GET /api/instances - รายชื่อเครื่องและสถานะออนไลน์
router.get('/instances', async (req, res) => {
  const dbs = getAllDbConfigs();
  const results = await Promise.all(
    dbs.map(async db => ({
      name: db.name,
      host: db.host,
      database: db.database,
      m: db.m,
      online: await checkDbOnline(db)
    }))
  );
  res.json(results);
});

// GET /api/instances/list - รายชื่อเครื่อง (ไม่เช็คสถานะ)
router.get('/instances/list', (req, res) => {
  const dbs = getAllDbConfigs();
  const results = dbs.map(db => ({
    name: db.name,
    host: db.host,
    database: db.database,
    m: db.m
  }));
  res.json(results);
});

// GET /api/instances/status?name=... - เช็คสถานะ online เฉพาะเครื่อง
router.get('/instances/status', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'ต้องระบุ name' });
  const dbConfig = getDbConfigByName(name);
  if (!dbConfig) return res.status(404).json({ error: 'ไม่พบเครื่องที่ระบุ' });
  const online = await checkDbOnline(dbConfig);
  res.json({ name, online });
});

// GET /api/a2rpt?name=...&year=2024&month=6&page=1&pageSize=20
router.get('/a2rpt', async (req, res) => {
  const { name, year, month, page = 1, pageSize = 20 } = req.query;
  if (!name || !year || !month) {
    return res.status(400).json({ error: 'ต้องระบุ name, year, month' });
  }
  const dbConfig = getDbConfigByName(name);
  if (!dbConfig) {
    return res.status(404).json({ error: 'ไม่พบเครื่องที่ระบุ' });
  }
  try {
    const data = await queryA2Rpt(dbConfig, year, month, parseInt(page), parseInt(pageSize));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล', detail: err.message });
  }
});

// เพิ่มฟังก์ชัน sanitizeFilename
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_');
}

// GET /api/a2rpt/export?name=...&year=2024&month=6
router.get('/a2rpt/export', async (req, res) => {
  const { name, year, month } = req.query;
  if (!name || !year || !month) {
    return res.status(400).json({ error: 'ต้องระบุ name, year, month' });
  }
  const dbConfig = getDbConfigByName(name);
  if (!dbConfig) {
    return res.status(404).json({ error: 'ไม่พบเครื่องที่ระบุ' });
  }
  try {
    // ดึงข้อมูลทั้งหมด (ไม่แบ่งหน้า)
    let page = 1;
    const pageSize = 1000;
    let allData = [];
    while (true) {
      const data = await queryA2Rpt(dbConfig, year, month, page, pageSize);
      if (!data.length) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      page++;
    }
    // ดึง summary
    const summary = await queryA2RptSummary(dbConfig, year, month);
    // ดึง sum ทั้งหมด
    const sum = await queryA2RptSum(dbConfig, year, month);
    // ดึง sum แยก size
    const sizeSums = await queryA2RptSummarySizeSum(dbConfig, year, month);
    // สร้างไฟล์ Excel
    // กำหนดหัวคอลัมน์ใหม่
    const headers = [
      [
        'วันที่ผลิต',
        'Heat No.',
        'มัดที่',
        'ชนิดผลิตภัณฑ์',
        'ความยาว(เมตร)',
        'เกรด',
        'จำนวน(เส้น)',
        'น้ำหนัก(Kg.)',
        'หมายเหตุ'
      ]
    ];
    // map ข้อมูลให้ตรงกับหัวคอลัมน์ใหม่
    const mappedData = allData.map(row => [
      row.rmd_date
        ? (typeof row.rmd_date === 'string'
            ? row.rmd_date.split('T')[0]
            : (row.rmd_date instanceof Date
                ? row.rmd_date.toISOString().split('T')[0]
                : ''))
        : '', // วันที่ผลิต
      row.hn,           // Heat No.
      row.rmd_qty2,     // มัดที่
      row.rmd_size,     // ชนิดผลิตภัณฑ์
      row.rmd_length,   // ความยาว(เมตร)
      row.rmd_qa_grade, // เกรด
      row.rmd_qty3,     // จำนวน(เส้น)
      row.rmd_weight,   // น้ำหนัก(Kg.)
      row.rmd_remark    // หมายเหตุ
    ]);
    const ws = xlsx.utils.aoa_to_sheet([...headers, ...mappedData]);
    // --- เพิ่ม sum ใต้ตารางหลัก ---
    const sumRow = ['', '', '', '', '', 'รวม', sum.sQty3 || 0, sum.sweight || 0, ''];
    xlsx.utils.sheet_add_aoa(ws, [sumRow], {origin: -1});
    // --- เพิ่ม summary ต่อท้าย ---
    // แปลงเลขเดือนเป็นชื่อเดือนภาษาไทย
    const monthNames = [
      '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const monthName = monthNames[parseInt(month, 10)];
    // หา row สุดท้าย
    const lastRow = headers.length + mappedData.length + 3; // +1 sum +1 เว้นบรรทัด
    // หัวข้อ summary
    xlsx.utils.sheet_add_aoa(ws, [[`สรุปรายงานผลิตภัณฑ์ที่ไม่เป็นไปตามข้อกำหนดประจำเดือน ${monthName}`]], {origin: `A${lastRow}`});
    // หัวตาราง summary
    xlsx.utils.sheet_add_aoa(ws, [[
      'ชนิดผลิตภัณฑ์', 'เกรด', 'ปัญหา', 'จำนวนเส้น', 'น้ำหนัก(Kg.)'
    ]], {origin: `A${lastRow+1}`});
    // --- สร้าง summary group by size ---
    // group summary by rmd_size
    const summaryBySize = {};
    summary.forEach(row => {
      if (!summaryBySize[row.rmd_size]) summaryBySize[row.rmd_size] = [];
      summaryBySize[row.rmd_size].push(row);
    });
    // map sizeSums เป็น object
    const sizeSumMap = {};
    sizeSums.forEach(s => { sizeSumMap[s.rmd_size] = s; });
    // สร้าง rows
    let summaryRows = [];
    Object.keys(summaryBySize).forEach(size => {
      summaryBySize[size].forEach(row => {
        summaryRows.push([
          row.rmd_size, row.rmd_qa_grade, row.rmd_remark, row.sumqty3, row.sweight
        ]);
      });
      // ต่อด้วยบรรทัดรวมของ size นี้
      const sizeSum = sizeSumMap[size];
      summaryRows.push(['', '', 'รวม', sizeSum ? sizeSum.sQty3 : 0, sizeSum ? sizeSum.sweight : 0]);
    });
    xlsx.utils.sheet_add_aoa(ws, summaryRows, {origin: `A${lastRow+2}`});
    // ---
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'A2 Report');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    // ใช้ sanitizeFilename กับ name
    const safeName = sanitizeFilename(name);
    res.setHeader('Content-Disposition', `attachment; filename="a2rpt_${safeName}_${year}-${month}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการ export Excel', detail: err.message });
  }
});
// GET /api/compare/planning?name=...&station=...&fromDate=...&toDate=... - ดึงข้อมูลจาก Planning
router.get('/compare/planning', async (req, res) => {
  console.log('=== DEBUG: /api/compare/planning ===');
  console.log('�� Request Parameters:');
  console.log('  - name:', req.query.name);
  console.log('  - station:', req.query.station);
  console.log('  - fromDate:', req.query.fromDate);
  console.log('  - toDate:', req.query.toDate);
  
  try {
    // Decode URL parameters
    const name = decodeURIComponent(req.query.name || '');
    const station = decodeURIComponent(req.query.station || '');
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    
    console.log('�� Decoded Parameters:');
    console.log('  - name:', name);
    console.log('  - station:', station);
    console.log('  - fromDate:', fromDate);
    console.log('  - toDate:', toDate);
    
    if (!name || !station || !fromDate || !toDate) {
      console.log('❌ Missing required parameters');
      return res.status(400).json({ 
        error: 'ต้องระบุ name, station, fromDate, toDate',
        received: { name, station, fromDate, toDate }
      });
    }
    
    const dbConfig = getDbConfigByName(name);
    if (!dbConfig) {
      console.log('❌ Database config not found for:', name);
      return res.status(404).json({ 
        error: 'ไม่พบเครื่องที่ระบุ',
        searchedName: name,
        availableNames: getAllDbConfigs().map(db => db.name)
      });
    }
    
    console.log('�� Found DB Config:', {
      name: dbConfig.name,
      host: dbConfig.host,
      database: dbConfig.database
    });
    
    console.log('📊 Calling queryPlanningData...');
    const data = await queryPlanningData(dbConfig, station, fromDate, toDate);
    console.log('✅ Data retrieved successfully, count:', data.length);
    
    res.json({ data });
  } catch (err) {

    
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Planning', 
      detail: err.message 
    });
  }
});

// GET /api/compare/both?name=...&station=...&fromDate=...&toDate=... - ดึงข้อมูลทั้งสองฝั่งพร้อมกัน
router.get('/compare/both', async (req, res) => {
  console.log('=== DEBUG: /api/compare/both ===');
  console.log('�� Request Parameters:');
  console.log('  - name:', req.query.name);
  console.log('  - station:', req.query.station);
  console.log('  - fromDate:', req.query.fromDate);
  console.log('  - toDate:', req.query.toDate);
  
  try {
    // Decode URL parameters
    const name = decodeURIComponent(req.query.name || '');
    const station = decodeURIComponent(req.query.station || '');
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    
    console.log('�� Decoded Parameters:');
    console.log('  - name:', name);
    console.log('  - station:', station);
    console.log('  - fromDate:', fromDate);
    console.log('  - toDate:', toDate);
    
    if (!name || !station || !fromDate || !toDate) {
      console.log('❌ Missing required parameters');
      return res.status(400).json({ 
        error: 'ต้องระบุ name, station, fromDate, toDate',
        received: { name, station, fromDate, toDate }
      });
    }
    
    const dbConfig = getDbConfigByName(name);
    if (!dbConfig) {
      console.log('❌ Database config not found for:', name);
      return res.status(404).json({ 
        error: 'ไม่พบเครื่องที่ระบุ', 
        searchedName: name,
        availableNames: getAllDbConfigs().map(db => db.name)
      });
    }
    
    console.log('�� Found DB Config:', {
      name: dbConfig.name,
      host: dbConfig.host,
      database: dbConfig.database
    });
    
    console.log('📊 Fetching compare data...');
    
    const [stationData, planningData] = await Promise.all([
      queryStationData(dbConfig, fromDate, toDate),
      queryPlanningData(dbConfig, station, fromDate, toDate)
    ]);
    
    console.log('✅ Data retrieved successfully:');
    console.log('  - Station data count:', stationData.length);
    console.log('  - Planning data count:', planningData.length);
    
    res.json({ 
      station: { data: stationData },
      planning: { data: planningData }
    });
  } catch (err) {
    console.error('❌ Error in /api/compare/both:');
    console.error('  - Error message:', err.message);
    console.error('  - Error code:', err.code);
    console.error('  - Error state:', err.state);
    console.error('  - Server name:', err.serverName);
    console.error('  - Line number:', err.lineNumber);
    console.error('  - Class:', err.class);
    console.error('  - Number:', err.number);
    
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลเปรียบเทียบ', 
      detail: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET /api/compare/planning_dev - ทดสอบการเชื่อมต่อและดึงข้อมูลล่าสุดจาก production_plan
router.get('/compare/planning_dev', async (req, res) => {
  console.log('=== DEBUG: /api/compare/planning_dev ===');
  console.log('🔍 Testing database connection and latest data...');

  // รับค่าจาก query string
  const fromDate = req.query.fromDate;
  const toDate = req.query.toDate;
  console.log('  - fromDate:', fromDate);
  console.log('  - toDate:', toDate);

  try {
    // ใช้ CEO_REPORT database สำหรับ production_plan
    const ceoReportConfig = {
      user: "sa",
      password: "",
      server: "192.168.100.222",
      database: "ceo_report",
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true
      },
      pool: { max: 2, min: 0, idleTimeoutMillis: 5000 }
    };
    
    console.log('📋 CEO_REPORT Config:');
    console.log('  - Server:', ceoReportConfig.server);
    console.log('  - Database:', ceoReportConfig.database);
    console.log('  - User:', ceoReportConfig.user);
    console.log('  - Password:', ceoReportConfig.password ? '***' : '(blank)');
    
    let sqlQuery;
    let request;
    if (fromDate && toDate) {
      sqlQuery = `
        SELECT * 
        FROM production_plan 
        WHERE postingdate BETWEEN @fromDate AND @toDate
        ORDER BY postingdate DESC
      `;
      console.log('📋 SQL Query (with date filter):');
      console.log(sqlQuery);
      request = (pool) => pool.request()
        .input('fromDate', sql.VarChar, fromDate)
        .input('toDate', sql.VarChar, toDate)
        .query(sqlQuery);
    } else {
      sqlQuery = `
        SELECT TOP 1 * 
        FROM production_plan 
        ORDER BY postingdate DESC
      `;
      console.log('📋 SQL Query (latest only):');
      console.log(sqlQuery);
      request = (pool) => pool.request().query(sqlQuery);
    }
    
    console.log('🔌 Attempting to connect to CEO_REPORT...');
    const pool = await sql.connect(ceoReportConfig);
    console.log('✅ Connected to CEO_REPORT successfully');
    
    console.log('📊 Executing query...');
    const result = await request(pool);
    
    console.log('✅ Query executed successfully');
    console.log('📊 Result count:', result.recordset.length);
    
    if (result.recordset.length > 0) {
      console.log('📋 Latest data:', result.recordset[0]);
    } else {
      console.log('📋 No data found');
    }
    
    await pool.close();
    console.log('🔌 Connection closed');
    
    res.json({ 
      success: true,
      message: 'ทดสอบการเชื่อมต่อสำเร็จ',
      data: result.recordset,
      recordCount: result.recordset.length
    });
    
  } catch (err) {
    console.error('❌ Error in /api/compare/planning_dev:');
    console.error('  - Error message:', err.message);
    console.error('  - Error code:', err.code);
    console.error('  - Error state:', err.state);
    console.error('  - Server name:', err.serverName);
    console.error('  - Line number:', err.lineNumber);
    console.error('  - Class:', err.class);
    console.error('  - Number:', err.number);
    
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการทดสอบการเชื่อมต่อ', 
      detail: err.message,
      serverName: err.serverName,
      errorCode: err.code
    });
  }
});

// POST /api/compare/update - อัพเดตข้อมูล Production Plan
router.post('/compare/update', async (req, res) => {
  const { name, station, fromDate, toDate, shift, user } = req.body;
  if (!name || !station || !fromDate || !toDate) {
    return res.status(400).json({ error: 'ต้องระบุ name, station, fromDate, toDate' });
  }
  const dbConfig = getDbConfigByName(name);
  if (!dbConfig) {
    return res.status(404).json({ error: 'ไม่พบเครื่องที่ระบุ' });
  }
  try {
    const result = await updateProductionPlan(dbConfig, station, fromDate, toDate, shift || "Z", user || "system");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัพเดตข้อมูล', detail: err.message });
  }
});

// GET /api/compare/both?name=...&station=...&fromDate=...&toDate=... - ดึงข้อมูลทั้งสองฝั่งพร้อมกัน
router.get('/compare/both', async (req, res) => {
  try {
    // Decode URL parameters
    const name = decodeURIComponent(req.query.name || '');
    const station = decodeURIComponent(req.query.station || '');
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    
    if (!name || !station || !fromDate || !toDate) {
      return res.status(400).json({ 
        error: 'ต้องระบุ name, station, fromDate, toDate',
        received: { name, station, fromDate, toDate }
      });
    }
    
    const dbConfig = getDbConfigByName(name);
    if (!dbConfig) {
      return res.status(404).json({ 
        error: 'ไม่พบเครื่องที่ระบุ', 
        searchedName: name,
        availableNames: getAllDbConfigs().map(db => db.name)
      });
    }
    
    console.log('Fetching compare data:', { name, station, fromDate, toDate });
    
    const [stationData, planningData] = await Promise.all([
      queryStationData(dbConfig, fromDate, toDate),
      queryPlanningData(dbConfig, station, fromDate, toDate)
    ]);
    
    res.json({ 
      station: { data: stationData },
      planning: { data: planningData }
    });
  } catch (err) {
    console.error('Error in /api/compare/both:', err);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลเปรียบเทียบ', 
      detail: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

export default router; 