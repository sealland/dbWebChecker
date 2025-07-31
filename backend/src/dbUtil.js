import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';



const configPath = path.join(process.cwd(), '..', 'db_instances.config.json');
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
export function mapMachineToStation(machineName) {
  console.log('🔄 Mapping machine name:', machineName);
  
  // ดึงข้อมูลจาก config file
  const configPath = path.join(process.cwd(), '..', 'db_instances.config.json');
  const dbInstances = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  // หาเครื่องที่ตรงกับชื่อ
  const machineConfig = dbInstances.find(instance => instance.name === machineName);
  
  if (machineConfig && machineConfig.m) {
    // แปลง mapping สำหรับเครื่องตัดแผ่น
    let mappedStation = machineConfig.m;
    
    // แปลง plates1, plates2, plates4 เป็น P1, P2, P4 สำหรับ production_scale
    if (machineConfig.m === 'plates1') {
      mappedStation = 'P1';
      console.log(`  → Converting ${machineConfig.m} → ${mappedStation} for production_scale`);
    } else if (machineConfig.m === 'plates2') {
      mappedStation = 'P2';
      console.log(`  → Converting ${machineConfig.m} → ${mappedStation} for production_scale`);
    } else if (machineConfig.m === 'plates4') {
      mappedStation = 'P4';
      console.log(`  → Converting ${machineConfig.m} → ${mappedStation} for production_scale`);
    }
    
    console.log('  → Found in config, using m field:', machineConfig.m);
    console.log('  → Final mapped station:', mappedStation);
    return mappedStation;
  }
  
  // Fallback mapping สำหรับเครื่องที่ไม่มีใน config
  const mapping = {
    // ท่อดำ - ใช้ I1-I8 (ตรงกับ production_scale)
    'ท่อดำ #1': 'I1',
    'ท่อดำ #2': 'I2', 
    'ท่อดำ #3': 'I3',
    'ท่อดำ #4': 'I4',
    'ท่อดำ #5': 'I5',
    'ท่อดำ #6': 'I6',
    'ท่อดำ #7': 'I7',
    'ท่อดำ #8': 'I8',
    
    // ตัวซี - ใช้ c1-c6 (ตัวพิมพ์เล็ก ตรงกับ production_scale)
    'ตัวซี #1': 'c1',
    'ตัวซี #2': 'c2',
    'ตัวซี #3': 'C3',
    'ตัวซี #4': 'C4',
    'ตัวซี #5': 'c5',
    'ตัวซี #6': 'C6',
    
    // ตัดแผ่น - ใช้ P1, P2, P4 สำหรับ production_scale
    'ตัดแผ่น 1': 'P1',
    'ตัดแผ่น 2': 'P2',
    'ตัดแผ่น 4': 'P4',
    
    // สลิท
    'สลิท#1': 'S1',
    'สลิท#2': 'S2',
    'สลิท#3': 'S3',
    
    // OPS
    'OPS 3': 'ops3',
    'OPS 4': 'ops4',
    
    // SPS
    'SPS 2(CH6)': 'sps2ch6',
    'SPS 2(CH4)': 'sps2ch4'
  };
  
  const mappedStation = mapping[machineName] || machineName;
  console.log('  → Mapped to:', mappedStation);
  
  return mappedStation;
}

// เพิ่มฟังก์ชันใหม่สำหรับแปลงชื่อเครื่องเป็น Production Plan format
export function mapMachineToProductionPlan(machineName) {
  console.log('🔄 Mapping machine to Production Plan format:', machineName);
  
  // ดึงข้อมูลจาก config file
  const configPath = path.join(process.cwd(), '..', 'db_instances.config.json');
  const dbInstances = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  // หาเครื่องที่ตรงกับชื่อ
  const machineConfig = dbInstances.find(instance => instance.name === machineName);
  
  if (machineConfig && machineConfig.m) {
    // แปลง C1-C6 เป็น H1-H6 สำหรับ production_plan
    let mappedCode = machineConfig.m;
    if (machineConfig.m.startsWith('C') && machineConfig.m.length === 2) {
      const number = machineConfig.m.substring(1);
      mappedCode = `H${number}`;
      console.log(`  → Converting ${machineConfig.m} → ${mappedCode}`);
    }
    
    const ocpFormat = `OCP ${mappedCode}`;
    console.log('  → Found in config, Production Plan format:', ocpFormat);
    return ocpFormat;
  }
  
  // Fallback mapping สำหรับเครื่องที่ไม่มีใน config
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
    'ตัดแผ่น 1': 'OCP plates1',
    'ตัดแผ่น 2': 'OCP plates2',
    'ตัดแผ่น 4': 'OCP plates4',
    
    // สลิท
    'สลิท#1': 'OCP S1',
    'สลิท#2': 'OCP S2',
    'สลิท#3': 'OCP S3',
    
    // OPS
    'OPS 3': 'OPS 3',
    'OPS 4': 'OPS 4',
    
    // SPS
    'SPS 2(CH6)': 'SPS 2(CH6)',
    'SPS 2(CH4)': 'SPS 2(CH4)'
  };
  
  const mappedStation = mapping[machineName] || machineName;
  console.log('  → Mapped to Production Plan format:', mappedStation);
  
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
      connectTimeout: 5000 // เพิ่ม timeout เป็น 5 วินาที
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
  console.log('🚨🚨🚨 DEBUG: queryPlanningData called with station:', station);
  console.log('🚨🚨🚨 DEBUG: This is the NEW version of queryPlanningData');
  
  // ใช้ CEO_REPORT database สำหรับ production_plan
  const ceoReportConfig = {
    user: "sa",
    password: "",
    server: "192.168.100.222",
    database: "ceo_report",
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 30000,        // เพิ่มเป็น 30 วินาที
      requestTimeout: 30000,        // เพิ่มเป็น 30 วินาที
      cancelTimeout: 5000,
      packetSize: 4096,
      useUTC: true,
      isolationLevel: sql.ISOLATION_LEVEL.READ_COMMITTED
    },
    pool: { 
      max: 10,                     // เพิ่มจาก 5 เป็น 10
      min: 0, 
      idleTimeoutMillis: 30000,    // เพิ่มเป็น 30 วินาที
      acquireTimeoutMillis: 30000, // เพิ่มเป็น 30 วินาที
      createTimeoutMillis: 30000,  // เพิ่มเป็น 30 วินาที
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false
    }
  };
  
  // แก้ไข: ใช้ mapMachineToProductionPlan แทน mapMachineToStation
  const mappedStation = mapMachineToProductionPlan(station);
  console.log('🔍 Mapping station for Production Plan:', station, '→', mappedStation);
  
  const sqlQuery = `
    SELECT postingdate, material_code, size
    FROM production_plan
    WHERE postingdate BETWEEN @fromDate AND @toDate
    AND station = @station
  `;
  
  console.log('🔍 DEBUG: SQL Query:', sqlQuery);
  console.log('🔍 DEBUG: Parameters:', { fromDate, toDate, station: mappedStation });
  
  let pool;
  try {
    // สร้าง connection pool ใหม่
    pool = new sql.ConnectionPool(ceoReportConfig);
    
    // รอให้ pool พร้อมใช้งาน
    await pool.connect();
    console.log('🔍 DEBUG: Connection pool connected successfully');
    
    const result = await pool.request()
      .input('fromDate', sql.VarChar, fromDate)
      .input('toDate', sql.VarChar, toDate)
      .input('station', sql.VarChar, mappedStation)
      .query(sqlQuery);
    
    console.log('🔍 DEBUG: Query result count:', result.recordset.length);
    return result.recordset;
  } catch (err) {
    console.error('❌ DEBUG: Query error:', err.message);
    console.error('❌ DEBUG: Error details:', {
      code: err.code,
      state: err.state,
      serverName: err.serverName,
      lineNumber: err.lineNumber,
      class: err.class,
      number: err.number
    });
    throw err;
  } finally {
    if (pool) {
      try {
        await pool.close();
        console.log('🔍 DEBUG: Connection pool closed successfully');
      } catch (closeErr) {
        console.error('❌ DEBUG: Error closing pool:', closeErr.message);
      }
    }
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