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

// Helper function สำหรับการเชื่อมต่อ CEO_REPORT database
async function getCEOReportConnection() {
  console.log('🔍 DEBUG: Creating CEO_REPORT connection...');
  const ceoReportConfig = {
    user: "sa",
    password: "",
    server: "192.168.100.222",
    database: "CEO_REPORT",
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 30000,
      requestTimeout: 30000,
      cancelTimeout: 5000,
      packetSize: 4096,
      useUTC: true,
      isolationLevel: sql.ISOLATION_LEVEL.READ_COMMITTED
    },
    pool: { 
      max: 10,
      min: 0, 
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false
    }
  };
  
  console.log('🔍 DEBUG: CEO_REPORT config:', {
    server: ceoReportConfig.server,
    database: ceoReportConfig.database,
    user: ceoReportConfig.user,
    connectTimeout: ceoReportConfig.options.connectTimeout,
    requestTimeout: ceoReportConfig.options.requestTimeout
  });
  
  try {
    // ใช้ sql.connect() แทน new sql.ConnectionPool()
    const pool = await sql.connect(ceoReportConfig);
    console.log('✅ DEBUG: CEO_REPORT connection successful');
    
    // ตรวจสอบว่าเชื่อมต่อถูก server และ database หรือไม่
    const serverCheck = await pool.request().query('SELECT @@SERVERNAME as server_name, DB_NAME() as database_name');
    console.log('🔍 DEBUG: Actually connected to:', serverCheck.recordset[0]);
    
    // ยอมรับ server name ใดก็ได้ แต่ database ต้องเป็น CEO_REPORT
    if (serverCheck.recordset[0].database_name !== 'CEO_REPORT') {
      await pool.close();
      throw new Error(`เชื่อมต่อผิด database: ${serverCheck.recordset[0].database_name} (ควรเป็น CEO_REPORT)`);
    }
    
    console.log('✅ DEBUG: Connected to correct database:', serverCheck.recordset[0].database_name);
    return pool;
  } catch (err) {
    console.error('❌ DEBUG: CEO_REPORT connection failed:', err.message);
    throw err;
  }
}

export async function queryPlanningData(dbConfig, station, fromDate, toDate) {
  console.log('🚨🚨🚨 DEBUG: queryPlanningData called with station:', station);
  console.log('🚨🚨🚨 DEBUG: This is the NEW version of queryPlanningData');
  
  // แก้ไข: ใช้ mapMachineToProductionPlan แทน mapMachineToStation
  const mappedStation = mapMachineToProductionPlan(station);
  console.log('🔍 Mapping station for Production Plan:', station, '→', mappedStation);
  
  // แก้ไข: ใช้ full path เหมือนกับ dashboard card
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
    // ใช้ helper function สำหรับการเชื่อมต่อ
    pool = await getCEOReportConnection();
    console.log('🔍 DEBUG: Connection pool connected successfully');
    
    // เพิ่ม debug เพื่อตรวจสอบว่า query จริงหรือไม่
    console.log('🔍 DEBUG: About to execute query...');
    const result = await pool.request()
      .input('fromDate', sql.VarChar, fromDate)
      .input('toDate', sql.VarChar, toDate)
      .input('station', sql.VarChar, mappedStation)
      .query(sqlQuery);
    
    console.log('🔍 DEBUG: Query executed successfully');
    console.log('🔍 DEBUG: Query result count:', result.recordset.length);
    
    // เพิ่ม debug เพื่อดูข้อมูลที่ได้
    if (result.recordset.length > 0) {
      console.log('🔍 DEBUG: Sample data:', result.recordset[0]);
    }
    
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
    
    // ถ้า error ให้ return array ว่าง
    console.log('🔍 DEBUG: Returning empty array due to error');
    return [];
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
  console.log('🔄 Starting updateProductionPlan:', { station, fromDate, toDate, shift, user });
  
  // ใช้ CEO_REPORT database สำหรับ production_plan
  const mappedStation = mapMachineToProductionPlan(station);
  console.log(' Mapped station for Production Plan:', station, '→', mappedStation);
  
  let ceoPool = null;
  let sourcePool = null;
  
  try {
    // Step 1: เชื่อมต่อไปยัง source database เพื่อดึงข้อมูลจาก GET_CD3DATA
    console.log('🔍 Connecting to source database...');
    const sourceConfig = {
      user: dbConfig.user,
      password: dbConfig.password,
      server: dbConfig.host,
      database: dbConfig.database,
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 30000
      },
      pool: { max: 2, min: 0, idleTimeoutMillis: 5000 }
    };
    
    sourcePool = await sql.connect(sourceConfig);
    console.log('✅ Connected to source database');
    
    console.log('🔄 Step 1: Fetching data from GET_CD3DATA...');
    const selectQuery = `
      SELECT 
        machine,
        material,
        doc_date,
        rmd_size,
        SUM(rmd_weight)/1000 as ton,
        rmd_period
      FROM GET_CD3DATA 
      WHERE doc_date BETWEEN @fromDate AND @toDate
      AND rmd_size IS NOT NULL 
      AND rmd_qa_grade = 'A1' 
      AND rmd_weight > 0 
      GROUP BY machine, doc_date, rmd_size, material, rmd_period
    `;
    
    const dataResult = await sourcePool.request()
      .input('fromDate', sql.VarChar, fromDate)
      .input('toDate', sql.VarChar, toDate)
      .query(selectQuery);
    
    console.log('✅ Fetched records from source:', dataResult.recordset.length);
    
    // Step 2: เชื่อมต่อไปยัง CEO_REPORT database
    console.log('🔍 Connecting to CEO_REPORT database...');
    ceoPool = await getCEOReportConnection();
    console.log('✅ Connected to CEO_REPORT database');
    
    // เพิ่ม debug เพื่อตรวจสอบ server ที่เชื่อมต่อ
    console.log('🔍 DEBUG: Checking current database and server...');
    try {
      const serverCheck = await ceoPool.request().query('SELECT @@SERVERNAME as server_name, DB_NAME() as database_name');
      console.log('🔍 DEBUG: Connected to:', serverCheck.recordset[0]);
    } catch (err) {
      console.log('❌ DEBUG: Error checking server:', err.message);
    }
    
    // Step 3: ข้ามการตรวจสอบตาราง (เหมือน queryPlanningData)
    console.log('🔄 Step 3: Skipping table check (like queryPlanningData)...');
    
    // Step 4: ตรวจสอบว่ามีข้อมูลที่จะลบหรือไม่
    console.log('🔄 Step 2: Checking existing records in production_plan...');
    const checkExistingQuery = `
      SELECT COUNT(*) as existing_count
      FROM production_plan
      WHERE station = @station 
      AND postingdate BETWEEN @fromDate AND @toDate
    `;
    
    const existingCheck = await ceoPool.request()
      .input('station', sql.VarChar, mappedStation)
      .input('fromDate', sql.VarChar, fromDate)
      .input('toDate', sql.VarChar, toDate)
      .query(checkExistingQuery);
    
    const existingCount = existingCheck.recordset[0].existing_count;
    console.log('🔍 Existing records to delete:', existingCount);
    
    let deletedCount = 0;
    
    // Step 5: ลบข้อมูลเดิมใน CEO_REPORT (ถ้ามี)
    if (existingCount > 0) {
      console.log('🔄 Step 3: Deleting existing records in production_plan...');
      const deleteQuery = `
        DELETE FROM production_plan
        WHERE station = @station 
        AND postingdate BETWEEN @fromDate AND @toDate
      `;
      
      console.log('🔍 Delete query:', deleteQuery);
      console.log('🔍 Delete parameters:', { station: mappedStation, fromDate, toDate });
      
      const deleteResult = await ceoPool.request()
        .input('station', sql.VarChar, mappedStation)
        .input('fromDate', sql.VarChar, fromDate)
        .input('toDate', sql.VarChar, toDate)
        .query(deleteQuery);
      
      deletedCount = deleteResult.rowsAffected[0];
      console.log('✅ Deleted existing records:', deletedCount);
    } else {
      console.log('⏭️ No existing records to delete, skipping delete step');
    }
    
    // Step 6: Insert ข้อมูลใหม่เข้า CEO_REPORT.production_plan
    console.log('🔄 Step 4: Inserting new records to production_plan...');
    let insertedCount = 0;
    
    for (const row of dataResult.recordset) {
      const insertQuery = `
        INSERT INTO production_plan 
        ([machine],[station],[material_code],[postingdate],[size],[ton],[change],[username],[shift],[Status],[complete])
        VALUES (@machine, @station, @material_code, @postingdate, @size, @ton, @change, @username, @shift, @Status, @complete)
      `;
      
      await ceoPool.request()
        .input('machine', sql.VarChar, row.machine)
        .input('station', sql.VarChar, mappedStation)
        .input('material_code', sql.VarChar, row.material)
        .input('postingdate', sql.VarChar, row.doc_date)
        .input('size', sql.VarChar, row.rmd_size)
        .input('ton', sql.Float, row.ton)
        .input('change', sql.DateTime, new Date())
        .input('username', sql.VarChar, user)
        .input('shift', sql.VarChar, row.rmd_period)
        .input('Status', sql.VarChar, 'ผลิตแน่')
        .input('complete', sql.Int, -1)
        .query(insertQuery);
      
      insertedCount++;
    }
    
    console.log('✅ Inserted records:', insertedCount);
    
    return { 
      success: true, 
      message: 'อัพเดตข้อมูลสำเร็จ',
      deleted: deletedCount,
      inserted: insertedCount
    };
  } catch (err) {
    console.error('❌ Error in updateProductionPlan:', err);
    
    // ปิดการเชื่อมต่อถ้ายังเปิดอยู่
    if (sourcePool) {
      try {
        await sourcePool.close();
        console.log(' Closed source pool');
      } catch (closeErr) {
        console.error('❌ Error closing source pool:', closeErr.message);
      }
    }
    
    if (ceoPool) {
      try {
        await ceoPool.close();
        console.log('🔍 Closed CEO_REPORT pool');
      } catch (closeErr) {
        console.error('❌ Error closing CEO_REPORT pool:', closeErr.message);
      }
    }
    
    // ส่งข้อผิดพลาดที่ชัดเจนขึ้น
    let errorMessage = 'เกิดข้อผิดพลาดในการอัพเดตข้อมูล';
    if (err.message.includes('timeout')) {
      errorMessage = 'การเชื่อมต่อฐานข้อมูลหมดเวลา';
    } else if (err.message.includes('connection')) {
      errorMessage = 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้';
    } else if (err.message.includes('login')) {
      errorMessage = 'ข้อมูลการเข้าสู่ระบบฐานข้อมูลไม่ถูกต้อง';
    } else if (err.message.includes('Invalid object name')) {
      errorMessage = 'ไม่พบตารางหรือ view ที่ระบุ';
    }
    
    throw new Error(`${errorMessage}: ${err.message}`);
  }
}