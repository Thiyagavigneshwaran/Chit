import express from 'express';
import { authenticateJWT, authorizeRoles } from './auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { recalculateCustomerStatus } from '../utils/statusHelper.js';
import { sendCustomerReminderEmail } from '../utils/reminderHelper.js';

const router = express.Router();

// Get all customers for the active tenant
router.get('/', authenticateJWT, resolveTenant, async (req, res) => {
  try {
    const tenantDb = req.db;
    const [customers] = await tenantDb.query('SELECT * FROM customers');
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get customer profile by ID (showing Mobile, Email, Total Chits, Paid, and Pending)
router.get('/:id', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const tenantDb = req.db;
  try {
    const [customerRows] = await tenantDb.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    const customer = customerRows[0];

    // Fetch joined chit groups
    const [joinedChits] = await tenantDb.query(`
      SELECT cc.joined_date, cg.id, cg.name, cg.value, cg.monthly_contribution, cg.installments 
      FROM customer_chits cc
      JOIN chit_groups cg ON cc.chit_group_id = cg.id
      WHERE cc.customer_id = ?
    `, [id]);

    // Fetch payment history (collections made by customer)
    const [paymentHistory] = await tenantDb.query(`
      SELECT * FROM collections 
      WHERE customer_id = ? 
      ORDER BY payment_date DESC
    `, [id]);

    // Fetch payouts history (payments paid to customer)
    const [payoutHistory] = await tenantDb.query(`
      SELECT * FROM payments 
      WHERE customer_id = ? 
      ORDER BY payment_date DESC
    `, [id]);

    // Fetch auction history details
    const [auctionHistory] = await tenantDb.query(`
      SELECT a.*, cg.name as chit_group_name, 
             IF(a.winning_bidder_id = ?, 'Yes', 'No') as won
      FROM auctions a
      JOIN chit_groups cg ON a.chit_group_id = cg.id
      WHERE a.chit_group_id IN (
        SELECT chit_group_id FROM customer_chits WHERE customer_id = ?
      )
      ORDER BY a.auction_date DESC
    `, [id, id]);

    res.json({
      profile: customer,
      chits: joinedChits,
      payments: paymentHistory,
      payouts: payoutHistory,
      auctions: auctionHistory
    });
  } catch (error) {
    console.error('Error fetching customer profile:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update customer details (only Super Admin, Manager, Accountant can edit)
router.put('/:id', authenticateJWT, resolveTenant, authorizeRoles('Super Admin', 'Manager', 'Accountant'), async (req, res) => {
  const { id } = req.params;
  const { name, email, mobile, status } = req.body;
  const tenantDb = req.db;

  if (!name || !email || !mobile) {
    return res.status(400).json({ message: 'Name, Email and Mobile are required' });
  }

  try {
    const [customerRows] = await tenantDb.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Verify if Email or Mobile is registered to another customer
    const [existingEmail] = await tenantDb.query('SELECT * FROM customers WHERE email = ? AND id != ?', [email, id]);
    if (existingEmail.length > 0) {
      return res.status(400).json({ message: 'A customer with this email is already registered.' });
    }

    const [existingMobile] = await tenantDb.query('SELECT * FROM customers WHERE mobile = ? AND id != ?', [mobile, id]);
    if (existingMobile.length > 0) {
      return res.status(400).json({ message: 'A customer with this mobile number is already registered.' });
    }

    const customer = customerRows[0];

    await tenantDb.query(
      'UPDATE customers SET name = ?, email = ?, mobile = ?, status = ? WHERE id = ?',
      [name, email, mobile, status || customer.status, id]
    );

    const [updatedRows] = await tenantDb.query('SELECT * FROM customers WHERE id = ?', [id]);
    res.json({ message: 'Customer updated successfully', customer: updatedRows[0] });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Register a new customer & enroll them in a chit plan
router.post('/', authenticateJWT, resolveTenant, authorizeRoles('Super Admin', 'Manager', 'Collection Agent'), async (req, res) => {
  const { name, email, mobile, chitGroupId } = req.body;
  const tenantDb = req.db;

  if (!name || !email || !mobile || !chitGroupId) {
    return res.status(400).json({ message: 'All fields are required (Name, Email, Mobile, Chit Group)' });
  }

  try {
    // 1. Verify Chit Group exists
    const [groupRows] = await tenantDb.query('SELECT * FROM chit_groups WHERE id = ?', [chitGroupId]);
    if (groupRows.length === 0) {
      return res.status(404).json({ message: 'Chit Group not found' });
    }
    const group = groupRows[0];
    const monthlyContribution = parseFloat(group.monthly_contribution);

    // Verify if Email or Mobile is already registered
    const [existingEmail] = await tenantDb.query('SELECT * FROM customers WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(400).json({ message: 'A customer with this email is already registered.' });
    }

    const [existingMobile] = await tenantDb.query('SELECT * FROM customers WHERE mobile = ?', [mobile]);
    if (existingMobile.length > 0) {
      return res.status(400).json({ message: 'A customer with this mobile number is already registered.' });
    }

    // 2. Insert customer details
    const [insertResult] = await tenantDb.query(
      'INSERT INTO customers (name, email, mobile, total_chits, paid_amount, pending_amount, status) VALUES (?, ?, ?, 1, 0.00, 0.00, "Pending")',
      [name, email, mobile]
    );
    const customerId = insertResult.insertId;

    // 3. Create the customer-chit link
    const joinedDate = new Date().toISOString().split('T')[0];
    await tenantDb.query(
      'INSERT INTO customer_chits (customer_id, chit_group_id, joined_date) VALUES (?, ?, ?)',
      [customerId, chitGroupId, joinedDate]
    );

    // Recalculate customer's actual schedule dues
    await recalculateCustomerStatus(tenantDb, customerId);

    // 4. Update the chit group active members count
    await tenantDb.query(
      'UPDATE chit_groups SET active_members = active_members + 1 WHERE id = ?',
      [chitGroupId]
    );

    // 5. SMTP Email Dispatch Simulation
    const subject = `Welcome to FinCore Chit Funds - Scheme Enrollment`;
    const emailBody = `Dear ${name},\n\nWelcome to FinCore Chit Funds! You have successfully registered and enrolled in the Chit Plan '${group.name}' (${chitGroupId}).\n\nYour monthly installment contribution is INR ${monthlyContribution.toLocaleString('en-IN')}.\n\nThank you for choosing us.\n\nFinCore Security and Accounting System`;
    
    console.log('\n==================================================');
    console.log('SIMULATING OUTBOUND WELCOME EMAIL (SMTP TRANSMISSION):');
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log('--------------------------------------------------');
    console.log(emailBody);
    console.log('==================================================\n');

    // 6. Log email registration in system notifications log
    const notificationMsg = `Customer ${name} successfully registered. Outbound welcome email template compiled and dispatched to ${email}. Subscribed Group: ${chitGroupId}.`;
    await tenantDb.query(
      'INSERT INTO notifications (title, message, is_read, type) VALUES (?, ?, FALSE, "success")',
      [`Customer Registered: ${name}`, notificationMsg]
    );

    res.status(201).json({
      message: 'Customer registered and enrolled in chit plan successfully!',
      customerId
    });
  } catch (error) {
    console.error('Error registering customer:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Toggle auto-reminder setting for a customer
router.patch('/:id/auto-reminder', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const { autoReminder } = req.body;
  const tenantDb = req.db;

  try {
    const [customerRows] = await tenantDb.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await tenantDb.query(
      'UPDATE customers SET auto_reminder = ? WHERE id = ?',
      [autoReminder ? 1 : 0, id]
    );

    res.json({ message: `Auto email reminders ${autoReminder ? 'enabled' : 'disabled'} successfully.` });
  } catch (error) {
    console.error('Error toggling auto-reminder setting:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Send a manual due reminder email to a customer
router.post('/:id/send-reminder', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const tenantDb = req.db;

  try {
    const mailRes = await sendCustomerReminderEmail(tenantDb, id);
    if (mailRes.success) {
      res.json({ message: 'Reminder email successfully dispatched!' });
    } else {
      res.status(500).json({ message: mailRes.error || 'Failed to dispatch email reminder.' });
    }
  } catch (error) {
    console.error('Error sending customer due reminder email:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
