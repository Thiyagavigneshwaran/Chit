import express from 'express';
import { authenticateJWT, authorizeRoles } from './auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { recalculateCustomerStatus } from '../utils/statusHelper.js';

const router = express.Router();

// Get all collections for active tenant
router.get('/', authenticateJWT, resolveTenant, async (req, res) => {
  try {
    const tenantDb = req.db;
    const [collections] = await tenantDb.query('SELECT * FROM collections ORDER BY payment_date DESC');
    res.json(collections);
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Create a new collection entry for active tenant
router.post('/', authenticateJWT, resolveTenant, authorizeRoles('Super Admin', 'Manager', 'Collection Agent'), async (req, res) => {
  const { customerId, chitGroupId, amount, paymentMethod, paymentDate } = req.body;
  const tenantDb = req.db;

  if (!customerId || !chitGroupId || !amount || !paymentMethod) {
    return res.status(400).json({ message: 'All fields are required (Customer, Chit Group, Amount, Payment Method)' });
  }

  try {
    // 1. Verify customer and group
    const [customerRows] = await tenantDb.query('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    const customer = customerRows[0];

    const [groupRows] = await tenantDb.query('SELECT * FROM chit_groups WHERE id = ?', [chitGroupId]);
    if (groupRows.length === 0) {
      return res.status(404).json({ message: 'Chit Group not found' });
    }

    // 2. Generate custom receipt number
    const [countRows] = await tenantDb.query('SELECT COUNT(*) as count FROM collections');
    const seq = String(countRows[0].count + 1).padStart(3, '0');
    const year = new Date().getFullYear();
    const receiptNo = `REC-${year}-${seq}`;
    const collectionDate = paymentDate || new Date().toISOString().split('T')[0];

    // 3. Insert collection entry
    const collectedBy = req.user.name || req.user.username;
    await tenantDb.query(
      'INSERT INTO collections (customer_id, customer_name, chit_group_id, amount, payment_method, payment_date, receipt_no, collected_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [customerId, customer.name, chitGroupId, amount, paymentMethod, collectionDate, receiptNo, collectedBy]
    );

    // 4. Recalculate customer paid, pending and status using schedule helper
    await recalculateCustomerStatus(tenantDb, customerId);

    res.status(201).json({
      message: 'Collection entry added successfully',
      collection: {
        receiptNo,
        customerName: customer.name,
        chitGroupId,
        amount,
        paymentMethod,
        paymentDate,
        collectedBy
      }
    });
  } catch (error) {
    console.error('Error adding collection entry:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
