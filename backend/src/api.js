import express from 'express';
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

// GET /api/compare/station?name=...&fromDate=...&toDate=... - ดึงข้อมูลจาก Station
router.get('/compare/station', async (req, res) => {
  const { name, fromDate, toDate } = req.query;
  if (!name || !fromDate || !toDate) {
    return res.status(400).json({ error: 'ต้องระบุ name, fromDate, toDate' });
  }
  const dbConfig = getDbConfigByName(name);
  if (!dbConfig) {
    return res.status(404).json({ error: 'ไม่พบเครื่องที่ระบุ' });
  }
  try {
    const data = await queryStationData(dbConfig, fromDate, toDate);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Station', detail: err.message });
  }
});

// GET /api/compare/planning?name=...&station=...&fromDate=...&toDate=... - ดึงข้อมูลจาก Planning
router.get('/compare/planning', async (req, res) => {
  const { name, station, fromDate, toDate } = req.query;
  if (!name || !station || !fromDate || !toDate) {
    return res.status(400).json({ error: 'ต้องระบุ name, station, fromDate, toDate' });
  }
  const dbConfig = getDbConfigByName(name);
  if (!dbConfig) {
    return res.status(404).json({ error: 'ไม่พบเครื่องที่ระบุ' });
  }
  try {
    const data = await queryPlanningData(dbConfig, station, fromDate, toDate);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Planning', detail: err.message });
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
  const { name, station, fromDate, toDate } = req.query;
  if (!name || !station || !fromDate || !toDate) {
    return res.status(400).json({ error: 'ต้องระบุ name, station, fromDate, toDate' });
  }
  const dbConfig = getDbConfigByName(name);
  if (!dbConfig) {
    return res.status(404).json({ error: 'ไม่พบเครื่องที่ระบุ' });
  }
  try {
    const [stationData, planningData] = await Promise.all([
      queryStationData(dbConfig, fromDate, toDate),
      queryPlanningData(dbConfig, station, fromDate, toDate)
    ]);
    res.json({ 
      station: { data: stationData },
      planning: { data: planningData }
    });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลเปรียบเทียบ', detail: err.message });
  }
});

export default router; 