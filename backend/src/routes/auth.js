import express from 'express';
import sql from 'mssql';
const router = express.Router();

// API endpoint สำหรับตรวจสอบ user role
router.post('/check-role', async (req, res) => {
  const { currentUser, dbConfig } = req.body;
  
  console.log(' Check role request:', { currentUser, dbConfig });
  
  if (!currentUser || !dbConfig) {
    return res.status(400).json({
      success: false,
      message: 'Missing required parameters'
    });
  }

  let pool = null;
  
  try {
    // สร้าง connection config
    const config = {
      user: dbConfig.user,
      password: dbConfig.password,
      server: dbConfig.host,
      database: dbConfig.database,
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    };

    console.log('🔍 Connecting to database:', dbConfig.host);

    // สร้าง connection pool ใหม่
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    
    // ค้นหา user ในตาราง tblUsers - ใช้ UPPER() เพื่อเปรียบเทียบแบบ case-insensitive
    const query = `
      SELECT [Username], [UserLevel], [IsActive]
      FROM ${dbConfig.table}
      WHERE UPPER([Username]) = UPPER(@currentUser) AND [IsActive] > 0
    `;
    
    console.log('🔍 Executing query with user:', currentUser);
    
    const result = await pool.request()
      .input('currentUser', sql.NVarChar, currentUser)
      .query(query);

    console.log('🔍 Query result:', result.recordset);

    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      console.log('✅ User found:', user);
      return res.json({
        success: true,
        userLevel: user.UserLevel,
        username: user.Username,
        isActive: user.IsActive
      });
    } else {
      console.log('❌ User not found or inactive');
      return res.json({
        success: false,
        message: 'User not found or inactive'
      });
    }

  } catch (error) {
    console.error('❌ Database error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database connection error: ' + error.message
    });
  } finally {
    // ปิด connection pool อย่างถูกต้อง
    if (pool) {
      try {
        await pool.close();
        console.log('✅ Database connection closed');
      } catch (closeError) {
        console.error('❌ Error closing pool:', closeError);
      }
    }
  }
});

export default router; 