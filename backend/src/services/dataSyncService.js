import sql from 'mssql';
import { getAllDbConfigs } from '../dbUtil.js';

export class DataSyncService {
  constructor() {
    this.centralConfig = {
      server: "192.168.100.222",
      database: "PP_OCP",
      user: "sa",
      password: "",
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectionTimeout: 30000,
        requestTimeout: 300000
      }
    };
    this.lastSyncTime = new Date();
  }

  	// ดึงข้อมูล BOM จาก Central ตามช่วงเวลา
	async getBOMDataFromCentralSince(since) {
		const pool = await sql.connect(this.centralConfig);
		try {
			const query = `
				SELECT 
					matcode,length,size,qty,matgroup,minweight,maxweight,
					mintisweight,maxtisweight,remark,internal_size,last_update,
					color,speed,table_weight,sap_description,actual_thickness,cIn,cOut
				FROM dbo.tbl_check_p
				WHERE last_update >= @since
				ORDER BY last_update ASC
			`;
			const result = await pool.request()
				.input('since', sql.DateTime, since)
				.query(query);
			return result.recordset;
		} finally {
			await pool.close();
		}
	}

		// ดึงข้อมูล BOM จาก Central ตามช่วงเวลา
    async getBOMDataFromCentralSince(since) {
      const pool = await sql.connect(this.centralConfig);
		try {
			const query = `
				SELECT 
            matcode,length,size,qty,matgroup,minweight,maxweight,
            mintisweight,maxtisweight,remark,internal_size,last_update,
            color,speed,table_weight,sap_description,actual_thickness,cIn,cOut
				FROM dbo.tbl_check_p
          WHERE last_update >= @since
          ORDER BY last_update ASC
        `;
        const result = await pool.request()
          .input('since', sql.DateTime, since)
          .query(query);
			return result.recordset;
		} finally {
			await pool.close();
		}
	}

    	// ซิงก์แบบ set-based ด้วย staging table (เร็วกว่า loop)
		// ซิงก์แบบ set-based ด้วย staging table (เร็วกว่า loop)
    async syncBOMUsingStaging(transaction, centralData, machineConfig) {
      // สร้างตาราง staging ถ้ายังไม่มี
      await transaction.request().query(`
  IF OBJECT_ID('dbo._stg_check_p','U') IS NULL
  CREATE TABLE dbo._stg_check_p (
    matcode nvarchar(40) NULL,
    [length] decimal(18,4) NULL,
    [size] nvarchar(100) NULL,
    qty decimal(18,4) NULL,
    matgroup nvarchar(100) NULL,
    minweight decimal(18,4) NULL,
    maxweight decimal(18,4) NULL,
    mintisweight decimal(18,4) NULL,
    maxtisweight decimal(18,4) NULL,
    remark nvarchar(40) NULL,
    internal_size nvarchar(100) NULL,
    last_update datetime NULL,
    color nvarchar(40) NULL,
    speed decimal(18,4) NULL,
    table_weight decimal(18,3) NULL,
    sap_description nvarchar(100) NULL,
    actual_thickness decimal(18,4) NULL,
    cIn decimal(18,4) NULL,
    cOut decimal(18,4) NULL
  );
  TRUNCATE TABLE dbo._stg_check_p;
      `);
  
      // เตรียม bulk insert ลง staging
      const table = new sql.Table('dbo._stg_check_p');
      table.create = false;
      table.columns.add('matcode', sql.NVarChar(40), { nullable: true });
      table.columns.add('length', sql.Decimal(18,4), { nullable: true });
      table.columns.add('size', sql.NVarChar(100), { nullable: true });
      table.columns.add('qty', sql.Decimal(18,4), { nullable: true });
      table.columns.add('matgroup', sql.NVarChar(100), { nullable: true });
      table.columns.add('minweight', sql.Decimal(18,4), { nullable: true });
      table.columns.add('maxweight', sql.Decimal(18,4), { nullable: true });
      table.columns.add('mintisweight', sql.Decimal(18,4), { nullable: true });
      table.columns.add('maxtisweight', sql.Decimal(18,4), { nullable: true });
      table.columns.add('remark', sql.NVarChar(40), { nullable: true });
      table.columns.add('internal_size', sql.NVarChar(100), { nullable: true });
      table.columns.add('last_update', sql.DateTime, { nullable: true });
      table.columns.add('color', sql.NVarChar(40), { nullable: true });
      table.columns.add('speed', sql.Decimal(18,4), { nullable: true });
      table.columns.add('table_weight', sql.Decimal(18,3), { nullable: true });
      table.columns.add('sap_description', sql.NVarChar(100), { nullable: true });
      table.columns.add('actual_thickness', sql.Decimal(18,4), { nullable: true });
      table.columns.add('cIn', sql.Decimal(18,4), { nullable: true });
      table.columns.add('cOut', sql.Decimal(18,4), { nullable: true });
  
      for (const r of centralData) {
        table.rows.add(
          r.matcode, r.length, r.size, r.qty, r.matgroup, r.minweight, r.maxweight,
          r.mintisweight, r.maxtisweight, r.remark, r.internal_size, r.last_update,
          r.color, r.speed, r.table_weight, r.sap_description, r.actual_thickness, r.cIn, r.cOut
        );
      }
      await new sql.Request(transaction).bulk(table);
  
      // ลบแถวที่ปลายทางเก่ากว่า
      await transaction.request().query(`
  DELETE T
  FROM dbo.tbl_check_p T
  INNER JOIN dbo._stg_check_p S
    ON T.matcode = S.matcode COLLATE Thai_CI_AS
  WHERE S.last_update > T.last_update;
      `);
  
      // แทรกแถวใหม่ หรือที่ใหม่กว่า
      await transaction.request().query(`
  INSERT INTO dbo.tbl_check_p (
    matcode,[length],[size],qty,matgroup,minweight,maxweight,
    mintisweight,maxtisweight,remark,internal_size,last_update,
    color,speed,table_weight,sap_description,actual_thickness,cIn,cOut
  )
  SELECT
    S.matcode,S.[length],S.[size],S.qty,S.matgroup,S.minweight,S.maxweight,
    S.mintisweight,S.maxtisweight,S.remark,S.internal_size,S.last_update,
    S.color,S.speed,S.table_weight,S.sap_description,S.actual_thickness,S.cIn,S.cOut
  FROM dbo._stg_check_p S
  LEFT JOIN dbo.tbl_check_p T
    ON S.matcode = T.matcode COLLATE Thai_CI_AS
  WHERE T.matcode IS NULL
     OR S.last_update > T.last_update;
      `);
    }

  // Sync BOM Data ไปยัง Local Machine
  async syncBOMToLocalMachine(machineConfig) {
    const pool = await sql.connect(this.centralConfig);
    try {
      await pool.request()
        .input('TargetServer', sql.NVarChar, machineConfig.host)
        .input('TargetDatabase', sql.NVarChar, machineConfig.database)
        .query('EXEC dbo.usp_SyncCheckPToTarget @TargetServer, @TargetDatabase');
      return { success: true, message: 'Triggered central stored procedure (30-min window).' };
    } finally {
      await pool.close();
    }
  }

  async syncCheckPViaCentralSP(target) {
    const pool = await sql.connect(this.centralConfig);
    try {
      const res = await pool.request()
        .input('TargetServer', sql.NVarChar, target.host)
        .input('TargetDatabase', sql.NVarChar, target.database)
        .query('EXEC dbo.usp_SyncCheckPToTarget @TargetServer, @TargetDatabase;');
      return { success: true, rowsAffected: res.rowsAffected || [] };
    } finally {
      await pool.close();
    }
  }

  // Sync BOM สำหรับ Plates
  async syncBOMForPlates(transaction, centralData, machineConfig) {
    // ลบข้อมูลเก่าทั้งหมด
    const deleteQuery = `DELETE FROM tbl_check_p`;
    await transaction.request().query(deleteQuery);
    console.log(`🗑️ Deleted old BOM data from ${machineConfig.name}`);

    // กรองข้อมูลเฉพาะ PLM, PLC, PLI, PLF
    const filteredData = centralData.filter(record => 
      ['PLM', 'PLC', 'PLI', 'PLF'].includes(record.matgroup)
    );

    console.log(`📊 Filtered ${filteredData.length} Plates records`);

    // เพิ่มข้อมูลใหม่
    for (const record of filteredData) {
      const insertQuery = `
        INSERT INTO tbl_check_p (
          matcode, length, size, qty, matgroup, minweight, maxweight, 
          mintisweight, maxtisweight, remark, internal_size
        ) VALUES (
          @matcode, @length, @size, @qty, @matgroup, @minweight, @maxweight,
          @mintisweight, @maxtisweight, @remark, @internal_size
        )
      `;

      await transaction.request()
        .input('matcode', sql.VarChar, record.matcode)
        .input('length', sql.Decimal(18,4), record.length)
        .input('size', sql.VarChar, record.size)
        .input('qty', sql.Decimal(18,4), record.qty)
        .input('matgroup', sql.VarChar, record.matgroup)
        .input('minweight', sql.Decimal(18,4), record.minweight)
        .input('maxweight', sql.Decimal(18,4), record.maxweight)
        .input('mintisweight', sql.Decimal(18,4), record.mintisweight)
        .input('maxtisweight', sql.Decimal(18,4), record.maxtisweight)
        .input('remark', sql.VarChar, record.remark)
        .input('internal_size', sql.VarChar, record.internal_size)
        .query(insertQuery);
    }
  }

  // Sync BOM สำหรับเครื่องอื่นๆ
	// Sync BOM สำหรับเครื่องอื่นๆ
	async syncBOMForOtherMachines(transaction, centralData, machineConfig) {
		for (let i = 0; i < centralData.length; i++) {
			const record = centralData[i];
			if (i % 500 === 0) {
				console.log(`⏱️ ${machineConfig.name}: processing ${i}/${centralData.length}`);
			}
			const checkQuery = `
				SELECT COUNT(*) AS cnt, MAX(last_update) AS last_update
				FROM tbl_check_p 
				WHERE matcode = @matcode
			`;
	
			const checkResult = await transaction.request()
				.input('matcode', sql.VarChar, record.matcode)
				.query(checkQuery);
	
			const cnt = checkResult.recordset[0]?.cnt || 0;
			const existingLastUpdate = checkResult.recordset[0]?.last_update;
	
			const needsReplace = cnt > 0 && existingLastUpdate && record.last_update && record.last_update > existingLastUpdate;
	
			if (needsReplace) {
				await transaction.request()
					.input('matcode', sql.VarChar, record.matcode)
					.query(`DELETE FROM tbl_check_p WHERE matcode = @matcode`);
			}
	
			if (cnt === 0 || needsReplace) {
				const insertQuery = `
					INSERT INTO tbl_check_p (
						matcode, length, size, qty, matgroup, minweight, maxweight,
						mintisweight, maxtisweight, remark, internal_size, last_update,
						color, speed, table_weight, sap_description, actual_thickness, cIn, cOut
					) VALUES (
						@matcode, @length, @size, @qty, @matgroup, @minweight, @maxweight,
						@mintisweight, @maxtisweight, @remark, @internal_size, @last_update,
						@color, @speed, @table_weight, @sap_description, @actual_thickness, @cIn, @cOut
					)
				`;
	
				await transaction.request()
					.input('matcode', sql.VarChar, record.matcode)
					.input('length', sql.Decimal(18,4), record.length)
					.input('size', sql.VarChar, record.size)
					.input('qty', sql.Decimal(18,4), record.qty)
					.input('matgroup', sql.VarChar, record.matgroup)
					.input('minweight', sql.Decimal(18,4), record.minweight)
					.input('maxweight', sql.Decimal(18,4), record.maxweight)
					.input('mintisweight', sql.Decimal(18,4), record.mintisweight)
					.input('maxtisweight', sql.Decimal(18,4), record.maxtisweight)
					.input('remark', sql.VarChar, record.remark)
					.input('internal_size', sql.VarChar, record.internal_size)
					.input('last_update', sql.DateTime, record.last_update)
					.input('color', sql.VarChar, record.color)
					.input('speed', sql.Decimal(18,4), record.speed)
					.input('table_weight', sql.Decimal(18,4), record.table_weight)
					.input('sap_description', sql.VarChar, record.sap_description)
					.input('actual_thickness', sql.Decimal(18,4), record.actual_thickness)
					.input('cIn', sql.Decimal(18,4), record.cIn)
					.input('cOut', sql.Decimal(18,4), record.cOut)
					.query(insertQuery);
			}
		}
		console.log(`✅ ${machineConfig.name}: done ${centralData.length} rows`);
	}

  // Sync BOM ไปยังทุกเครื่อง
  async syncBOMToAllMachines() {
    console.log('🔄 Starting BOM sync to all machines...');
    
    const machines = getAllDbConfigs();
    const results = {};

    for (const machine of machines) {
      try {
        const result = await this.syncBOMToLocalMachine(machine);
        results[machine.name] = {
          success: true,
          ...result
        };
        console.log(`✅ ${machine.name}: ${result.message}`);
      } catch (error) {
        results[machine.name] = {
          success: false,
          error: error.message
        };
        console.error(`❌ ${machine.name}: ${error.message}`);
      }
    }

    this.lastSyncTime = new Date();
    return results;
  }

  // ตรวจสอบสถานะการ sync
  async getSyncStatus() {
    const machines = getAllDbConfigs();
    const status = {};

    for (const machine of machines) {
      try {
        const isOnline = await this.checkMachineOnline(machine);
        status[machine.name] = {
          online: isOnline,
          lastSync: this.lastSyncTime,
          status: isOnline ? 'ONLINE' : 'OFFLINE'
        };
      } catch (error) {
        status[machine.name] = {
          online: false,
          error: error.message,
          status: 'ERROR'
        };
      }
    }

    return status;
  }

  // ตรวจสอบการเชื่อมต่อเครื่อง
  async checkMachineOnline(machineConfig) {
    const config = {
      server: machineConfig.host,
      database: machineConfig.database,
      user: machineConfig.user,
      password: machineConfig.password,
      options: {
        encrypt: false,
        trustServerCertificate: true
      },
      connectionTimeout: 5000,
      requestTimeout: 5000
    };

    try {
      const pool = await sql.connect(config);
      await pool.close();
      return true;
    } catch (error) {
      return false;
    }
  }

  // ดึงเวลาที่ sync ล่าสุด
  getLastSyncTime() {
    const time = new Date(this.lastSyncTime);
    time.setMinutes(time.getMinutes() - 30); // 30 นาทีที่แล้ว
    return time;
  }
}
