import express from 'express';
import sql from 'mssql';
import path from 'path';
import fs from 'fs';
import { getAllDbConfigs, getDbConfigByName, checkDbOnline, queryA2Rpt, queryA2RptSummary, queryA2RptSum, queryA2RptSummarySizeSum, queryStationData, queryPlanningData, updateProductionPlan, mapMachineToStation, mapMachineToProductionPlan } from './dbUtil.js';
import xlsx from 'xlsx';
import axios from 'axios';

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

// GET /api/instances/finish-goods?name=... - ดึง finish goods ล่าสุด
router.get('/instances/finish-goods', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'ต้องระบุ name' });
  
  // ไม่ต้องใช้ getDbConfigByName เพราะเราจะใช้ hardcoded config
  // const dbConfig = getDbConfigByName(name);
  // if (!dbConfig) return res.status(404).json({ error: 'ไม่พบเครื่องที่ระบุ' });
  
  try {
    // ใช้ database PP ที่ 192.168.100.222
    const ppConfig = {
      user: "sa",
      password: "",
      server: "192.168.100.222",
      database: "PP",
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000,
        requestTimeout: 10000
      },
      pool: { max: 1, min: 0, idleTimeoutMillis: 3000 }
    };
    
    console.log('🔍 PP Config:', {
      server: ppConfig.server,
      database: ppConfig.database,
      user: ppConfig.user
    });
    
    // แปลงชื่อเครื่องเป็น station code
    const mappedStation = mapMachineToStation(name);
    console.log('🔍 === /api/instances/finish-goods ===');
    console.log('🔍 Request query:', req.query);
    console.log('🔍 Mapped station:', name, '→', mappedStation);
    console.log('🔍 Using rmd_station for query');
    
    const sqlQuery = `
      SELECT TOP 1 [rmd_size], [rmd_date]
      FROM tbl_production_scale
      WHERE rmd_plant = 'OCP' 
      AND [rmd_station] = @station
      AND [rmd_qa_grade] IN ('A1', 'A2')
      ORDER BY rmd_Date DESC, rmd_qty2 DESC
    `;
    
    console.log('🔍 SQL Query:', sqlQuery);
    console.log('🔍 Parameters:', { station: mappedStation });
    
    console.log('🔍 Connecting to database...');
    const pool = await sql.connect(ppConfig);
    console.log('✅ Connected successfully');
    
    console.log('🔍 Executing query...');
    const result = await pool.request()
      .input('station', sql.VarChar, mappedStation)
      .query(sqlQuery);
    console.log('✅ Query executed successfully');
    
    await pool.close();
    console.log('✅ Connection closed');
    
    const size = result.recordset.length > 0 ? result.recordset[0].rmd_size : null;
    const lastProductionDate = result.recordset.length > 0 ? result.recordset[0].rmd_date : null;
    console.log('🔍 Query result:', result.recordset);
    console.log('🔍 Final size value:', size);
    console.log('🔍 Last production date:', lastProductionDate);
    res.json({ 
      size,
      lastProductionDate: lastProductionDate ? new Date(lastProductionDate).toLocaleDateString('th-TH') : null
    });
  } catch (err) {
    console.error('❌ Error fetching finish goods:', err.message);
    console.error('❌ Error type:', err.constructor.name);
    console.error('❌ Error details:', {
      code: err.code,
      state: err.state,
      serverName: err.serverName,
      lineNumber: err.lineNumber,
      stack: err.stack
    });
    
    // ถ้าเป็น connection error ให้ return ข้อมูลว่าง
    if (err.message.includes('aborted') || err.message.includes('timeout')) {
      console.log('⚠️ Connection timeout/aborted, returning empty data');
      return res.json({ size: null });
    }
    
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล finish goods', 
      detail: err.message,
      code: err.code
    });
  }
});

// GET /api/instances/production-plan?name=... - ดึงแผนผลิตปัจจุบัน
router.get('/instances/production-plan', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'ต้องระบุ name' });
  
  // ไม่ต้องใช้ getDbConfigByName เพราะเราจะใช้ hardcoded config
  // const dbConfig = getDbConfigByName(name);
  // if (!dbConfig) return res.status(404).json({ error: 'ไม่พบเครื่องที่ระบุ' });
  
  try {
    // ใช้ CEO_REPORT database
    const ceoReportConfig = {
      user: "sa",
      password: "",
      server: "192.168.100.222",
      database: "ceo_report",
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 15000
      },
      pool: { 
        max: 10,         // เพิ่มจาก 5 เป็น 10
        min: 0, 
        idleTimeoutMillis: 10000,     // เพิ่มจาก 5000
        acquireTimeoutMillis: 15000,  // เพิ่มจาก 10000
        createTimeoutMillis: 15000,   // เพิ่มจาก 10000
        destroyTimeoutMillis: 10000,  // เพิ่มจาก 5000
        reapIntervalMillis: 2000,     // เพิ่มจาก 1000
        createRetryIntervalMillis: 500 // เพิ่มจาก 200
      }
    };
    
    const mappedStation = mapMachineToProductionPlan(name);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    console.log('🔍 === /api/instances/production-plan ===');
    console.log('🔍 Request query:', req.query);
    console.log('🔍 Mapped station:', name, '→', mappedStation);
    
    const sqlQuery = `
      SELECT size 
      FROM [CEO_REPORT].[dbo].[production_plan]
      WHERE station = @station 
      AND postingdate = @today
    `;
    
    const pool = await sql.connect(ceoReportConfig);
    const result = await pool.request()
      .input('station', sql.VarChar, mappedStation)
      .input('today', sql.VarChar, today)
      .query(sqlQuery);
    await pool.close();
    
    const maktx = result.recordset.length > 0 ? result.recordset[0].size : null;
    res.json({ maktx });
  } catch (err) {
    console.error('Error fetching production plan:', err.message);
    console.error('Error details:', {
      code: err.code,
      state: err.state,
      serverName: err.serverName,
      lineNumber: err.lineNumber
    });
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลแผนผลิต', 
      detail: err.message,
      code: err.code
    });
  }
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
    
    // แยกการเรียก API เพื่อให้ error handling ดีขึ้น
    let stationData = [];
    let planningData = [];
    
    try {
      stationData = await queryStationData(dbConfig, fromDate, toDate);
      console.log('✅ Station data retrieved successfully, count:', stationData.length);
    } catch (err) {
      console.error('❌ Error fetching station data:', err.message);
      // ไม่ throw error แต่ให้ stationData เป็น array ว่าง
    }
    
    try {
      planningData = await queryPlanningData(dbConfig, station, fromDate, toDate);
      console.log('✅ Planning data retrieved successfully, count:', planningData.length);
    } catch (err) {
      console.error('❌ Error fetching planning data:', err.message);
      // ไม่ throw error แต่ให้ planningData เป็น array ว่าง
    }
    
    console.log('✅ Compare data retrieved:');
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
    const result = await updateProductionPlan(dbConfig, station, fromDate, toDate, "Z", user || "system");
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

// GET /api/test/finish-goods - ทดสอบ finish goods ผ่าน browser
router.get('/test/finish-goods', async (req, res) => {
  const { name = 'I1' } = req.query; // default value
  
  try {
    // ใช้ database PP ที่ 192.168.100.222
    const ppConfig = {
      user: "sa",
      password: "",
      server: "192.168.100.222",
      database: "PP",
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000,
        requestTimeout: 10000
      },
      pool: { max: 1, min: 0, idleTimeoutMillis: 3000 }
    };
    
    // แปลงชื่อเครื่องเป็น station code
    const mappedStation = mapMachineToStation(name);
    
    const sqlQuery = `
      SELECT TOP 1 [rmd_size]
      FROM tbl_production_scale
      WHERE rmd_plant = 'OCP' 
      AND [rmd_station] = @station
      ORDER BY rmd_Date DESC, rmd_qty2 DESC
    `;
    
    const pool = await sql.connect(ppConfig);
    const result = await pool.request()
      .input('station', sql.VarChar, mappedStation)
      .query(sqlQuery);
    await pool.close();
    
    const size = result.recordset.length > 0 ? result.recordset[0].rmd_size : null;
    
    // สร้าง HTML response สำหรับ browser
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Finish Goods Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .result { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .error { background: #ffebee; color: #c62828; }
          .success { background: #e8f5e8; color: #2e7d32; }
          .info { background: #e3f2fd; color: #1565c0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Finish Goods Test</h1>
          
          <div class="info">
            <h3>📋 Test Parameters:</h3>
            <p><strong>Machine Name:</strong> ${name}</p>
            <p><strong>Mapped Station:</strong> ${mappedStation}</p>
            <p><strong>Database:</strong> PP (192.168.100.222)</p>
            <p><strong>Table:</strong> tbl_production_scale</p>
          </div>
          
          <div class="result ${size ? 'success' : 'error'}">
            <h3>📊 Result:</h3>
            <p><strong>Latest Finish Goods Size:</strong> ${size || 'ไม่พบข้อมูล'}</p>
          </div>
          
          <div class="info">
            <h3>🔗 Test Other Machines:</h3>
            <p><a href="/api/test/finish-goods?name=ท่อดำ #1">ท่อดำ #1</a></p>
            <p><a href="/api/test/finish-goods?name=ท่อดำ #2">ท่อดำ #2</a></p>
            <p><a href="/api/test/finish-goods?name=ท่อดำ #8">ท่อดำ #8</a></p>
            <p><a href="/api/test/finish-goods?name=ตัวซี #2">ตัวซี #2</a></p>
            <p><a href="/api/test/finish-goods?name=ตัวซี #5">ตัวซี #5</a></p>
          </div>
          
          <div class="info">
            <h3>📅 Last Updated:</h3>
            <p>${new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error fetching finish goods:', err.message);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Finish Goods Test - Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Finish Goods Test - Error</h1>
          <div class="error">
            <h3>Error Details:</h3>
            <p><strong>Message:</strong> ${err.message}</p>
            <p><strong>Code:</strong> ${err.code || 'N/A'}</p>
            <p><strong>Server:</strong> ${err.serverName || 'N/A'}</p>
            <p><strong>Line:</strong> ${err.lineNumber || 'N/A'}</p>
          </div>
          <p><a href="/api/test/finish-goods">← Back to Test</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

// GET /api/test/production-plan - ทดสอบ production plan ผ่าน browser
router.get('/test/production-plan', async (req, res) => {
  const { name = 'I1' } = req.query; // default value
  
  try {
    // ใช้ CEO_REPORT database
    const ceoReportConfig = {
      user: "sa",
      password: "",
      server: "192.168.100.222",
      database: "ceo_report",
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000,
        requestTimeout: 10000
      },
      pool: { max: 1, min: 0, idleTimeoutMillis: 3000 }
    };
    
    const mappedStation = mapMachineToStation(name);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const sqlQuery = `
      SELECT size 
      FROM [CEO_REPORT].[dbo].[production_plan]
      WHERE station = @station 
      AND postingdate = @today
    `;
    
    const pool = await sql.connect(ceoReportConfig);
    const result = await pool.request()
      .input('station', sql.VarChar, mappedStation)
      .input('today', sql.VarChar, today)
      .query(sqlQuery);
    await pool.close();
    
    const maktx = result.recordset.length > 0 ? result.recordset[0].size : null;
    
    // สร้าง HTML response สำหรับ browser
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Production Plan Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .result { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .error { background: #ffebee; color: #c62828; }
          .success { background: #e8f5e8; color: #2e7d32; }
          .info { background: #e3f2fd; color: #1565c0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📋 Production Plan Test</h1>
          
          <div class="info">
            <h3>📋 Test Parameters:</h3>
            <p><strong>Machine Name:</strong> ${name}</p>
            <p><strong>Mapped Station:</strong> ${mappedStation}</p>
            <p><strong>Database:</strong> ceo_report (192.168.100.222)</p>
            <p><strong>Table:</strong> dbo.production_plan</p>
            <p><strong>Date:</strong> ${today}</p>
          </div>
          
          <div class="result ${maktx ? 'success' : 'error'}">
            <h3>📊 Result:</h3>
            <p><strong>Production Plan Size:</strong> ${maktx || 'ไม่พบข้อมูล'}</p>
          </div>
          
          <div class="info">
            <h3>🔗 Test Other Machines:</h3>
            <p><a href="/api/test/production-plan?name=ท่อดำ #1">ท่อดำ #1</a></p>
            <p><a href="/api/test/production-plan?name=ท่อดำ #2">ท่อดำ #2</a></p>
            <p><a href="/api/test/production-plan?name=ท่อดำ #8">ท่อดำ #8</a></p>
            <p><a href="/api/test/production-plan?name=ตัวซี #2">ตัวซี #2</a></p>
            <p><a href="/api/test/production-plan?name=ตัวซี #5">ตัวซี #5</a></p>
          </div>
          
          <div class="info">
            <h3>📅 Last Updated:</h3>
            <p>${new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error fetching production plan:', err.message);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Production Plan Test - Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Production Plan Test - Error</h1>
          <div class="error">
            <h3>Error Details:</h3>
            <p><strong>Message:</strong> ${err.message}</p>
            <p><strong>Code:</strong> ${err.code || 'N/A'}</p>
            <p><strong>Server:</strong> ${err.serverName || 'N/A'}</p>
            <p><strong>Line:</strong> ${err.lineNumber || 'N/A'}</p>
          </div>
          <p><a href="/api/test/production-plan">← Back to Test</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

// GET /api/test/tubdam1 - ทดสอบท่อดำ #1 โดยตรง
router.get('/test/tubdam1', async (req, res) => {
  console.log('🔍 === /api/test/tubdam1 ===');
  
  try {
    // ใช้ database PP ที่ 192.168.100.222
    const ppConfig = {
      user: "sa",
      password: "",
      server: "192.168.100.222",
      database: "PP",
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000,
        requestTimeout: 10000
      },
      pool: { max: 1, min: 0, idleTimeoutMillis: 3000 }
    };
    
    // ใช้ OCP I1 สำหรับท่อดำ #1
    const mappedStation = 'OCP I1';
    console.log('🔍 Testing with station:', mappedStation);
    
    const sqlQuery = `
      SELECT TOP 1 [rmd_size]
      FROM tbl_production_scale
      WHERE rmd_plant = 'OCP' 
      AND [rmd_station] = @station
      ORDER BY rmd_Date DESC, rmd_qty2 DESC
    `;
    
    console.log('🔍 SQL Query:', sqlQuery);
    console.log('🔍 Parameters:', { station: mappedStation });
    
    const pool = await sql.connect(ppConfig);
    const result = await pool.request()
      .input('station', sql.VarChar, mappedStation)
      .query(sqlQuery);
    await pool.close();
    
    const size = result.recordset.length > 0 ? result.recordset[0].rmd_size : null;
    
    // สร้าง HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ท่อดำ #1 Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .result { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .success { background: #e8f5e8; color: #2e7d32; }
          .error { background: #ffebee; color: #c62828; }
          .info { background: #e3f2fd; color: #1565c0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 ท่อดำ #1 Test</h1>
          
          <div class="info">
            <h3>📋 Test Parameters:</h3>
            <p><strong>Machine:</strong> ท่อดำ #1</p>
            <p><strong>Mapped Station:</strong> ${mappedStation}</p>
            <p><strong>Database:</strong> PP (192.168.100.222)</p>
            <p><strong>Table:</strong> tbl_production_scale</p>
            <p><strong>Field:</strong> rmd_station</p>
          </div>
          
          <div class="result ${size ? 'success' : 'error'}">
            <h3>📊 Result:</h3>
            <p><strong>Latest Finish Goods Size:</strong> ${size || 'ไม่พบข้อมูล'}</p>
          </div>
          
          <div class="info">
            <h3>📅 Last Updated:</h3>
            <p>${new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error testing ท่อดำ #1:', err.message);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ท่อดำ #1 Test - Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ ท่อดำ #1 Test - Error</h1>
          <div class="error">
            <h3>Error Details:</h3>
            <p><strong>Message:</strong> ${err.message}</p>
            <p><strong>Code:</strong> ${err.code || 'N/A'}</p>
            <p><strong>Server:</strong> ${err.serverName || 'N/A'}</p>
            <p><strong>Line:</strong> ${err.lineNumber || 'N/A'}</p>
          </div>
          <p><a href="/api/test/tubdam1">← Back to Test</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

// GET /api/test/machine-status - ทดสอบสถานะของเครื่องต่างๆ
router.get('/test/machine-status', async (req, res) => {
  console.log('🔍 === /api/test/machine-status ===');
  
  try {
    // ดึงข้อมูลจาก config file
    const configPath = path.join(process.cwd(), '..', 'db_instances.config.json');
    const dbInstances = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // กรองเครื่องทั้งหมดที่ต้องการทดสอบ
    const testMachines = dbInstances.filter(instance => 
      instance.name.startsWith('ท่อดำ') ||
      instance.name.startsWith('ตัวซี') ||
      instance.name.startsWith('สลิท') ||
      instance.name.startsWith('ตัดแผ่น')
    );
    
    const results = [];
    
    for (const machine of testMachines) {
      console.log(`🔍 Testing ${machine.name}...`);
      
      try {
        // ทดสอบ finish goods
        const ppConfig = {
          user: "sa",
          password: "",
          server: "192.168.100.222",
          database: "PP",
          port: 1433,
          options: {
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: 5000,
            requestTimeout: 10000
          },
          pool: { max: 1, min: 0, idleTimeoutMillis: 3000 }
        };
        
        const mappedStation = mapMachineToStation(machine.name);
        const mappedOCP = mapMachineToProductionPlan(machine.name);
        
        const fgQuery = `
          SELECT TOP 1 [rmd_size]
          FROM tbl_production_scale
          WHERE rmd_plant = 'OCP' 
          AND [rmd_station] = @station
          ORDER BY rmd_Date DESC, rmd_qty2 DESC
        `;
        
        const pool = await sql.connect(ppConfig);
        const fgResult = await pool.request()
          .input('station', sql.VarChar, mappedStation)
          .query(fgQuery);
        await pool.close();
        
        const fgSize = fgResult.recordset.length > 0 ? fgResult.recordset[0].rmd_size : null;
        
        // ทดสอบ production plan
        const ceoReportConfig = {
          user: "sa",
          password: "",
          server: "192.168.100.222",
          database: "ceo_report",
          port: 1433,
          options: {
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: 5000,
            requestTimeout: 10000
          },
          pool: { max: 1, min: 0, idleTimeoutMillis: 3000 }
        };
        
        const today = new Date().toISOString().split('T')[0];
        
        const ppQuery = `
          SELECT size 
          FROM [CEO_REPORT].[dbo].[production_plan]
          WHERE station = @station 
          AND postingdate = @today
        `;
        
        const ppPool = await sql.connect(ceoReportConfig);
        const ppResult = await ppPool.request()
          .input('station', sql.VarChar, mappedOCP)
          .input('today', sql.VarChar, today)
          .query(ppQuery);
        await ppPool.close();
        
        const ppSize = ppResult.recordset.length > 0 ? ppResult.recordset[0].size : null;
        
        results.push({
          name: machine.name,
          mappedStation: mappedStation,
          mappedOCP: mappedOCP,
          finishGoods: fgSize,
          productionPlan: ppSize,
          hasFG: fgSize !== null,
          hasPP: ppSize !== null
        });
        
      } catch (err) {
        console.error(`❌ Error testing ${machine.name}:`, err.message);
        results.push({
          name: machine.name,
          error: err.message,
          hasFG: false,
          hasPP: false
        });
      }
    }
    
    // สร้าง HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Machine Status Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          .machine { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .success { background: #e8f5e8; color: #2e7d32; }
          .error { background: #ffebee; color: #c62828; }
          .partial { background: #fff3e0; color: #ef6c00; }
          .info { background: #e3f2fd; color: #1565c0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
          th { background: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Machine Status Test</h1>
          
          <div class="info">
            <h3>📋 Test Results:</h3>
            <table>
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Mapped Station (FG)</th>
                  <th>Mapped OCP (PP)</th>
                  <th>Finish Goods</th>
                  <th>Production Plan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${results.map(result => `
                  <tr>
                    <td>${result.name}</td>
                    <td>${result.mappedStation || 'N/A'}</td>
                    <td>${result.mappedOCP || 'N/A'}</td>
                    <td>${result.finishGoods || 'ไม่มีข้อมูล'}</td>
                    <td>${result.productionPlan || 'ไม่มีข้อมูล'}</td>
                    <td>
                      ${result.error ? 
                        '<span style="color: red;">Error</span>' :
                        result.hasFG && result.hasPP ? 
                          '<span style="color: green;">✅ Both</span>' :
                          result.hasFG || result.hasPP ? 
                            '<span style="color: orange;">⚠️ Partial</span>' :
                            '<span style="color: red;">❌ None</span>'
                      }
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="info">
            <h3>📅 Last Updated:</h3>
            <p>${new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error in machine status test:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการทดสอบ', detail: err.message });
  }
});

// GET /api/test/card-endpoints - ทดสอบ card endpoints โดยตรง
router.get('/test/card-endpoints', async (req, res) => {
  console.log('🔍 === /api/test/card-endpoints ===');
  
  const testMachines = [
    // ท่อดำ 1-8
    'ท่อดำ #1', 'ท่อดำ #2', 'ท่อดำ #3', 'ท่อดำ #4', 
    'ท่อดำ #5', 'ท่อดำ #6', 'ท่อดำ #7', 'ท่อดำ #8',
    // ตัวซี 1-6
    'ตัวซี #1', 'ตัวซี #2', 'ตัวซี #3', 'ตัวซี #4', 'ตัวซี #5', 'ตัวซี #6',
    // สลิท 1-3
    'สลิท#1', 'สลิท#2', 'สลิท#3',
    // ตัดแผ่น 1,2,4
    'ตัดแผ่น 1', 'ตัดแผ่น 2', 'ตัดแผ่น 4'
  ];
  const results = [];
  
  for (const machineName of testMachines) {
    console.log(`🔍 Testing card endpoints for ${machineName}...`);
    
    try {
      // ทดสอบ finish-goods endpoint
      const fgResponse = await fetch(`http://localhost:4000/api/instances/finish-goods?name=${encodeURIComponent(machineName)}`);
      const fgData = await fgResponse.json();
      
      // ทดสอบ production-plan endpoint
      const ppResponse = await fetch(`http://localhost:4000/api/instances/production-plan?name=${encodeURIComponent(machineName)}`);
      const ppData = await ppResponse.json();
      
      results.push({
        name: machineName,
        finishGoods: fgData.size || 'ไม่มีข้อมูล',
        productionPlan: ppData.maktx || 'ไม่มีข้อมูล',
        fgResponse: fgData,
        ppResponse: ppData
      });
      
    } catch (err) {
      console.error(`❌ Error testing ${machineName}:`, err.message);
      results.push({
        name: machineName,
        error: err.message,
        finishGoods: 'Error',
        productionPlan: 'Error'
      });
    }
  }
  
  // สร้าง HTML response
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Card Endpoints Test</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .machine { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .success { background: #e8f5e8; color: #2e7d32; }
        .error { background: #ffebee; color: #c62828; }
        .partial { background: #fff3e0; color: #ef6c00; }
        .info { background: #e3f2fd; color: #1565c0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background: #f2f2f2; }
        pre { background: #f8f8f8; padding: 10px; border-radius: 3px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔍 Card Endpoints Test</h1>
        
        <div class="info">
          <h3>📋 Test Results:</h3>
          <table>
            <thead>
              <tr>
                <th>Machine</th>
                <th>Finish Goods</th>
                <th>Production Plan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${results.map(result => `
                <tr>
                  <td>${result.name}</td>
                  <td>${result.finishGoods}</td>
                  <td>${result.productionPlan}</td>
                  <td>
                    ${result.error ? 
                      '<span style="color: red;">Error</span>' :
                      result.finishGoods !== 'ไม่มีข้อมูล' && result.productionPlan !== 'ไม่มีข้อมูล' ? 
                        '<span style="color: green;">✅ Both</span>' :
                        result.finishGoods !== 'ไม่มีข้อมูล' || result.productionPlan !== 'ไม่มีข้อมูล' ? 
                          '<span style="color: orange;">⚠️ Partial</span>' :
                          '<span style="color: red;">❌ None</span>'
                    }
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="info">
          <h3>🔍 Detailed Responses:</h3>
          ${results.map(result => `
            <div class="machine">
              <h4>${result.name}</h4>
              <p><strong>Finish Goods Response:</strong></p>
              <pre>${JSON.stringify(result.fgResponse, null, 2)}</pre>
              <p><strong>Production Plan Response:</strong></p>
              <pre>${JSON.stringify(result.ppResponse, null, 2)}</pre>
            </div>
          `).join('')}
        </div>
        
        <div class="info">
          <h3>📅 Last Updated:</h3>
          <p>${new Date().toLocaleString('th-TH')}</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// GET /api/test/instances-data - ทดสอบข้อมูลที่ส่งมาจาก /api/instances
router.get('/test/instances-data', async (req, res) => {
  console.log('🔍 === /api/test/instances-data ===');
  
  try {
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
    
    // สร้าง HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Instances Data Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          .info { background: #e3f2fd; color: #1565c0; padding: 15px; border-radius: 5px; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
          th { background: #f2f2f2; }
          .online { background: #e8f5e8; color: #2e7d32; }
          .offline { background: #ffebee; color: #c62828; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Instances Data Test</h1>
          
          <div class="info">
            <h3>📋 Instances from /api/instances:</h3>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Host</th>
                  <th>Database</th>
                  <th>M Field</th>
                  <th>Online</th>
                </tr>
              </thead>
              <tbody>
                ${results.map(instance => `
                  <tr class="${instance.online ? 'online' : 'offline'}">
                    <td>${instance.name}</td>
                    <td>${instance.host}</td>
                    <td>${instance.database}</td>
                    <td>${instance.m}</td>
                    <td>${instance.online ? '✅ Online' : '❌ Offline'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="info">
            <h3>📊 Summary:</h3>
            <p><strong>Total Instances:</strong> ${results.length}</p>
            <p><strong>Online Instances:</strong> ${results.filter(inst => inst.online).length}</p>
            <p><strong>Offline Instances:</strong> ${results.filter(inst => !inst.online).length}</p>
            <p><strong>Online Names:</strong> ${results.filter(inst => inst.online).map(inst => inst.name).join(', ')}</p>
          </div>
          
          <div class="info">
            <h3>📅 Last Updated:</h3>
            <p>${new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error in instances data test:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการทดสอบ', detail: err.message });
  }
});

// GET /api/test/c5-planning - ทดสอบเฉพาะ ตัวซี #5 planning
router.get('/test/c5-planning', async (req, res) => {
  console.log('🔍 === /api/test/c5-planning ===');
  
  try {
    // ใช้ CEO_REPORT database
    const ceoReportConfig = {
      user: "sa",
      password: "",
      server: "192.168.100.222",
      database: "ceo_report",
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000,
        requestTimeout: 10000
      },
      pool: { max: 1, min: 0, idleTimeoutMillis: 3000 }
    };
    
    const machineName = 'ตัวซี #5';
    const mappedStation = mapMachineToProductionPlan(machineName);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log('🔍 Machine name:', machineName);
    console.log('🔍 Mapped station:', mappedStation);
    console.log('🔍 Today:', today);
    
    const sqlQuery = `
      SELECT size 
      FROM [CEO_REPORT].[dbo].[production_plan]
      WHERE station = @station 
      AND postingdate = @today
    `;
    
    console.log('🔍 SQL Query:', sqlQuery);
    console.log('🔍 Parameters:', { station: mappedStation, today });
    
    console.log('🔍 Connecting to database...');
    const pool = await sql.connect(ceoReportConfig);
    console.log('✅ Connected successfully');
    
    console.log('🔍 Executing query...');
    const result = await pool.request()
      .input('station', sql.VarChar, mappedStation)
      .input('today', sql.VarChar, today)
      .query(sqlQuery);
    console.log('✅ Query executed successfully');
    
    await pool.close();
    console.log('✅ Connection closed');
    
    const maktx = result.recordset.length > 0 ? result.recordset[0].size : null;
    console.log('🔍 Query result:', result.recordset);
    console.log('🔍 Final maktx value:', maktx);
    
    // สร้าง HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>C5 Planning Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .info { background: #e3f2fd; color: #1565c0; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .success { background: #e8f5e8; color: #2e7d32; }
          .error { background: #ffebee; color: #c62828; }
          .warning { background: #fff3e0; color: #ef6c00; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
          th { background: #f2f2f2; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 C5 Planning Test</h1>
          
          <div class="info">
            <h3>📋 Test Parameters:</h3>
            <table>
              <tr><td><strong>Machine Name:</strong></td><td>${machineName}</td></tr>
              <tr><td><strong>Mapped Station:</strong></td><td>${mappedStation}</td></tr>
              <tr><td><strong>Today:</strong></td><td>${today}</td></tr>
            </table>
          </div>
          
          <div class="info">
            <h3>🔧 Database Config:</h3>
            <pre>${JSON.stringify(ceoReportConfig, null, 2)}</pre>
          </div>
          
          <div class="info">
            <h3>📝 SQL Query:</h3>
            <pre>${sqlQuery}</pre>
          </div>
          
          <div class="info">
            <h3>📊 Query Parameters:</h3>
            <pre>${JSON.stringify({ station: mappedStation, today }, null, 2)}</pre>
          </div>
          
          <div class="${maktx ? 'success' : 'warning'}">
            <h3>📈 Result:</h3>
            <p><strong>Maktx:</strong> ${maktx || 'ไม่มีข้อมูล'}</p>
            <p><strong>Records found:</strong> ${result.recordset.length}</p>
          </div>
          
          <div class="info">
            <h3>📋 Raw Query Result:</h3>
            <pre>${JSON.stringify(result.recordset, null, 2)}</pre>
          </div>
          
          <div class="info">
            <h3>🔗 Test Links:</h3>
            <p><a href="/api/test/card-endpoints" target="_blank">Card Endpoints Test</a></p>
            <p><a href="/api/test/machine-status" target="_blank">Machine Status Test</a></p>
            <p><a href="/api/test/instances-data" target="_blank">Instances Data Test</a></p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error in C5 planning test:', err.message);
    console.error('❌ Error details:', {
      code: err.code,
      state: err.state,
      serverName: err.serverName,
      lineNumber: err.lineNumber
    });
    
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>C5 Planning Test - Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 5px; margin: 10px 0; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ C5 Planning Test - Error</h1>
          
          <div class="error">
            <h3>🚨 Error Details:</h3>
            <p><strong>Message:</strong> ${err.message}</p>
            <p><strong>Code:</strong> ${err.code}</p>
            <p><strong>State:</strong> ${err.state}</p>
            <p><strong>Server:</strong> ${err.serverName}</p>
            <p><strong>Line:</strong> ${err.lineNumber}</p>
          </div>
          
          <div class="error">
            <h3>📋 Full Error:</h3>
            <pre>${JSON.stringify(err, null, 2)}</pre>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// GET /api/test/card-debug - ทดสอบ card endpoints พร้อม debug
router.get('/test/card-debug', async (req, res) => {
  console.log('🔍 === /api/test/card-debug ===');
  
  try {
    // ดึงข้อมูล instances
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
    
    // ทดสอบ card endpoints สำหรับเครื่องที่ online
    const onlineInstances = results.filter(inst => inst.online);
    console.log('🔍 Online instances:', onlineInstances.map(inst => inst.name));
    
    const cardResults = [];
    
    for (const instance of onlineInstances) {
      console.log(`🔍 Testing card endpoints for: ${instance.name}`);
      
      try {
        // ทดสอบ finish-goods API
        const finishGoodsResponse = await axios.get(`http://localhost:4000/api/instances/finish-goods?name=${encodeURIComponent(instance.name)}`);
        
        // ทดสอบ production-plan API
        const productionPlanResponse = await axios.get(`http://localhost:4000/api/instances/production-plan?name=${encodeURIComponent(instance.name)}`);
        
        cardResults.push({
          name: instance.name,
          finishGoods: finishGoodsResponse.data,
          productionPlan: productionPlanResponse.data,
          status: 'success'
        });
        
        console.log(`✅ ${instance.name}:`, {
          finishGoods: finishGoodsResponse.data,
          productionPlan: productionPlanResponse.data
        });
        
      } catch (error) {
        console.error(`❌ ${instance.name} error:`, error.message);
        cardResults.push({
          name: instance.name,
          error: error.message,
          status: 'error'
        });
      }
    }
    
    // สร้าง HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Card Debug Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          .info { background: #e3f2fd; color: #1565c0; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .success { background: #e8f5e8; color: #2e7d32; }
          .error { background: #ffebee; color: #c62828; }
          .warning { background: #fff3e0; color: #ef6c00; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
          th { background: #f2f2f2; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
          .card { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin: 10px 0; }
          .card.success { border-color: #4caf50; background: #f1f8e9; }
          .card.error { border-color: #f44336; background: #ffebee; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Card Debug Test</h1>
          
          <div class="info">
            <h3>📊 Summary:</h3>
            <p><strong>Total Instances:</strong> ${results.length}</p>
            <p><strong>Online Instances:</strong> ${onlineInstances.length}</p>
            <p><strong>Online Names:</strong> ${onlineInstances.map(inst => inst.name).join(', ')}</p>
          </div>
          
          <div class="info">
            <h3>📋 Card Endpoints Test Results:</h3>
            ${cardResults.map(result => `
              <div class="card ${result.status}">
                <h4>${result.name}</h4>
                ${result.status === 'success' ? `
                  <p><strong>Finish Goods:</strong> ${JSON.stringify(result.finishGoods)}</p>
                  <p><strong>Production Plan:</strong> ${JSON.stringify(result.productionPlan)}</p>
                ` : `
                  <p><strong>Error:</strong> ${result.error}</p>
                `}
              </div>
            `).join('')}
          </div>
          
          <div class="info">
            <h3>🔗 Test Links:</h3>
            <p><a href="/api/test/card-endpoints" target="_blank">Card Endpoints Test</a></p>
            <p><a href="/api/test/machine-status" target="_blank">Machine Status Test</a></p>
            <p><a href="/api/test/instances-data" target="_blank">Instances Data Test</a></p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error in card debug test:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการทดสอบ', detail: err.message });
  }
});

// GET /api/test/frontend-simulation - ทดสอบการเรียก API แบบ frontend
router.get('/test/frontend-simulation', async (req, res) => {
  console.log('🔍 === /api/test/frontend-simulation ===');
  
  try {
    // ดึงข้อมูล instances แบบ frontend
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
    
    // กรองเฉพาะเครื่องที่ online
    const onlineInstances = results.filter(inst => inst.online);
    console.log('🔍 Online instances:', onlineInstances.map(inst => inst.name));
    
    const simulationResults = [];
    
    for (const instance of onlineInstances) {
      console.log(`🔍 Simulating frontend calls for: ${instance.name}`);
      
      try {
        // จำลองการเรียก API แบบ frontend
        const machineParam = instance.name;
        
        // จำลอง finish-goods API call
        const finishGoodsResponse = await axios.get(`http://localhost:4000/api/instances/finish-goods`, {
          params: { name: machineParam }
        });
        
        // จำลอง production-plan API call
        const productionPlanResponse = await axios.get(`http://localhost:4000/api/instances/production-plan`, {
          params: { name: machineParam }
        });
        
        // จำลองการ set state แบบ frontend
        const cardData = {
          finishGoods: finishGoodsResponse.data?.size || 'ไม่มีข้อมูล',
          productionPlan: productionPlanResponse.data?.maktx || 'ไม่มีข้อมูล'
        };
        
        simulationResults.push({
          name: instance.name,
          machineParam,
          finishGoodsResponse: finishGoodsResponse.data,
          productionPlanResponse: productionPlanResponse.data,
          cardData,
          status: 'success'
        });
        
        console.log(`✅ ${instance.name} simulation:`, {
          machineParam,
          finishGoodsResponse: finishGoodsResponse.data,
          productionPlanResponse: productionPlanResponse.data,
          cardData
        });
        
      } catch (error) {
        console.error(`❌ ${instance.name} simulation error:`, error.message);
        simulationResults.push({
          name: instance.name,
          error: error.message,
          status: 'error'
        });
      }
    }
    
    // สร้าง HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Frontend Simulation Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          .info { background: #e3f2fd; color: #1565c0; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .success { background: #e8f5e8; color: #2e7d32; }
          .error { background: #ffebee; color: #c62828; }
          .warning { background: #fff3e0; color: #ef6c00; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
          th { background: #f2f2f2; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
          .card { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin: 10px 0; }
          .card.success { border-color: #4caf50; background: #f1f8e9; }
          .card.error { border-color: #f44336; background: #ffebee; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Frontend Simulation Test</h1>
          
          <div class="info">
            <h3>📊 Summary:</h3>
            <p><strong>Total Instances:</strong> ${results.length}</p>
            <p><strong>Online Instances:</strong> ${onlineInstances.length}</p>
            <p><strong>Online Names:</strong> ${onlineInstances.map(inst => inst.name).join(', ')}</p>
          </div>
          
          <div class="info">
            <h3>📋 Frontend Simulation Results:</h3>
            ${simulationResults.map(result => `
              <div class="card ${result.status}">
                <h4>${result.name}</h4>
                ${result.status === 'success' ? `
                  <p><strong>Machine Param:</strong> ${result.machineParam}</p>
                  <p><strong>Finish Goods Response:</strong> ${JSON.stringify(result.finishGoodsResponse)}</p>
                  <p><strong>Production Plan Response:</strong> ${JSON.stringify(result.productionPlanResponse)}</p>
                  <p><strong>Card Data (Frontend State):</strong></p>
                  <pre>${JSON.stringify(result.cardData, null, 2)}</pre>
                ` : `
                  <p><strong>Error:</strong> ${result.error}</p>
                `}
              </div>
            `).join('')}
          </div>
          
          <div class="info">
            <h3>🔗 Test Links:</h3>
            <p><a href="/api/test/card-debug" target="_blank">Card Debug Test</a></p>
            <p><a href="/api/test/card-endpoints" target="_blank">Card Endpoints Test</a></p>
            <p><a href="/api/test/machine-status" target="_blank">Machine Status Test</a></p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error in frontend simulation test:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการทดสอบ', detail: err.message });
  }
});

// GET /api/instances/card-data - ส่งข้อมูล card แบบ JSON สำหรับ frontend
router.get('/instances/card-data', async (req, res) => {
  console.log('🔍 === /api/instances/card-data ===');
  
  try {
    // ดึงข้อมูล instances
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
    
    // ใช้ข้อมูลทุกเครื่อง (online และ offline)
    console.log('🔍 All instances:', results.map(inst => `${inst.name} (${inst.online ? 'online' : 'offline'})`));
    
    const cardData = {};
    
    for (const instance of results) {
      console.log(`🔍 Getting card data for: ${instance.name}`);
      
      try {
        const machineParam = instance.name;
        
        // ดึงข้อมูล finish goods โดยตรง
        const mappedStation = mapMachineToStation(machineParam);
        const ppConfig = {
          user: "sa",
          password: "",
          server: "192.168.100.222",
          database: "PP",
          port: 1433,
          options: {
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: 5000,
            requestTimeout: 10000
          },
          pool: { max: 1, min: 0, idleTimeoutMillis: 3000 }
        };
        
        // ดึงข้อมูล finish goods พร้อมวันที่ผลิตล่าสุด (เฉพาะ A1, A2)
        const finishGoodsQuery = `
          SELECT TOP 1 [rmd_size], [rmd_date]
          FROM tbl_production_scale
          WHERE rmd_plant = 'OCP' 
          AND [rmd_station] = @station
          AND [rmd_qa_grade] IN ('A1', 'A2')
          ORDER BY rmd_Date DESC, rmd_qty2 DESC
        `;
        
        const finishGoodsPool = await sql.connect(ppConfig);
        const finishGoodsResult = await finishGoodsPool.request()
          .input('station', sql.VarChar, mappedStation)
          .query(finishGoodsQuery);
        await finishGoodsPool.close();
        
        const finishGoods = finishGoodsResult.recordset.length > 0 ? finishGoodsResult.recordset[0].rmd_size : null;
        const lastProductionDate = finishGoodsResult.recordset.length > 0 ? finishGoodsResult.recordset[0].rmd_date : null;
        
        // ดึงข้อมูล production plan
        const mappedOCP = mapMachineToProductionPlan(machineParam);
        const ceoReportConfig = {
          user: "sa",
          password: "",
          server: "192.168.100.222",
          database: "ceo_report",
          port: 1433,
          options: {
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: 5000,
            requestTimeout: 10000
          },
          pool: { max: 1, min: 0, idleTimeoutMillis: 3000 }
        };
        
        const today = new Date().toISOString().split('T')[0];
        const productionPlanQuery = `
          SELECT size 
          FROM [CEO_REPORT].[dbo].[production_plan] 
          WHERE station = @station 
          AND postingdate = @today
        `;
        
        const productionPlanPool = await sql.connect(ceoReportConfig);
        const productionPlanResult = await productionPlanPool.request()
          .input('station', sql.VarChar, mappedOCP)
          .input('today', sql.VarChar, today)
          .query(productionPlanQuery);
        await productionPlanPool.close();
        
        const productionPlan = productionPlanResult.recordset.length > 0 ? productionPlanResult.recordset[0].size : null;
        
        cardData[instance.name] = {
          finishGoods: finishGoods || 'ไม่มีข้อมูล',
          lastProductionDate: lastProductionDate ? new Date(lastProductionDate).toLocaleDateString('th-TH') : 'ไม่มีข้อมูล',
          productionPlan: productionPlan || 'ไม่มีข้อมูล'
        };
        
        console.log(`✅ ${instance.name} card data:`, cardData[instance.name]);
        
      } catch (error) {
        console.error(`❌ ${instance.name} error:`, error.message);
        cardData[instance.name] = {
          finishGoods: 'ไม่สามารถดึงข้อมูลได้',
          productionPlan: 'ไม่สามารถดึงข้อมูลได้'
        };
      }
    }
    
    res.json({
      success: true,
      data: cardData,
      summary: {
        totalInstances: results.length,
        onlineInstances: results.filter(inst => inst.online).length,
        offlineInstances: results.filter(inst => !inst.online).length,
        onlineNames: results.filter(inst => inst.online).map(inst => inst.name),
        offlineNames: results.filter(inst => !inst.online).map(inst => inst.name)
      }
    });
    
  } catch (err) {
    console.error('❌ Error in card data API:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล card', 
      detail: err.message 
    });
  }
});

// GET /api/instances/card-data/:name - ดึงข้อมูล card เฉพาะเครื่องที่ระบุ
router.get('/instances/card-data/:name', async (req, res) => {
  const { name } = req.params;
  console.log(`🔍 === /api/instances/card-data/${name} ===`);
  
  try {
    console.log(`🔍 Getting card data for specific machine: ${name}`);
    
    const machineParam = name;
    
    // ดึงข้อมูล finish goods โดยตรง
    const mappedStation = mapMachineToStation(machineParam);
    const ppConfig = {
      user: "sa",
      password: "",
      server: "192.168.100.222",
      database: "PP",
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 15000
      },
      pool: { 
        max: 5, 
        min: 0, 
        idleTimeoutMillis: 5000,
        acquireTimeoutMillis: 10000,
        createTimeoutMillis: 10000,
        destroyTimeoutMillis: 5000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      }
    };
    
    // ดึงข้อมูล finish goods พร้อมวันที่ผลิตล่าสุด (เฉพาะ A1, A2)
    const finishGoodsQuery = `
      SELECT TOP 1 [rmd_size], [rmd_date]
      FROM tbl_production_scale
      WHERE rmd_plant = 'OCP' 
      AND [rmd_station] = @station
      AND [rmd_qa_grade] IN ('A1', 'A2')
      ORDER BY rmd_Date DESC, rmd_qty2 DESC
    `;
    
    let finishGoodsPool = null;
    try {
      finishGoodsPool = await sql.connect(ppConfig);
      const finishGoodsResult = await finishGoodsPool.request()
        .input('station', sql.VarChar, mappedStation)
        .query(finishGoodsQuery);
      
      const finishGoods = finishGoodsResult.recordset.length > 0 ? finishGoodsResult.recordset[0].rmd_size : null;
      const lastProductionDate = finishGoodsResult.recordset.length > 0 ? finishGoodsResult.recordset[0].rmd_date : null;
      
      // ดึงข้อมูล production plan
      const mappedOCP = mapMachineToProductionPlan(machineParam);
      const ceoReportConfig = {
        user: "sa",
        password: "",
        server: "192.168.100.222",
        database: "ceo_report",
        port: 1433,
        options: {
          encrypt: false,
          trustServerCertificate: true,
          connectTimeout: 10000,
          requestTimeout: 15000
        },
        pool: { 
          max: 5, 
          min: 0, 
          idleTimeoutMillis: 5000,
          acquireTimeoutMillis: 10000,
          createTimeoutMillis: 10000,
          destroyTimeoutMillis: 5000,
          reapIntervalMillis: 1000,
          createRetryIntervalMillis: 200
        }
      };
      
      const today = new Date().toISOString().split('T')[0];
      const productionPlanQuery = `
        SELECT size 
        FROM [CEO_REPORT].[dbo].[production_plan]
        WHERE station = @station 
        AND postingdate = @today
      `;
      
      let productionPlanPool = null;
      try {
        productionPlanPool = await sql.connect(ceoReportConfig);
        const productionPlanResult = await productionPlanPool.request()
          .input('station', sql.VarChar, mappedOCP)
          .input('today', sql.VarChar, today)
          .query(productionPlanQuery);
        
        const productionPlan = productionPlanResult.recordset.length > 0 ? productionPlanResult.recordset[0].size : null;
        
        const cardData = {
          finishGoods: finishGoods || 'ไม่มีข้อมูล',
          lastProductionDate: lastProductionDate ? new Date(lastProductionDate).toLocaleDateString('th-TH') : 'ไม่มีข้อมูล',
          productionPlan: productionPlan || 'ไม่มีข้อมูล'
        };
        
        console.log(`✅ ${name} card data:`, cardData);
        
        res.json({
          success: true,
          data: cardData
        });
        
      } catch (planError) {
        console.error(`❌ Error fetching production plan for ${name}:`, planError.message);
        const cardData = {
          finishGoods: finishGoods || 'ไม่มีข้อมูล',
          lastProductionDate: lastProductionDate ? new Date(lastProductionDate).toLocaleDateString('th-TH') : 'ไม่มีข้อมูล',
          productionPlan: 'ไม่สามารถดึงข้อมูลได้'
        };
        
        res.json({
          success: true,
          data: cardData
        });
      } finally {
        if (productionPlanPool) {
          try {
            await productionPlanPool.close();
          } catch (closeError) {
            console.error(`❌ Error closing production plan pool for ${name}:`, closeError.message);
          }
        }
      }
      
    } catch (goodsError) {
      console.error(`❌ Error fetching finish goods for ${name}:`, goodsError.message);
      const cardData = {
        finishGoods: 'ไม่สามารถดึงข้อมูลได้',
        lastProductionDate: 'ไม่สามารถดึงข้อมูลได้',
        productionPlan: 'ไม่สามารถดึงข้อมูลได้'
      };
      
      res.json({
        success: true,
        data: cardData
      });
    } finally {
      if (finishGoodsPool) {
        try {
          await finishGoodsPool.close();
        } catch (closeError) {
          console.error(`❌ Error closing finish goods pool for ${name}:`, closeError.message);
        }
      }
    }
    
  } catch (err) {
    console.error(`❌ Error in card data API for ${name}:`, err.message);
    res.status(500).json({ 
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล card', 
      detail: err.message 
    });
  }
});

export default router; 