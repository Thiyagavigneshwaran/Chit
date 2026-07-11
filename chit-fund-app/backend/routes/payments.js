import express from 'express';
import { authenticateJWT } from './auth.js';
import { resolveTenant } from '../middleware/tenant.js';

const router = express.Router();

// Get all payouts for active tenant
router.get('/', authenticateJWT, resolveTenant, async (req, res) => {
  try {
    const tenantDb = req.db;
    const [payments] = await tenantDb.query('SELECT * FROM payments ORDER BY payment_date DESC');
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Record a manual payout entry
router.post('/', authenticateJWT, resolveTenant, async (req, res) => {
  const { customerId, chitGroupId, amount, paymentMethod, transactionRef, type } = req.body;
  const tenantDb = req.db;

  if (!customerId || !chitGroupId || !amount || !paymentMethod || !transactionRef) {
    return res.status(400).json({ message: 'All fields are required (Customer, Group, Amount, Method, Ref)' });
  }

  try {
    // 1. Fetch Customer details
    const [customerRows] = await tenantDb.query('SELECT name FROM customers WHERE id = ?', [customerId]);
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    const customer = customerRows[0];

    // 2. Fetch Group details
    const [groupRows] = await tenantDb.query('SELECT id FROM chit_groups WHERE id = ?', [chitGroupId]);
    if (groupRows.length === 0) {
      return res.status(404).json({ message: 'Chit Group not found' });
    }

    const paymentDate = new Date().toISOString().split('T')[0];

    // 3. Insert Payment payout
    const [result] = await tenantDb.query(
      'INSERT INTO payments (customer_id, customer_name, chit_group_id, amount, payment_date, payment_method, transaction_ref, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [customerId, customer.name, chitGroupId, amount, paymentDate, paymentMethod, transactionRef, type || 'Chit Payout']
    );

    res.status(201).json({
      message: 'Payout logged successfully',
      payment: {
        id: result.insertId,
        customerName: customer.name,
        chitGroupId,
        amount,
        paymentDate,
        paymentMethod,
        transactionRef,
        type: type || 'Chit Payout'
      }
    });
  } catch (error) {
    console.error('Error adding payment payout:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
