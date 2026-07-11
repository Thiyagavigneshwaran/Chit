import express from 'express';
import { authenticateJWT } from './auth.js';
import { resolveTenant } from '../middleware/tenant.js';

const router = express.Router();

// Get all loans with computed balances and repayments list
router.get('/loans', authenticateJWT, resolveTenant, async (req, res) => {
  try {
    const tenantDb = req.db;
    
    // Fetch loans
    const [loans] = await tenantDb.query(`
      SELECT l.*, c.name as customer_name, c.email, c.mobile 
      FROM loans l
      JOIN customers c ON l.customer_id = c.id
      ORDER BY l.loan_date DESC
    `);
    
    // Compute dynamic parameters for each loan
    const loansWithBalances = await Promise.all(loans.map(async (loan) => {
      const [repayments] = await tenantDb.query(
        'SELECT * FROM loan_repayments WHERE loan_id = ? ORDER BY payment_date DESC',
        [loan.id]
      );
      
      const interestPaid = repayments.reduce((sum, r) => sum + parseFloat(r.interest_paid || 0), 0);
      const principalPaid = repayments.reduce((sum, r) => sum + parseFloat(r.principal_paid || 0), 0);
      
      const principal = parseFloat(loan.principal_amount);
      const rate = parseFloat(loan.interest_rate);
      
      let elapsedDays = 0;
      let accruedInterest = 0;
      let remainingPrincipal = Math.max(0, principal - principalPaid);
      
      if (loan.status === 'Active') {
        const loanDate = new Date(loan.loan_date);
        const today = new Date();
        
        // Zero out time part for accurate days calculation
        loanDate.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        
        const diffTime = today.getTime() - loanDate.getTime();
        elapsedDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        
        let periods = 0;
        if (loan.interest_type === 'Daily') {
          periods = elapsedDays;
        } else if (loan.interest_type === 'Weekly') {
          periods = elapsedDays / 7.0;
        } else {
          // Default: Monthly
          periods = elapsedDays / 30.0;
        }
        
        accruedInterest = principal * (rate / 100) * periods;
      } else {
        // Closed loan
        accruedInterest = interestPaid; // The accrued interest is what was paid before close
        remainingPrincipal = 0;
        if (loan.closed_date) {
          const loanDate = new Date(loan.loan_date);
          const closedDate = new Date(loan.closed_date);
          loanDate.setHours(0,0,0,0);
          closedDate.setHours(0,0,0,0);
          elapsedDays = Math.max(0, Math.floor((closedDate.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24)));
        } else if (repayments.length > 0) {
          const loanDate = new Date(loan.loan_date);
          const lastRepaymentDate = new Date(repayments[0].payment_date);
          loanDate.setHours(0,0,0,0);
          lastRepaymentDate.setHours(0,0,0,0);
          elapsedDays = Math.max(0, Math.floor((lastRepaymentDate.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }
      
      const pendingInterest = Math.max(0, accruedInterest - interestPaid);
      
      return {
        ...loan,
        elapsedDays,
        accruedInterest,
        interestPaid,
        principalPaid,
        pendingInterest,
        remainingPrincipal,
        repayments
      };
    }));
    
    res.json(loansWithBalances);
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Record a new lending entry
router.post('/loans', authenticateJWT, resolveTenant, async (req, res) => {
  const { customerId, principalAmount, interestRate, interestType, loanDate, notes } = req.body;
  const tenantDb = req.db;
  
  if (!customerId || !principalAmount || !interestRate || !loanDate) {
    return res.status(400).json({ message: 'All fields are required (Customer, Principal, Rate, Date)' });
  }
  
  try {
    // Check if customer exists
    const [customerRows] = await tenantDb.query('SELECT name FROM customers WHERE id = ?', [customerId]);
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    const customer = customerRows[0];
    
    const [result] = await tenantDb.query(
      `INSERT INTO loans (customer_id, customer_name, principal_amount, interest_rate, interest_type, loan_date, status, notes) 
       VALUES (?, ?, ?, ?, ?, ?, 'Active', ?)`,
      [customerId, customer.name, principalAmount, interestRate, interestType || 'Monthly', loanDate, notes || null]
    );
    
    // Log system notification
    const formattedPrincipal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(principalAmount);
    const notificationMsg = `Lending entry created for customer ${customer.name}. Principal: ${formattedPrincipal}, Interest Rate: ${interestRate}% (${interestType || 'Monthly'}).`;
    await tenantDb.query(
      'INSERT INTO notifications (title, message, is_read, type) VALUES (?, ?, FALSE, "info")',
      [`Lending Created: ${customer.name}`, notificationMsg]
    );
    
    res.status(201).json({
      message: 'Lending entry logged successfully!',
      loanId: result.insertId
    });
  } catch (error) {
    console.error('Error creating lending entry:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Record a repayment (interest, principal, or both)
router.post('/loans/:id/repayments', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const { interestPaid, principalPaid, paymentDate, paymentMethod, transactionRef, notes } = req.body;
  const tenantDb = req.db;
  
  if (interestPaid === undefined || principalPaid === undefined || !paymentDate || !paymentMethod) {
    return res.status(400).json({ message: 'Interest paid, Principal paid, Date and Method are required.' });
  }
  
  try {
    // Fetch loan details
    const [loanRows] = await tenantDb.query('SELECT * FROM loans WHERE id = ?', [id]);
    if (loanRows.length === 0) {
      return res.status(404).json({ message: 'Loan not found' });
    }
    const loan = loanRows[0];
    
    if (loan.status === 'Closed') {
      return res.status(400).json({ message: 'Cannot record repayment on a closed loan.' });
    }
    
    const intPaidVal = parseFloat(interestPaid) || 0;
    const princPaidVal = parseFloat(principalPaid) || 0;
    const totalPaidVal = intPaidVal + princPaidVal;
    
    // Insert repayment record
    await tenantDb.query(
      `INSERT INTO loan_repayments (loan_id, interest_paid, principal_paid, total_paid, payment_date, payment_method, transaction_ref, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, intPaidVal, princPaidVal, totalPaidVal, paymentDate, paymentMethod, transactionRef || null, notes || null]
    );
    
    // Fetch all repayments so far to check if loan should be closed
    const [repayments] = await tenantDb.query('SELECT principal_paid FROM loan_repayments WHERE loan_id = ?', [id]);
    const totalPrincPaidSoFar = repayments.reduce((sum, r) => sum + parseFloat(r.principal_paid || 0), 0);
    
    const originalPrincipal = parseFloat(loan.principal_amount);
    
    if (totalPrincPaidSoFar >= originalPrincipal) {
      // Principal is fully paid! Close the loan.
      await tenantDb.query(
        "UPDATE loans SET status = 'Closed', closed_date = ? WHERE id = ?",
        [paymentDate, id]
      );
      
      const closeMsg = `Loan for ${loan.customer_name} (ID: ${loan.id}) of principal INR ${originalPrincipal.toLocaleString('en-IN')} has been fully paid and closed on ${paymentDate}.`;
      await tenantDb.query(
        'INSERT INTO notifications (title, message, is_read, type) VALUES (?, ?, FALSE, "success")',
        [`Loan Closed: ${loan.customer_name}`, closeMsg]
      );
    } else {
      const payMsg = `Repayment logged for ${loan.customer_name}'s loan (ID: ${loan.id}). Paid Interest: INR ${intPaidVal}, Paid Principal: INR ${princPaidVal}. Remaining Principal: INR ${(originalPrincipal - totalPrincPaidSoFar).toLocaleString('en-IN')}.`;
      await tenantDb.query(
        'INSERT INTO notifications (title, message, is_read, type) VALUES (?, ?, FALSE, "info")',
        [`Repayment Logged: ${loan.customer_name}`, payMsg]
      );
    }
    
    res.status(201).json({ message: 'Repayment recorded successfully!' });
  } catch (error) {
    console.error('Error recording repayment:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update a lending entry details
router.put('/loans/:id', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const { customerId, principalAmount, interestRate, interestType, loanDate, notes } = req.body;
  const tenantDb = req.db;

  if (!customerId || !principalAmount || !interestRate || !loanDate) {
    return res.status(400).json({ message: 'All fields are required (Customer, Principal, Rate, Date)' });
  }

  try {
    // Check if loan exists
    const [loanRows] = await tenantDb.query('SELECT * FROM loans WHERE id = ?', [id]);
    if (loanRows.length === 0) {
      return res.status(404).json({ message: 'Lending entry not found' });
    }
    const loan = loanRows[0];

    // Check if customer exists
    const [customerRows] = await tenantDb.query('SELECT name FROM customers WHERE id = ?', [customerId]);
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Selected customer not found' });
    }
    const customer = customerRows[0];

    // Update loan details
    await tenantDb.query(
      `UPDATE loans 
       SET customer_id = ?, customer_name = ?, principal_amount = ?, interest_rate = ?, interest_type = ?, loan_date = ?, notes = ?
       WHERE id = ?`,
      [customerId, customer.name, principalAmount, interestRate, interestType || 'Monthly', loanDate, notes || null, id]
    );

    // Check if outstanding principal balance is fully paid after editing
    const [repayments] = await tenantDb.query('SELECT principal_paid FROM loan_repayments WHERE loan_id = ?', [id]);
    const totalPrincPaidSoFar = repayments.reduce((sum, r) => sum + parseFloat(r.principal_paid || 0), 0);
    const newPrincipal = parseFloat(principalAmount);

    if (totalPrincPaidSoFar >= newPrincipal) {
      if (loan.status === 'Active') {
        const todayDate = new Date().toISOString().split('T')[0];
        await tenantDb.query(
          "UPDATE loans SET status = 'Closed', closed_date = ? WHERE id = ?",
          [todayDate, id]
        );
      }
    } else {
      if (loan.status === 'Closed') {
        await tenantDb.query(
          "UPDATE loans SET status = 'Active', closed_date = NULL WHERE id = ?",
          [id]
        );
      }
    }

    res.json({ message: 'Lending entry updated successfully!' });
  } catch (error) {
    console.error('Error updating lending entry:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;

