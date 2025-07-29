import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';



const configPath = 'D:\\httpdoc\\wh\\dbWebChecker\\db_instances.config.json';
const dbInstances = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export function getDbConfigByName(name) {
  return dbInstances.find(db => db.name === name);
}

export function getAllDbConfigs() {
  return dbInstances;
}

// เพิ่มฟังก์ชัน pingHost (Windows)
function pingHost(host) {
  return new Promise((resolve) => {
    exec(`ping -n 1 -w 1000 ${host}`, (error, stdout) => {
      if (error) return resolve(false);
      if (stdout.includes('TTL=')) return resolve(true);
      return resolve(false);
    });
  });
}

// เพิ่มฟังก์ชันนี้หลัง import statements
function mapMachineToStation(machineName) {
  console.log('🔄 Mapping machine name:', machineName);
  
  const mapping = {
    // ท่อดำ
    'ท่อดำ #1': 'OCP I1',
    'ท่อดำ #2': 'OCP I2', 
    'ท่อดำ #3': 'OCP I3',
    'ท่อดำ #4': 'OCP I4',
    'ท่อดำ #5': 'OCP I5',
    'ท่อดำ #6': 'OCP I6',
    'ท่อดำ #7': 'OCP I7',
    'ท่อดำ #8': 'OCP I8',
    
    // ตัวซี
    'ตัวซี #1': 'OCP H1',
    'ตัวซี #2': 'OCP H2',
    'ตัวซี #3': 'OCP H3',
    'ตัวซี #4': 'OCP H4',
    'ตัวซี #5': 'OCP H5',
    'ตัวซี #6': 'OCP H6',
    
    // ตัดแผ่น
    'ตัดแผ่น 1': 'OCP PL1',
    'ตัดแผ่น 2': 'OCP PL2',
    'ตัดแผ่น 4': 'OCP PL4',
    
    // สลิท
    'สลิท#1': 'OCP SL1',
    'สลิท#2': 'OCP SL2',
    'สลิท#3': 'OCP SL3',
    
    // OPS
    'OPS 3': 'OPS3',
    'OPS 4': 'OPS4',
    
    // SPS
    'SPS 2(CH6)': 'SPS2CH6',
    'SPS 2(CH4)': 'SPS2CH4'
  };
  const mappedStation = mapping[machineName] || machineName;
  console.log('  → Mapped to:', mappedStation);
  
  return mappedStation;
}

export async function checkDbOnline(dbConfig) {
  // ping host ก่อน
  const isPing = await pingHost(dbConfig.host);
  if (!isPing) {
    console.error(`Ping failed: ${dbConfig.host}`);
    return false;
  }
  const config = {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.host,
    database: dbConfig.database,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 2000 // เพิ่ม timeout
    },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 }
  };
  let pool;
  try {
    console.log('Checking DB:', dbConfig.name, dbConfig.host);
    pool = await new sql.ConnectionPool(config).connect();
    await pool.close();
    return true;
  } catch (err) {
    console.error(`DB ${dbConfig.name} (${dbConfig.host}) offline:`, err.message);
    if (pool) await pool.close().catch(() => {});
    return false;
  }
}

export async function queryA2Rpt(dbConfig, year, month, page = 1, pageSize = 20) {
  const config = {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.host,
    database: dbConfig.database,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 }
  };
  const offset = (page - 1) * pageSize;
  const ref = `${year}-${month.toString().padStart(2, '0')}`;
  const sqlQuery = `
    SELECT * FROM (
      SELECT 
        [rmd_date],
        hn,
        rmd_qty2,
        [rmd_size],
        [rmd_length],
        rmd_qty3,
        [rmd_qa_grade],
        [rmd_weight],
        [rmd_remark],
        ROW_NUMBER() OVER (ORDER BY [rmd_date] DESC) as rn
      FROM [dbo].[vw_a2_rpt]
      WHERE FORMAT([rmd_date], 'yyyy-MM') = @ref
    ) t
    WHERE rn BETWEEN @start AND @end
  `;
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('ref', sql.VarChar, ref)
      .input('start', sql.Int, offset + 1)
      .input('end', sql.Int, offset + pageSize)
      .query(sqlQuery);
    await pool.close();
    return result.recordset;
  } catch (err) {
    throw err;
  }
}

export async function queryA2RptSummary(dbConfig, year, month) {
  const config = {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.host,
    database: dbConfig.database,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 }
  };
  const ref = `${year}-${month.toString().padStart(2, '0')}`;
  const sqlQuery = `
    SELECT 
      [rmd_size], 
      [rmd_qa_grade], 
      [rmd_remark], 
      SUM([rmd_qty3]) as sumqty3, 
      SUM([rmd_weight]) as sweight
    FROM [dbo].[vw_a2_rpt]
    WHERE FORMAT([rmd_date], 'yyyy-MM') = @ref
    GROUP BY [rmd_size], [rmd_qa_grade], [rmd_remark]
    ORDER BY [rmd_size], [rmd_qa_grade], [rmd_remark]
  `;
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('ref', sql.VarChar, ref)
      .query(sqlQuery);
    await pool.close();
    return result.recordset;
  } catch (err) {
    throw err;
  }
} 

export async function queryA2RptSum(dbConfig, year, month) {
  const config = {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.host,
    database: dbConfig.database,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 }
  };
  const ref = `${year}-${month.toString().padStart(2, '0')}`;
  const sqlQuery = `
    SELECT SUM([rmd_qty3]) as sQty3, SUM([rmd_weight]) as sweight
    FROM [dbo].[vw_a2_rpt]
    WHERE FORMAT([rmd_date], 'yyyy-MM') = @ref
  `;
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('ref', sql.VarChar, ref)
      .query(sqlQuery);
    await pool.close();
    return result.recordset[0];
  } catch (err) {
    throw err;
  }
}

export async function queryA2RptSummarySizeSum(dbConfig, year, month) {
  const config = {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.host,
    database: dbConfig.database,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 }
  };
  const ref = `${year}-${month.toString().padStart(2, '0')}`;
  const sqlQuery = `
    SELECT [rmd_size], SUM([rmd_qty3]) as sQty3, SUM([rmd_weight]) as sweight
    FROM [dbo].[vw_a2_rpt]
    WHERE FORMAT([rmd_date], 'yyyy-MM') = @ref
    GROUP BY [rmd_size]
    ORDER BY [rmd_size]
  `;
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('ref', sql.VarChar, ref)
      .query(sqlQuery);
    await pool.close();
    return result.recordset;
  } catch (err) {
    throw err;
  }
} 

// ฟังก์ชันดึงข้อมูลจาก Station (GET_CD3DATA)
export async function queryStationData(dbConfig, fromDate, toDate) {
  const config = {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.host,
    database: dbConfig.database,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 }
  };
  
  const sqlQuery = `
    SELECT doc_date, material, rmd_size, CHARINDEX('1', [material]) AS [chk-a]
    FROM GET_CD3DATA 
    WHERE doc_date BETWEEN @fromDate AND @toDate
    GROUP BY doc_date, material, rmd_size
    HAVING CHARINDEX('1', [material]) = 4
  `;
  
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('fromDate', sql.VarChar, fromDate)
      .input('toDate', sql.VarChar, toDate)
      .query(sqlQuery);
    await pool.close();
    return result.recordset;
  } catch (err) {
    throw err;
  }
}

export async function queryPlanningData(dbConfig, station, fromDate, toDate) {
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
  
  const sqlQuery = `
    SELECT postingdate, material_code, size
    FROM production_plan
    WHERE postingdate BETWEEN @fromDate AND @toDate
  `;
  
  try {
    const pool = await sql.connect(ceoReportConfig);
    const result = await pool.request()
      .input('fromDate', sql.VarChar, fromDate)
      .input('toDate', sql.VarChar, toDate)
      .query(sqlQuery);
    
    await pool.close();
    return result.recordset;
  } catch (err) {
    throw err;
  }
}
// ฟังก์ชันอัพเดตข้อมูล Production Plan
export async function updateProductionPlan(dbConfig, station, fromDate, toDate, shift = "Z", user = "system") {
  // ใช้ CEO_REPORT database สำหรับ production_plan
  const mappedStation = mapMachineToStation(station);
  
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
  
  try {
    const pool = await sql.connect(ceoReportConfig);
    
    // Step 1: อัพเดตสถานะเป็น 'รอตรวจสอบ'
    const updateQuery = `
      UPDATE production_plan 
      SET status = 'รอตรวจสอบ', shift = @shift 
      WHERE station = @station 
      AND postingdate BETWEEN @fromDate AND @toDate
    `;
    
    await pool.request()
      .input('shift', sql.VarChar, shift)
      .input('station', sql.VarChar, station)
      .input('fromDate', sql.VarChar, fromDate)
      .input('toDate', sql.VarChar, toDate)
      .query(updateQuery);
    
    // Step 2: เพิ่มข้อมูลใหม่จาก GET_CD3DATA
    // ต้องเชื่อมต่อฐานข้อมูลต้นฉบับเพื่อดึงข้อมูลจาก GET_CD3DATA
    const sourceConfig = {
      user: dbConfig.user,
      password: dbConfig.password,
      server: dbConfig.host,
      database: dbConfig.database,
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true
      },
      pool: { max: 2, min: 0, idleTimeoutMillis: 5000 }
    };
    
    const sourcePool = await sql.connect(sourceConfig);
    
    const insertQuery = `
      INSERT INTO production_plan 
      ([machine],[station],[material_code],[postingdate],[size],[ton],[change],[username],[shift],[Status],[complete])
      SELECT 
        machine,
        @station,
        material,
        doc_date,
        rmd_size,
        SUM(rmd_weight)/1000,
        @changeTime,
        @user,
        rmd_period,
        'ผลิตแน่',
        -1
      FROM GET_CD3DATA 
      WHERE doc_date BETWEEN @fromDate AND @toDate
      AND rmd_size IS NOT NULL 
      AND rmd_qa_grade = 'A1' 
      AND rmd_weight > 0 
      GROUP BY machine, doc_date, rmd_size, material, rmd_period
    `;
    
    await sourcePool.request()
      .input('station', sql.VarChar, station)
      .input('changeTime', sql.DateTime, new Date())
      .input('user', sql.VarChar, user)
      .input('fromDate', sql.VarChar, fromDate)
      .input('toDate', sql.VarChar, toDate)
      .query(insertQuery);
    
    await sourcePool.close();
    await pool.close();
    return { success: true, message: 'อัพเดตข้อมูลสำเร็จ' };
  } catch (err) {
    throw err;
  }
} 