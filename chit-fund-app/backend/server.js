import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import customerRoutes from './routes/customers.js';
import chitRoutes from './routes/chits.js';
import collectionRoutes from './routes/collections.js';
import auctionRoutes from './routes/auctions.js';
import paymentRoutes from './routes/payments.js';
import notificationRoutes from './routes/notifications.js';
import financeRoutes from './routes/finance.js';
import backupRoutes from './routes/backup.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Routes setup
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/chits', chitRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/backup', backupRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize database connection and boot server
const startServer = async () => {
  try {
    // Attempt schema checks and seed default datasets in MySQL
    await initDb();
    
    app.listen(PORT, () => {
      console.log(`Chit Fund Backend Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
