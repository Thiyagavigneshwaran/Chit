import express from 'express';
import { authenticateJWT } from './auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { triggerAutoRemindersForGroup } from '../utils/reminderHelper.js';

const router = express.Router();

// Get all auctions for active tenant
router.get('/', authenticateJWT, resolveTenant, async (req, res) => {
  try {
    const tenantDb = req.db;
    const [auctions] = await tenantDb.query('SELECT * FROM auctions ORDER BY auction_date DESC');
    res.json(auctions);
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Record a new auction entry
router.post('/', authenticateJWT, resolveTenant, async (req, res) => {
  const { chitGroupId, installmentNo, winningBidderId, bidAmount } = req.body;
  const tenantDb = req.db;

  if (!chitGroupId || !installmentNo || !winningBidderId || !bidAmount) {
    return res.status(400).json({ message: 'All fields are required (Group, Installment No, Winner, Bid Amount)' });
  }

  try {
    // 1. Fetch Group Details
    const [groupRows] = await tenantDb.query('SELECT * FROM chit_groups WHERE id = ?', [chitGroupId]);
    if (groupRows.length === 0) {
      return res.status(404).json({ message: 'Chit Group not found' });
    }
    const group = groupRows[0];

    // 2. Fetch Customer Details
    const [customerRows] = await tenantDb.query('SELECT * FROM customers WHERE id = ?', [winningBidderId]);
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Winning bidder customer not found' });
    }
    const customer = customerRows[0];

    // 3. Perform Calculations
    const totalMembers = group.active_members || group.installments;
    const dividendAmount = parseFloat(bidAmount) / totalMembers;
    const payoutAmount = parseFloat(group.value) - parseFloat(bidAmount);
    const auctionDate = new Date().toISOString().split('T')[0];

    // 4. Save Auction Record
    const [auctionResult] = await tenantDb.query(
      'INSERT INTO auctions (chit_group_id, installment_no, auction_date, winning_bidder_id, winning_bidder_name, bid_amount, dividend_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [chitGroupId, installmentNo, auctionDate, winningBidderId, customer.name, bidAmount, dividendAmount, 'Completed']
    );

    // 5. Generate Payout Record automatically in payments table
    const transactionRef = `TXN-AUC-${Date.now()}`;
    await tenantDb.query(
      'INSERT INTO payments (customer_id, customer_name, chit_group_id, amount, payment_date, payment_method, transaction_ref, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [winningBidderId, customer.name, chitGroupId, payoutAmount, auctionDate, 'Bank Transfer', transactionRef, 'Chit Payout']
    );

    // 6. Create notifications dynamically
    await tenantDb.query(
      'INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)',
      [
        `Auction Cleared: ${chitGroupId}`,
        `${customer.name} won installment #${installmentNo} with a bid discount of ${bidAmount} INR. Dividend of ${dividendAmount.toFixed(2)} INR distributed.`,
        'success'
      ]
    );

    // 7. Trigger automated reminders asynchronously (non-blocking)
    triggerAutoRemindersForGroup(tenantDb, chitGroupId).catch(err => {
      console.error('Error triggering auto reminders:', err.message);
    });

    res.status(201).json({
      message: 'Auction logged and payout generated successfully',
      auction: {
        id: auctionResult.insertId,
        chitGroupId,
        installmentNo,
        auctionDate,
        winningBidderName: customer.name,
        bidAmount,
        dividendAmount,
        payoutAmount
      }
    });
  } catch (error) {
    console.error('Error logging auction:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
