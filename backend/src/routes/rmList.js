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

// GET /api/rm-list?machine=...&status=...&page=1&pageSize=20
router.get('/', async (req, res) => {
    const { machine, status, page = 1, pageSize = 20 } = req.query;
    if (!machine) {
        return res.status(400).json({ error: 'Missing machine parameter' });
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const sizeNum = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 200);
    const offset = (pageNum - 1) * sizeNum;

    let pool;
    try {
        pool = await getMachineConnection(machine);

        // Build WHERE
        const where = [];
        const params = [];
        if (status && status !== 'all') {
            where.push('rm_status = @status');
            params.push({ name: 'status', type: sql.NVarChar, value: status });
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        // Count total
        const countReq = pool.request();
        params.forEach(p => countReq.input(p.name, p.type, p.value));
        const countResult = await countReq.query(`SELECT COUNT(*) AS total FROM tbl_rm_list ${whereSql}`);
        const total = countResult.recordset[0]?.total || 0;

        // Fetch page
        const dataReq = pool.request();
        params.forEach(p => dataReq.input(p.name, p.type, p.value));
        dataReq.input('offset', sql.Int, offset);
        dataReq.input('limit', sql.Int, sizeNum);
        const dataResult = await dataReq.query(`
            SELECT matnr, batch, width, sloc, weight, qty, unit, rm_status
            FROM tbl_rm_list
            ${whereSql}
            ORDER BY batch DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        res.json({
            data: dataResult.recordset,
            total,
            page: pageNum,
            pageSize: sizeNum,
            totalPages: Math.ceil(total / sizeNum)
        });
    } catch (err) {
        console.error('RM list error:', err);
        res.status(500).json({ error: 'Database query failed', detail: err.message });
    } finally {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
    }
});

// POST /api/rm-list?machine=...
router.post('/', async (req, res) => {
    const { machine } = req.query;
    const { matnr, batch, width, sloc, weight, qty, unit, rm_status } = req.body;
    
    if (!machine) {
        return res.status(400).json({ error: 'Missing machine parameter' });
    }
    if (!matnr || !batch) {
        return res.status(400).json({ error: 'matnr and batch are required' });
    }
    
    try {
        const pool = await getMachineConnection(machine);
        const request = pool.request();
        request.input('matnr', sql.NVarChar, matnr);
        request.input('batch', sql.NVarChar, batch);
        request.input('width', sql.NVarChar, width);
        request.input('sloc', sql.NVarChar, sloc);
        request.input('weight', sql.Decimal, weight);
        request.input('qty', sql.Decimal, qty);
        request.input('unit', sql.NVarChar, unit);
        request.input('rm_status', sql.NVarChar, rm_status);
        
        await request.query(`
            INSERT INTO tbl_rm_list (matnr, batch, width, sloc, weight, qty, unit, rm_status) 
            VALUES (@matnr, @batch, @width, @sloc, @weight, @qty, @unit, @rm_status)
        `);
        
        res.status(201).json({ 
            message: 'RM List item added successfully',
            matnr, batch, width, sloc, weight, qty, unit, rm_status
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database insert failed', detail: err.message });
    }
});

// GET /api/rm-list/check?machine=...&charge=...
router.get('/check', async (req, res) => {
    const { machine, charge } = req.query;
    if (!machine || !charge) {
        return res.status(400).json({ error: 'Missing machine or charge parameter' });
    }
    try {
        const pool = await getMachineConnection(machine);
        const result = await pool.request()
            .input('charge', sql.NVarChar, charge)
            .query('SELECT COUNT(*) as count FROM tbl_rm_list WHERE batch = @charge');
        
        res.json({ exists: result.recordset[0].count > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query failed', detail: err.message });
    }
});

// DELETE /api/rm-list/:batch?machine=...
router.delete('/:batch', async (req, res) => {
    const { machine } = req.query;
    const { batch } = req.params;
    if (!machine || !batch) {
        return res.status(400).json({ error: 'Missing machine or batch parameter' });
    }
    let pool;
    try {
        pool = await getMachineConnection(machine);
        const request = pool.request();
        request.input('batch', sql.NVarChar, batch);
        const result = await request.query('DELETE FROM tbl_rm_list WHERE batch = @batch');
        res.json({ success: true, deleted: result.rowsAffected?.[0] || 0 });
    } catch (err) {
        console.error('RM delete error:', err);
        res.status(500).json({ error: 'Database delete failed', detail: err.message });
    } finally {
        if (pool) try { await pool.close(); } catch (_) {}
    }
});

export default router;