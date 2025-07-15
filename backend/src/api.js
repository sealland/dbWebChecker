import express from 'express';
import { getAllDbConfigs, getDbConfigByName, checkDbOnline, queryA2Rpt } from './dbUtil.js';
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

export default router; 