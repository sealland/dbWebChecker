import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '..', 'db_instances.config.json');
const dbInstances = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export function getDbConfigByName(name) {
  return dbInstances.find(db => db.name === name);
}

export function getAllDbConfigs() {
  return dbInstances;
}

// แก้ไขฟังก์ชัน pingHost
function pingHost(host) {
  console.log(`[DEBUG] Starting ping test for ${host}`);
  
  return new Promise((resolve) => {
    const pingCommand = `ping -n 4 -w 1000 ${host}`;
    console.log(`[DEBUG] Executing: ${pingCommand}`);
    
    exec(pingCommand, (error, stdout, stderr) => {
      console.log(`[DEBUG] Ping command completed for ${host}`);
      console.log(`[ERROR] Ping error:`, error);
      console.log(`[DEBUG] Stdout length:`, stdout ? stdout.length : 0);
      console.log(`[ERROR] Stderr:`, stderr);
      
      if (error) {
        console.log(`[ERROR] Ping error for ${host}:`, error.message);
        return resolve({ 
          online: false, 
          status: 'machine_offline',
          reason: 'ping_error' 
        });
      }
      
      if (stderr) {
        console.log(`[WARN] Ping stderr for ${host}:`, stderr);
      }
      
      console.log(`[DEBUG] Raw ping output for ${host}:`, stdout ? stdout.substring(0, 200) + '...' : 'No output');
      
      if (!stdout) {
        console.log(`[ERROR] No stdout from ping command`);
        return resolve({ 
          online: false, 
          status: 'machine_offline',
          reason: 'no_output' 
        });
      }
      
      const lines = stdout.split('\n');
      const responses = lines.filter(line => line.includes('Reply from'));
      
      console.log(`[DEBUG] Ping responses for ${host}:`, responses.length, 'responses');
      console.log(`[DEBUG] Response lines:`, responses);
      
      if (responses.length === 0) {
        console.log(`[ERROR] No ping responses for ${host}`);
        return resolve({ 
          online: false, 
          status: 'machine_offline',
          reason: 'no_response' 
        });
      }
      
      // วิเคราะห์ความเสถียร
      const times = responses.map(line => {
        const match = line.match(/time=(\d+)ms/);
        const time = match ? parseInt(match[1]) : null;
        console.log(`[DEBUG] Parsed time from "${line}": ${time}ms`);
        return time;
      }).filter(time => time !== null);
      
      console.log(`[DEBUG] Valid ping times for ${host}:`, times);
      
      if (times.length === 0) {
        console.log(`[ERROR] No valid ping times for ${host}`);
        return resolve({ 
          online: true, 
          status: 'network_unstable',
          reason: 'invalid_response' 
        });
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = maxTime - minTime;
      
      console.log(`[DEBUG] Ping analysis for ${host}:`, {
        times,
        avgTime: Math.round(avgTime),
        maxTime,
        minTime,
        variance,
        responseCount: times.length
      });
      
      // กำหนดเกณฑ์ความเสถียร (ปรับปรุง)
      let status = 'normal';
      if (variance > 200) {
        status = 'network_unstable';
        console.log(`[WARN] High variance detected: ${variance}ms > 200ms`);
      } else if (avgTime > 500) {
        status = 'network_slow';
        console.log(`[WARN] High avg time detected: ${avgTime}ms > 500ms`);
      } else {
        console.log(`[INFO] Normal network conditions`);
      }
      
      console.log(`[INFO] Status determined for ${host}: ${status}`);
      
      return resolve({
        online: true,
        status: status,
        avgTime: Math.round(avgTime),
        maxTime,
        minTime,
        variance,
        responseCount: times.length
      });
    });
  });
}

export function mapMachineToSourceFormat(stationName) {
  console.log('[DEBUG] Mapping machine to Source format:', stationName);
  const machineConfig = dbInstances.find(instance => instance.name === stationName);
  const sourceFormat = machineConfig ? machineConfig.m : null;
  if (sourceFormat) {
      console.log(`[INFO] Found in config, using source_format: ${sourceFormat}`);
  } else {
      console.warn(`[WARN] No 'm' field (source_format) found for ${stationName} in config.`);
  }
  return sourceFormat;
}

// Mapper สำหรับหาชื่อ Station ใน Production Plan DB
export function mapMachineToProductionPlanFormat(stationName) {
  console.log('[DEBUG] Mapping machine to Production Plan format:', stationName);
  const machineConfig = dbInstances.find(instance => instance.name === stationName);
  
  // ตรวจสอบค่า 'production_plan_format' ใน config ก่อน
  if (machineConfig && machineConfig.production_plan_format) {
      console.log(`[INFO] Found in config, using production_plan_format: ${machineConfig.production_plan_format}`);
      return machineConfig.production_plan_format;
  }
  
  console.log(`[INFO] No 'production_plan_format' in config, using fallback mapping.`);
  // Fallback mapping สำหรับเครื่องที่ไม่มีใน config
  const mapping = {
    'ท่อดำ #1': 'OCP I1', 'ท่อดำ #2': 'OCP I2', 'ท่อดำ #3': 'OCP I3', 'ท่อดำ #4': 'OCP I4',
    'ท่อดำ #5': 'OCP I5', 'ท่อดำ #6': 'OCP I6', 'ท่อดำ #7': 'OCP I7', 'ท่อดำ #8': 'OCP I8',
    'ตัวซี #1': 'OCP H1', 'ตัวซี #2': 'OCP H2', 'ตัวซี #3': 'OCP H3', 'ตัวซี #4': 'OCP H4',
    'ตัวซี #5': 'OCP H5', 'ตัวซี #6': 'OCP H6',
  };
  const mappedStation = mapping[stationName] || stationName;
  console.log('[INFO] Mapped to:', mappedStation);
  return mappedStation;
}

// เพิ่มฟังก์ชันนี้หลัง import statements
export function mapMachineToStation(machineName) {
  console.log('[DEBUG] Mapping machine name:', machineName);
  
  // ดึงข้อมูลจาก config file
  
  const dbInstances = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  // หาเครื่องที่ตรงกับชื่อ
  const machineConfig = dbInstances.find(instance => instance.name === machineName);
  
  if (machineConfig && machineConfig.m) {
    // แปลง mapping สำหรับเครื่องตัดแผ่น
    let mappedStation = machineConfig.m;
    
    // แปลง plates1, plates2, plates4 เป็น P1, P2, P4 สำหรับ production_scale
    if (machineConfig.m === 'plates1') {
      mappedStation = 'P1';
      console.log(`[INFO] Converting ${machineConfig.m} -> ${mappedStation} for production_scale`);
    } else if (machineConfig.m === 'plates2') {
      mappedStation = 'P2';
      console.log(`[INFO] Converting ${machineConfig.m} -> ${mappedStation} for production_scale`);
    } else if (machineConfig.m === 'plates4') {
      mappedStation = 'P4';
      console.log(`[INFO] Converting ${machineConfig.m} -> ${mappedStation} for production_scale`);
    }
    
    console.log('[INFO] Found in config, using m field:', machineConfig.m);
    console.log('[INFO] Final mapped station:', mappedStation);
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
  console.log('[INFO] Mapped to:', mappedStation);
  
  return mappedStation;
}

// เพิ่มฟังก์ชันใหม่สำหรับแปลงชื่อเครื่องเป็น Production Plan format
export function mapMachineToProductionPlan(machineName) {
  console.log('[DEBUG] Mapping machine to Production Plan format:', machineName);
  
  // ดึงข้อมูลจาก config file
  
  const dbInstances = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  // หาเครื่องที่ตรงกับชื่อ
  const machineConfig = dbInstances.find(instance => instance.name === machineName);
  
  if (machineConfig && machineConfig.m) {
    // แปลง C1-C6 เป็น H1-H6 สำหรับ production_plan
    let mappedCode = machineConfig.m;
    if (machineConfig.m.startsWith('C') && machineConfig.m.length === 2) {
      const number = machineConfig.m.substring(1);
      mappedCode = `H${number}`;
      console.log(`[INFO] Converting ${machineConfig.m} -> ${mappedCode}`);
    }
    
    const ocpFormat = `OCP ${mappedCode}`;
    console.log('[INFO] Found in config, Production Plan format:', ocpFormat);
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
  console.log('[INFO] Mapped to Production Plan format:', mappedStation);
  
  return mappedStation;
}

// แก้ไขฟังก์ชัน checkDbOnline
export async function checkDbOnline(dbConfig) {
  console.log(`[DEBUG] Starting status check for ${dbConfig.name} (${dbConfig.host})`);
  
  // ping host ก่อน
  console.log(`[DEBUG] About to call pingHost for ${dbConfig.host}`);
  const pingResult = await pingHost(dbConfig.host);
  console.log(`[INFO] pingHost completed for ${dbConfig.host}:`, pingResult);
  
  if (!pingResult.online) {
    console.error(`[ERROR] Ping failed: ${dbConfig.host} - ${pingResult.reason}`);
    return { 
      online: false, 
      status: 'machine_offline',
      reason: pingResult.reason 
    };
  }
  
  // แสดงข้อมูล ping
  console.log(`[INFO] Ping result for ${dbConfig.host}: avg=${pingResult.avgTime}ms, variance=${pingResult.variance}ms, status=${pingResult.status}`);
  
  const config = {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.host,
    database: dbConfig.database,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 5000
    },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 }
  };
  
  let pool;
  try {
    console.log(`[DEBUG] Connecting to DB: ${dbConfig.name} (${dbConfig.host})`);
    pool = await new sql.ConnectionPool(config).connect();
    await pool.close();
    console.log(`[INFO] DB connection successful for ${dbConfig.name}`);
    
    // ส่งกลับสถานะตาม ping result
    const finalStatus = pingResult.status;
    console.log(`[INFO] Final status for ${dbConfig.name}: ${finalStatus}`);
    
    return { 
      online: true, 
      status: finalStatus,
      avgPingTime: pingResult.avgTime,
      pingVariance: pingResult.variance
    };
  } catch (err) {
    console.error(`[ERROR] DB connection failed for ${dbConfig.name} (${dbConfig.host}):`, err.message);
    if (pool) await pool.close().catch(() => {});
    
    // ถ้า ping ได้แต่ DB เชื่อมต่อไม่ได้
    return { 
      online: false, 
      status: 'machine_offline',
      reason: 'db_connection_failed',
      avgPingTime: pingResult.avgTime,
      pingVariance: pingResult.variance
    };
  }
}

export async function queryA2Rpt(dbConfig, year, month, page = 1, pageSize = 20) {
  console.log('=== queryA2Rpt ===');
  console.log('Parameters:', { year, month, page, pageSize });
  console.log('DB Config:', {
    host: dbConfig.host,
    database: dbConfig.database,
    user: dbConfig.user
  });
  
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
      FROM [dbo].[vw_A2_rpt]
      WHERE FORMAT([rmd_date], 'yyyy-MM') = @ref
    ) t
    WHERE rn BETWEEN @start AND @end
  `;
  
  console.log('SQL Query:', sqlQuery);
  console.log('Parameters:', { ref, start: offset + 1, end: offset + pageSize });
  
  try {
    console.log('Connecting to database...');
    const pool = await sql.connect(config);
    console.log('Connected successfully');
    
    console.log('Executing query...');
    const result = await pool.request()
      .input('ref', sql.VarChar, ref)
      .input('start', sql.Int, offset + 1)
      .input('end', sql.Int, offset + pageSize)
      .query(sqlQuery);
    console.log('Query executed successfully');
    
    await pool.close();
    console.log('Connection closed');
    
    console.log('Result count:', result.recordset.length);
    return result.recordset;
  } catch (err) {
    console.error('Error in queryA2Rpt:', err.message);
    console.error('Error details:', {
      code: err.code,
      state: err.state,
      serverName: err.serverName,
      lineNumber: err.lineNumber
    });
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
    FROM [dbo].[vw_A2_rpt]
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
    FROM [dbo].[vw_A2_rpt]
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
  // **แก้ไข**: ดึง config จาก dbInstances แทนตัวแปร config ที่ไม่มีอยู่
  const ceoConfig = dbInstances.find(db => db.database === 'CEO_REPORT');
  
  if (!ceoConfig) {
      throw new Error('ไม่พบการตั้งค่าสำหรับฐานข้อมูล CEO_REPORT ใน db_instances.config.json');
  }

  let pool;
  try {
      console.log("DEBUG: Creating new ConnectionPool for CEO_REPORT...");
      // **แก้ไข**: ใช้ ceoConfig ที่หาเจอ
      pool = new sql.ConnectionPool({
          user: ceoConfig.user,
          password: ceoConfig.password,
          server: ceoConfig.host,
          database: ceoConfig.database,
          port: ceoConfig.port || 1433,
          options: {
              encrypt: false,
              trustServerCertificate: true,
              connectTimeout: 30000,
              requestTimeout: 30000
          }
      });

      const connection = await pool.connect();
      console.log("DEBUG: CEO_REPORT ConnectionPool connected successfully.");

      const dbNameResult = await connection.request().query('SELECT DB_NAME() AS db_name');
      const actualDbName = dbNameResult.recordset[0].db_name;

      if (actualDbName.toUpperCase() !== ceoConfig.database.toUpperCase()) {
          await pool.close();
          throw new Error(`เชื่อมต่อผิด database: ${actualDbName} (ควรเป็น ${ceoConfig.database})`);
      }
      
      console.log(`DEBUG: Connected to correct database: ${ceoConfig.database}`);
      return pool;

  } catch (err) {
      console.error("Error in getCEOReportConnection:", err.message);
      if (pool) await pool.close().catch(() => {});
      throw err;
  }
}

export async function queryPlanningData(dbConfig, station, fromDate, toDate) {
  console.log('DEBUG: queryPlanningData called with station:', station);
  
  // **แก้ไข**: ใช้ฟังก์ชัน mapper ที่ถูกต้อง
  const mappedStation = mapMachineToProductionPlanFormat(station);
  
  const sqlQuery = `
    SELECT postingdate, material_code, size
    FROM production_plan
    WHERE postingdate BETWEEN @fromDate AND @toDate
    AND station = @station
  `;
  
  console.log('DEBUG: SQL Query:', sqlQuery);
  console.log('DEBUG: Parameters:', { fromDate, toDate, station: mappedStation });
  
  let pool;
  try {
    pool = await getCEOReportConnection();
    console.log('DEBUG: Connection pool connected successfully');
    
    const result = await pool.request()
      .input('fromDate', sql.VarChar, fromDate)
      .input('toDate', sql.VarChar, toDate)
      .input('station', sql.VarChar, mappedStation)
      .query(sqlQuery);
    
    console.log('DEBUG: Query executed successfully, result count:', result.recordset.length);
    return result.recordset;
  } catch (err) {
    console.error('DEBUG: Query error:', err.message);
    return [];
  } finally {
    if (pool) {
      await pool.close().catch(e => console.error('DEBUG: Error closing pool:', e.message));
    }
  }
}

// ฟังก์ชันอัพเดตข้อมูล Production Plan
export async function updateProductionPlan(dbConfig, station, fromDate, toDate, shift = "Z", user = "system") {
  // โค้ดใหม่จะบังคับใช้ shift = 'Z' ตอน INSERT ตามที่คุณบอก
  const finalShift = "Z"; 
  console.log("Starting updateProductionPlan:", { station, fromDate, toDate, shift: finalShift, user });

  let sourcePool = null;
  let ceoReportPool = null;

  try {
      // --- ส่วนที่ 1: ดึงข้อมูลจาก Source Database ---
      console.log(`Connecting to source database for station: ${station}`);
      
      const sourceConfig = {
          user: dbConfig.user,
          password: dbConfig.password,
          server: dbConfig.host,
          database: dbConfig.database,
          port: dbConfig.port || 1433,
          options: { encrypt: false, trustServerCertificate: true, connectTimeout: 30000, requestTimeout: 30000 }
      };

      sourcePool = new sql.ConnectionPool(sourceConfig);
      await sourcePool.connect();
      console.log("Connected to source database");

      console.log("Step 1: Fetching data from GET_CD3DATA (View)...");

      // **แก้ไข SQL SELECT ให้ตรงกับโค้ด Access เดิม (มีการ GROUP BY)**
      const sourceQuery = `
          SELECT 
              machine,
              doc_date,
              material,
              rmd_size,
              rmd_period,
              SUM(rmd_weight) / 1000.0 AS ton
          FROM 
              GET_CD3DATA
          WHERE 
              CAST(doc_date AS DATE) BETWEEN @fromDate AND @toDate
              AND rmd_size IS NOT NULL 
              AND rmd_qa_grade = 'A1' 
              AND rmd_weight > 0
          GROUP BY 
              machine, doc_date, material, rmd_size, rmd_period
      `;

      console.log('DEBUG: SQL Query for Source View:', sourceQuery);
      const sourceResult = await sourcePool.request()
          .input('fromDate', sql.Date, fromDate)
          .input('toDate', sql.Date, toDate)
          .query(sourceQuery);

      const recordsToUpdate = sourceResult.recordset;
      console.log(`Fetched records from source: ${recordsToUpdate.length}`);

      if (recordsToUpdate.length === 0) {
          console.log("No records to update. Task finished.");
          if (sourcePool && sourcePool.connected) {
              await sourcePool.close();
          }
          return { message: "ไม่มีข้อมูลให้อัปเดต" };
      }

      // --- ส่วนที่ 2: เชื่อมต่อ CEO_REPORT ---
      console.log("Connecting to CEO_REPORT database...");
      ceoReportPool = await getCEOReportConnection();
      console.log("Connection to CEO_REPORT successful.");

      // --- ส่วนที่ 3: เริ่ม Transaction ---
      const transaction = new sql.Transaction(ceoReportPool);
      await transaction.begin();
      console.log("Step 2: Begin transaction on CEO_REPORT");
      
      try {
          // **แก้ไข DELETE ให้ตรงกับโค้ด Access เดิม (มีการ UPDATE status ก่อน)**
          const mappedStationForPlan = mapMachineToProductionPlanFormat(station);
          console.log(`Updating existing records' status to 'รอตรวจสอบ' for station: ${mappedStationForPlan}`);
          
          const updateRequest = new sql.Request(transaction);
          await updateRequest
              .input('station', sql.VarChar, mappedStationForPlan)
              .input('fromDate', sql.Date, fromDate)
              .input('toDate', sql.Date, toDate)
              .input('shift', sql.VarChar, finalShift)
              .query(`
                  UPDATE production_plan 
                  SET status = 'รอตรวจสอบ', shift = @shift
                  WHERE station = @station AND CAST(postingdate AS DATE) BETWEEN @fromDate AND @toDate
              `);
          console.log("Existing records updated.");

          // **แก้ไข INSERT ให้ตรงกับโค้ด Access เดิม**
          console.log(`Step 3: Inserting ${recordsToUpdate.length} new records...`);
          for (const record of recordsToUpdate) {
              const insertRequest = new sql.Request(transaction);
              await insertRequest
                  .input('machine', sql.VarChar, record.machine)
                  .input('station', sql.VarChar, mappedStationForPlan) // ใช้ mapped station
                  .input('material_code', sql.VarChar, record.material)
                  .input('postingdate', sql.Date, record.doc_date)
                  .input('size', sql.VarChar, record.rmd_size)
                  .input('ton', sql.Decimal(18, 4), record.ton)
                  .input('change', sql.DateTime, new Date()) // เวลาปัจจุบัน
                  .input('username', sql.VarChar, user) // user ที่ส่งมา
                  .input('shift', sql.VarChar, record.rmd_period) // **สำคัญ: ใช้กะจากข้อมูลที่ดึงมา**
                  .input('Status', sql.VarChar, 'ผลิตเสร็จ') // "ผลิตเสร็จ"
                  .input('complete', sql.Int, -1)
                  .query(`
                      INSERT INTO production_plan 
                      (machine, station, material_code, postingdate, size, ton, change, username, shift, Status, complete)
                      VALUES 
                      (@machine, @station, @material_code, @postingdate, @size, @ton, @change, @username, @shift, @Status, @complete)
                  `);
          }
          
          await transaction.commit();
          console.log("Transaction committed successfully!");
          
          return { message: `อัปเดตข้อมูลสำเร็จ ${recordsToUpdate.length} รายการ` };

      } catch (err) {
          console.error("Error during transaction, rolling back...", err);
          await transaction.rollback();
          console.log("Transaction rolled back.");
          throw err;
      }

  } catch (error) {
      console.error(`Fatal Error in updateProductionPlan: ${error.message}`);
      throw error;
  } finally {
      if (sourcePool && sourcePool.connected) await sourcePool.close();
      if (ceoReportPool && ceoReportPool.connected) await ceoReportPool.close();
  }
}