# การตั้งค่า Git และ .gitignore สำหรับ Feature ใหม่

## โครงสร้างไฟล์ .gitignore

### 1. Root .gitignore
ไฟล์หลักที่ครอบคลุมทั้งโปรเจกต์:
- `node_modules/` - Dependencies
- `*.log` - Log files
- `*.xlsx`, `*.xls`, `*.csv` - Export files
- `API_COMPARE_README.md` - API Documentation
- `*.bak`, `*.sql` - Database backup files
- `api-logs/`, `backend/logs/` - API logs

### 2. Backend .gitignore
เฉพาะสำหรับ backend:
- Environment variables (`.env*`)
- Database files (`*.db`, `*.sqlite`)
- Runtime data (`pids/`, `*.pid`)
- Coverage files (`coverage/`, `.nyc_output`)

### 3. Instance-dashboard .gitignore
เฉพาะสำหรับ React frontend:
- Build files (`/build`)
- Development environment files
- Cache files (`.cache/`, `api-cache/`)
- IDE files (`.vscode/`, `.idea/`)

## การตั้งค่า Git

### 1. เริ่มต้น Git Repository
```bash
# ถ้ายังไม่มี Git repository
git init

# เพิ่ม remote origin (ถ้ามี)
git remote add origin <repository-url>
```

### 2. เพิ่มไฟล์ที่จำเป็น
```bash
# เพิ่มไฟล์ทั้งหมด
git add .

# หรือเพิ่มเฉพาะไฟล์ที่ต้องการ
git add backend/src/
git add instance-dashboard/src/
git add .gitignore
git add README.md
```

### 3. Commit การเปลี่ยนแปลง
```bash
# Commit feature ใหม่
git commit -m "feat: เพิ่ม API สำหรับการเปรียบเทียบข้อมูลและการอัพเดต

- เพิ่มฟังก์ชัน queryStationData, queryPlanningData, updateProductionPlan
- เพิ่ม API endpoints: /api/compare/station, /api/compare/planning, /api/compare/both, /api/compare/update
- อัพเดต Frontend ให้ใช้ API จริงแทน mock data
- เพิ่มปุ่มอัพเดตและสถานะการโหลด
- อัพเดต .gitignore สำหรับ feature ใหม่"
```

### 4. Push ไปยัง Remote
```bash
# Push ไปยัง main branch
git push origin main

# หรือสร้าง branch ใหม่
git checkout -b feature/compare-api
git push origin feature/compare-api
```

## ไฟล์ที่ควรถูก Ignore

### ไฟล์ที่ละเอียดอ่อน (Sensitive Files)
- `db_instances.config.json` - ไฟล์ config ที่มี password
- `.env*` - Environment variables
- `*.log` - Log files ที่อาจมีข้อมูลละเอียดอ่อน

### ไฟล์ชั่วคราว (Temporary Files)
- `*.tmp`, `*.temp` - Temporary files
- `.cache/`, `api-cache/` - Cache files
- `node_modules/` - Dependencies

### ไฟล์ Build (Build Files)
- `/build/`, `/dist/` - Build output
- `*.xlsx`, `*.xls`, `*.csv` - Export files

## การจัดการ Config Files

### 1. ไฟล์ Config ที่ละเอียดอ่อน
```bash
# สร้างไฟล์ config template
cp db_instances.config.json db_instances.config.json.template

# แก้ไข template ให้ไม่มีข้อมูลจริง
# แล้ว commit template
git add db_instances.config.json.template
git commit -m "docs: เพิ่ม config template"
```

### 2. Environment Variables
```bash
# สร้างไฟล์ .env.example
cp .env .env.example

# แก้ไข .env.example ให้ไม่มีข้อมูลจริง
# แล้ว commit example
git add .env.example
git commit -m "docs: เพิ่ม environment variables example"
```

## การตรวจสอบ .gitignore

### 1. ตรวจสอบไฟล์ที่ถูก ignore
```bash
# ดูไฟล์ที่ถูก ignore
git status --ignored

# ดูไฟล์ที่จะถูก add
git add -n .
```

### 2. ตรวจสอบไฟล์ที่สำคัญ
```bash
# ตรวจสอบว่าไฟล์สำคัญไม่ถูก ignore
git check-ignore -v db_instances.config.json
git check-ignore -v backend/src/api.js
git check-ignore -v instance-dashboard/src/App.js
```

## การแก้ไข .gitignore

### 1. ถ้าต้องการ ignore ไฟล์ที่เคย commit แล้ว
```bash
# เพิ่มไฟล์ใน .gitignore
echo "file-to-ignore.txt" >> .gitignore

# ลบไฟล์ออกจาก Git (แต่ยังคงไฟล์ไว้ในระบบ)
git rm --cached file-to-ignore.txt

# Commit การเปลี่ยนแปลง
git commit -m "chore: ignore file-to-ignore.txt"
```

### 2. ถ้าต้องการ unignore ไฟล์
```bash
# ลบไฟล์ออกจาก .gitignore
# แล้ว add ไฟล์กลับเข้าไป
git add file-to-unignore.txt
git commit -m "feat: เพิ่ม file-to-unignore.txt"
```

## ข้อแนะนำ

1. **ตรวจสอบ .gitignore** ก่อน commit เสมอ
2. **ใช้ .env.example** สำหรับ environment variables
3. **ไม่ commit ข้อมูลละเอียดอ่อน** เช่น password, API keys
4. **ใช้ template files** สำหรับ config ที่มีข้อมูลจริง
5. **ตรวจสอบ log files** ว่ามีข้อมูลละเอียดอ่อนหรือไม่

## การแก้ไขปัญหา

### ถ้าไฟล์ถูก ignore โดยไม่ตั้งใจ
```bash
# Force add ไฟล์
git add -f file-that-should-not-be-ignored.txt
```

### ถ้าไฟล์ไม่ถูก ignore
```bash
# ตรวจสอบ .gitignore
git check-ignore -v file-that-should-be-ignored.txt

# แก้ไข .gitignore ถ้าจำเป็น
# แล้ว commit การเปลี่ยนแปลง
``` 