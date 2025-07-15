# ระบบตรวจสอบสถานะฐานข้อมูลและสร้างรายงาน (Database Status Checker and Report Generator)

## โครงสร้างโปรเจกต์

- `db_instances.config.json` : ไฟล์ config รายชื่อ SQL Server และ mapping สำหรับ PDF
- `backend/` : โค้ดฝั่งเซิร์ฟเวอร์ (Node.js + Express + TypeORM)
- `frontend/` : โค้ดฝั่งผู้ใช้ (React + Material UI)

## แนวทางการใช้งาน

1. **Backend**
   - ให้บริการ REST API สำหรับเช็คสถานะฐานข้อมูล, ดึงข้อมูล view, export Excel
   - เชื่อมต่อ SQL Server ตาม config
   - มี pagination และ error handling

2. **Frontend**
   - แสดงรายชื่อฐานข้อมูลพร้อมสถานะ (ออนไลน์/ออฟไลน์)
   - เลือกเครื่อง, เดือน, ปี เพื่อดึงข้อมูล
   - แสดงข้อมูลแบบแบ่งหน้า (20 รายการ/หน้า)
   - Export ข้อมูลเป็น Excel
   - เปิด PDF report ผ่านลิงก์ tcpdf

## การตั้งค่า

- แก้ไขไฟล์ `db_instances.config.json` เพื่อเพิ่ม/ลบ/แก้ไขเครื่อง SQL Server
- รหัสผ่านและ user สามารถแก้ได้ในไฟล์นี้

## หมายเหตุ
- ระบบนี้ไม่ต้องมี Authen ในตัวเอง (รับ currentUser จาก web หลักผ่าน query string)
- UI เป็นภาษาไทย
- สามารถ deploy backend ใน server บริษัทได้ 