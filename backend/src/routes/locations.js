import express from 'express';
import sql from 'mssql';
import { getDbConfigByName } from '../dbUtil.js';

const router = express.Router();

// Helper function to get database connection
const getPlates2Connection = async () => {
    const dbConfig = getDbConfigByName('ตัดแผ่น 2');
    if (!dbConfig) {
        throw new Error('Database configuration for "ตัดแผ่น 2" not found.');
    }

    const config = {
        user: dbConfig.user,
        password: dbConfig.password,
        server: dbConfig.host,
        database: 'PLATES2', // Explicitly use PLATES2 database
        options: {
            encrypt: false,
            trustServerCertificate: true,
        },
    };

    const pool = new sql.ConnectionPool(config);
    return pool.connect();
};

// GET /api/locations - Get all locations
router.get('/', async (req, res) => {
    try {
        const pool = await getPlates2Connection();
        const result = await pool.request().query('SELECT * FROM tbl_location');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query failed' });
    }
});

// POST /api/locations - Add a new location
router.post('/', async (req, res) => {
    const { Plant, Location, description } = req.body;
    if (!Plant || !Location) {
        return res.status(400).json({ error: 'Plant and Location are required' });
    }

    try {
        const pool = await getPlates2Connection();
        const request = pool.request();
        request.input('Plant', sql.NVarChar, Plant);
        request.input('Location', sql.NVarChar, Location);
        request.input('description', sql.NVarChar, description);

        await request.query('INSERT INTO tbl_location (Plant, Location, description) VALUES (@Plant, @Location, @description)');
        res.status(201).json({ message: 'Location added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database insert failed' });
    }
});

// PUT /api/locations/:location - Update a location
router.put('/:location', async (req, res) => {
    const { location } = req.params;
    const { Plant, description } = req.body;

    if (!Plant) {
        return res.status(400).json({ error: 'Plant is required for update' });
    }

    try {
        const pool = await getPlates2Connection();
        const request = pool.request();
        request.input('Plant', sql.NVarChar, Plant);
        request.input('Location', sql.NVarChar, location);
        request.input('description', sql.NVarChar, description);

        await request.query('UPDATE tbl_location SET description = @description WHERE Plant = @Plant AND Location = @Location');
        res.json({ message: 'Location updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database update failed' });
    }
});

// DELETE /api/locations/:location - Delete a location
router.delete('/:location', async (req, res) => {
    const { location } = req.params;
    const { Plant } = req.body;

    if (!Plant) {
        return res.status(400).json({ error: 'Plant is required for deletion' });
    }

    try {
        const pool = await getPlates2Connection();
        const request = pool.request();
        request.input('Plant', sql.NVarChar, Plant);
        request.input('Location', sql.NVarChar, location);

        await request.query('DELETE FROM tbl_location WHERE Plant = @Plant AND Location = @Location');
        res.json({ message: 'Location deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database delete failed' });
    }
});

export default router;