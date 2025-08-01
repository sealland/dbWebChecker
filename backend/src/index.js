import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import apiRouter from './api.js';

const app = express();
const PORT = process.env.PORT || 4001; // เปลี่ยนจาก 4000 เป็น 4001

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:3001',
    'http://localhost:4000',
    'http://localhost:4001', // เพิ่ม port ใหม่
    'https://whs.zubbsteel.com',
    'http://192.168.132.7:3000',
    'http://192.168.132.7:3001',
    'http://192.168.132.7:4000',
    'http://192.168.132.7:4001' // เพิ่ม port ใหม่
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.send('DB Web Checker Backend API');
});

// TODO: เพิ่ม API สำหรับเช็คสถานะ, ดึงข้อมูล, export Excel

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 