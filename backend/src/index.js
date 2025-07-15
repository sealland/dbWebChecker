import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import apiRouter from './api.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());
app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.send('DB Web Checker Backend API');
});

// TODO: เพิ่ม API สำหรับเช็คสถานะ, ดึงข้อมูล, export Excel

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 