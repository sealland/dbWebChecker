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
        trustServerCertificate: true
      }
    };
    this.lastSyncTime = new Date();
  }

  // ดึงข้อมูล BOM จาก Central Database
  async getBOMDataFromCentral() {
    const pool = await sql.connect(this.centralConfig);
    
    try {
      const query = `
        SELECT 
          matcode,
          length,
          size,
          qty,
          matgroup,
          minweight,
          maxweight,
          mintisweight,
          maxtisweight,
          remark,
          internal_size,
          last_update,
          color,
          speed,
          table_weight,
          sap_description,
          actual_thickness,
          cIn,
          cOut
        FROM tbl_check_p
        WHERE last_update >= @lastSync
      `;

      const result = await pool.request()
        .input('lastSync', sql.DateTime, this.getLastSyncTime())
        .query(query);

      return result.recordset;
    } finally {
      await pool.close();
    }
  }

  // Sync BOM Data ไปยัง Local Machine
  async syncBOMToLocalMachine(machineConfig) {
    console.log(`🔄 Syncing BOM data to ${machineConfig.name}...`);
    
    const localConfig = {
      server: machineConfig.host,
      database: machineConfig.database,
      user: machineConfig.user,
      password: machineConfig.password,
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    };

    const pool = await sql.connect(localConfig);
    
    try {
      // เริ่ม transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      // ดึงข้อมูลจาก Central Database
      const centralData = await this.getBOMDataFromCentral();
      console.log(`📊 Found ${centralData.length} BOM records to sync`);

      if (centralData.length === 0) {
        console.log('ℹ️ No new BOM data to sync');
        await transaction.commit();
        return { synced: 0, message: 'No new data to sync' };
      }

      // ตรวจสอบว่าเป็น Plates หรือไม่
      const isPlates = machineConfig.name.includes('ตัดแผ่น');
      
      if (isPlates) {
        // สำหรับ Plates - ใช้ logic พิเศษ
        await this.syncBOMForPlates(transaction, centralData, machineConfig);
      } else {
        // สำหรับเครื่องอื่นๆ - ใช้ logic ปกติ
        await this.syncBOMForOtherMachines(transaction, centralData, machineConfig);
      }

      await transaction.commit();
      console.log(`✅ Successfully synced BOM data to ${machineConfig.name}`);
      
      return { 
        synced: centralData.length, 
        message: `Synced ${centralData.length} BOM records to ${machineConfig.name}` 
      };
      
    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Failed to sync BOM to ${machineConfig.name}:`, error);
      throw error;
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
  async syncBOMForOtherMachines(transaction, centralData, machineConfig) {
    for (const record of centralData) {
      // ตรวจสอบว่าข้อมูลมีอยู่แล้วหรือไม่
      const checkQuery = `
        SELECT COUNT(*) as count, last_update
        FROM tbl_check_p 
        WHERE matcode = @matcode
      `;

      const checkResult = await transaction.request()
        .input('matcode', sql.VarChar, record.matcode)
        .query(checkQuery);

      const existingRecord = checkResult.recordset[0];
      const existingLastUpdate = existingRecord.last_update;

      if (existingRecord.count > 0 && existingLastUpdate >= record.last_update) {
        // ข้อมูลมีอยู่แล้วและไม่ใหม่กว่า
        continue;
      }

      if (existingRecord.count > 0) {
        // อัพเดทข้อมูลที่มีอยู่
        const updateQuery = `
          UPDATE tbl_check_p 
          SET 
            length = @length,
            size = @size,
            qty = @qty,
            matgroup = @matgroup,
            minweight = @minweight,
            maxweight = @maxweight,
            mintisweight = @mintisweight,
            maxtisweight = @maxtisweight,
            remark = @remark,
            internal_size = @internal_size,
            last_update = @last_update,
            color = @color,
            speed = @speed,
            table_weight = @table_weight,
            sap_description = @sap_description,
            actual_thickness = @actual_thickness,
            cIn = @cIn,
            cOut = @cOut
          WHERE matcode = @matcode
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
          .query(updateQuery);
      } else {
        // เพิ่มข้อมูลใหม่
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
