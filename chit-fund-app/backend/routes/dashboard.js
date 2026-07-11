import express from 'express';
import { authenticateJWT } from './auth.js';
import { resolveTenant } from '../middleware/tenant.js';

const router = express.Router();

router.get('/stats', authenticateJWT, resolveTenant, async (req, res) => {
  try {
    const tenantDb = req.db;

    // 1. Fetch aggregates from tenant database
    const [groupStats] = await tenantDb.query(
      'SELECT SUM(value) as totalChitsVal, SUM(active_members) as activeMembers FROM chit_groups'
    );
    const [customerStats] = await tenantDb.query(
      'SELECT SUM(paid_amount) as totalPaid, SUM(pending_amount) as totalPending, COUNT(*) as activeMembersCount FROM customers'
    );
    const [collectionStats] = await tenantDb.query(
      'SELECT SUM(amount) as monthlyCollection FROM collections'
    );
    
    // Payment Status breakdown
    const [statusBreakdown] = await tenantDb.query(
      'SELECT status, COUNT(*) as count FROM customers GROUP BY status'
    );

    // Default calculations if DB returns null
    const totalChitsVal = parseFloat(groupStats[0].totalChitsVal) || 0.00;
    const activeMembers = parseInt(customerStats[0].activeMembersCount) || 0;
    const monthlyCollection = parseFloat(collectionStats[0].monthlyCollection) || 0.00;
    const pendingDues = parseFloat(customerStats[0].totalPending) || 0.00;

    // Build line chart analytics based on actual collections
    const [monthlyAgg] = await tenantDb.query(
      `SELECT DATE_FORMAT(payment_date, '%b') as month, SUM(amount) as amount 
       FROM collections 
       GROUP BY DATE_FORMAT(payment_date, '%b'), MONTH(payment_date)
       ORDER BY MONTH(payment_date) ASC`
    );

    const baseMonths = {
      'Jan': 0,
      'Feb': 0,
      'Mar': 0,
      'Apr': 0,
      'May': 0,
      'Jun': 0
    };

    // Merge actual collection data into standard monthly aggregates
    if (monthlyAgg && monthlyAgg.length > 0) {
      monthlyAgg.forEach(row => {
        if (baseMonths[row.month] !== undefined) {
          baseMonths[row.month] = parseFloat(row.amount);
        }
      });
    }

    const collectionAnalytics = Object.keys(baseMonths).map(month => ({
      month,
      amount: baseMonths[month]
    }));

    // Calculate percentage breakdown for Payment Status Pie Chart
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let totalStatusCount = 0;

    statusBreakdown.forEach(row => {
      totalStatusCount += row.count;
      if (row.status.toLowerCase() === 'paid') paidCount = row.count;
      else if (row.status.toLowerCase() === 'pending') pendingCount = row.count;
      else if (row.status.toLowerCase() === 'overdue') overdueCount = row.count;
    });

    const paymentStatus = [
      { 
        name: 'Paid', 
        value: totalStatusCount > 0 ? Math.round((paidCount / totalStatusCount) * 100) : 0, 
        color: '#10B981' 
      },
      { 
        name: 'Pending', 
        value: totalStatusCount > 0 ? Math.round((pendingCount / totalStatusCount) * 100) : 0, 
        color: '#F59E0B' 
      },
      { 
        name: 'Overdue', 
        value: totalStatusCount > 0 ? Math.round((overdueCount / totalStatusCount) * 100) : 0, 
        color: '#EF4444' 
      }
    ];

    res.json({
      cards: {
        totalChits: totalChitsVal,
        activeMembers: activeMembers,
        monthlyCollection: monthlyCollection,
        pendingDues: pendingDues,
      },
      collectionAnalytics,
      paymentStatus
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
