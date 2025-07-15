import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const configPath = path.resolve(process.cwd(), '../db_instances.config.json');
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