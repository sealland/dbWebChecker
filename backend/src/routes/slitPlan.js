import express from 'express';
import sql from 'mssql';
import { getDbConfigByName } from '../dbUtil.js';

const router = express.Router();

// Helper function to get database connection by machine name
const getMachineConnection = async (machineName) => {
    const dbConfig = getDbConfigByName(machineName);
    if (!dbConfig) {
        throw new Error(`Database configuration for "${machineName}" not found.`);
    }
    const config = {
        user: dbConfig.user,
        password: dbConfig.password,
        server: dbConfig.host,
        database: dbConfig.database,
        options: {
            encrypt: false,
            trustServerCertificate: true,
        },
    };
    const pool = new sql.ConnectionPool(config);
    return pool.connect();
};

// Helper function to get production scale database connection
const getProductionScaleConnection = async () => {
    const config = {
        user: process.env.SLIT_DB_USER || 'sa',
        password: process.env.SLIT_DB_PASSWORD || '',
        server: process.env.SLIT_DB_SERVER || '192.168.100.222',
        database: process.env.SLIT_DB_NAME || 'PP', // ชื่อ DB ที่มีตาราง tbl_production_scale
        port: parseInt(process.env.SLIT_DB_PORT || '1433', 10),
        options: {
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: 10000,
            requestTimeout: 15000,
        },
        pool: { max: 2, min: 0, idleTimeoutMillis: 5000 }
    };
    const pool = new sql.ConnectionPool(config);
    return pool.connect();
};

// GET /api/slit-plan/search?charge=...
router.get('/search', async (req, res) => {
    const { charge } = req.query;
    if (!charge) {
        return res.status(400).json({ error: 'Missing charge parameter' });
    }
    try {
        const pool = await getProductionScaleConnection();
        try {
            const tableName = process.env.SLIT_TABLE_NAME || 'tbl_production_scale';
            const result = await pool.request()
                .input('charge', sql.NVarChar, charge)
                .query(`SELECT rmd_mat, rmd_charge, rmd_weight FROM [${tableName}] WHERE rmd_charge = @charge`);
            res.json(result.recordset);
        } finally {
            await pool.close().catch(() => {});
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query failed', detail: err.message });
    }
});

export default router;