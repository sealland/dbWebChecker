import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import apiRouter from './api.js';
import authRoutes from './routes/auth.js'; // เปลี่ยนจาก require เป็น import
import locationsRoutes from './routes/locations.js';
import slitPlanRoutes from './routes/slitPlan.js';
import rmListRoutes from './routes/rmList.js';

const app = express();
const PORT = process.env.PORT || 4001;

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:3001',
    'http://localhost:4000',
    'http://localhost:4001',
    'https://whs.zubbsteel.com',
    'http://192.168.132.7:3000',
    'http://192.168.132.7:3001',
    'http://192.168.132.7:4000',
    'http://192.168.132.7:4001'
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
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/slit-plan', slitPlanRoutes);
app.use('/api/rm-list', rmListRoutes);

app.get('/', (req, res) => {
  res.send('DB Web Checker Backend API');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 