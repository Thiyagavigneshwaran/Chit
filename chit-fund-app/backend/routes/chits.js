import express from 'express';
import { authenticateJWT } from './auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { recalculateCustomerStatus, recalculateGroupMembersStatus } from '../utils/statusHelper.js';
import { sendMail } from '../utils/mailer.js';
import { buildAdminSummaryEmail, buildMemberWelcomeEmail } from '../utils/emailTemplates.js';
import { generateInstallmentPDF } from '../utils/pdfGenerator.js';

const router = express.Router();

// Get all chit groups for active tenant
router.get('/', authenticateJWT, resolveTenant, async (req, res) => {
  try {
    const tenantDb = req.db;
    const [groups] = await tenantDb.query('SELECT * FROM chit_groups');
    res.json(groups);
  } catch (error) {
    console.error('Error fetching chit groups:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get single group details and members
router.get('/:id', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const tenantDb = req.db;
  try {
    const [groupRows] = await tenantDb.query('SELECT * FROM chit_groups WHERE id = ?', [id]);
    if (groupRows.length === 0) {
      return res.status(404).json({ message: 'Chit Group not found' });
    }

    // Get group members
    const [members] = await tenantDb.query(`
      SELECT c.id, c.name, c.email, c.mobile, c.status
      FROM customers c
      JOIN customer_chits cc ON c.id = cc.customer_id
      WHERE cc.chit_group_id = ?
    `, [id]);

    res.json({
      group: groupRows[0],
      members
    });
  } catch (error) {
    console.error('Error fetching chit group details:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Create new chit group
router.post('/', authenticateJWT, resolveTenant, async (req, res) => {
  const { id, name, value, installments, monthlyContribution, installmentSchedule } = req.body;
  const tenantDb = req.db;

  if (!id || !name || !value || !installments || !monthlyContribution) {
    return res.status(400).json({ message: 'All fields are required (Group Code, Name, Value, Installments, Monthly Contribution)' });
  }

  try {
    // Check if group already exists
    const [existing] = await tenantDb.query('SELECT * FROM chit_groups WHERE id = ?', [id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: `Group with code '${id}' already exists.` });
    }

    const scheduleJson = installmentSchedule ? JSON.stringify(installmentSchedule) : null;

    await tenantDb.query(
      'INSERT INTO chit_groups (id, name, value, installments, monthly_contribution, active_members, status, installment_schedule) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      [id, name, value, installments, monthlyContribution, 'Active', scheduleJson]
    );

    res.status(201).json({
      message: 'Chit Group created successfully',
      group: { id, name, value, installments, monthlyContribution, active_members: 0, status: 'Active', installment_schedule: scheduleJson }
    });
  } catch (error) {
    console.error('Error creating chit group:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Enroll a customer in a chit group
router.post('/:id/members', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params; // chitGroupId
  const { customerId } = req.body;
  const tenantDb = req.db;

  if (!customerId) {
    return res.status(400).json({ message: 'Customer ID is required.' });
  }

  try {
    // 1. Verify Chit Group exists
    const [groupRows] = await tenantDb.query('SELECT * FROM chit_groups WHERE id = ?', [id]);
    if (groupRows.length === 0) {
      return res.status(404).json({ message: 'Chit Group not found.' });
    }
    const group = groupRows[0];

    // 2. Verify Customer exists
    const [customerRows] = await tenantDb.query('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found.' });
    }
    const customer = customerRows[0];

    // 3. Verify if customer is already enrolled in this group
    const [existingLink] = await tenantDb.query(
      'SELECT * FROM customer_chits WHERE customer_id = ? AND chit_group_id = ?',
      [customerId, id]
    );
    if (existingLink.length > 0) {
      return res.status(400).json({ message: 'Customer is already enrolled in this group.' });
    }

    // 4. Enroll customer
    const joinedDate = new Date().toISOString().split('T')[0];
    await tenantDb.query(
      'INSERT INTO customer_chits (customer_id, chit_group_id, joined_date) VALUES (?, ?, ?)',
      [customerId, id, joinedDate]
    );

    // 5. Update active members count in chit group
    await tenantDb.query(
      'UPDATE chit_groups SET active_members = active_members + 1 WHERE id = ?',
      [id]
    );

    // 6. Update customer total_chits & recalculate profile status
    await tenantDb.query(
      'UPDATE customers SET total_chits = total_chits + 1 WHERE id = ?',
      [customerId]
    );
    await recalculateCustomerStatus(tenantDb, customerId);

    // 7. Get updated member details to return
    const [newMember] = await tenantDb.query(
      'SELECT id, name, email, mobile, status FROM customers WHERE id = ?',
      [customerId]
    );

    // Create system notification
    const notificationMsg = `Customer ${customer.name} enrolled in Chit Group '${group.name}' (${id}).`;
    await tenantDb.query(
      'INSERT INTO notifications (title, message, type) VALUES (?, ?, "success")',
      [`Customer Enrolled: ${customer.name}`, notificationMsg]
    );

    res.status(200).json({
      message: 'Customer enrolled in chit group successfully!',
      member: newMember[0]
    });
  } catch (error) {
    console.error('Error enrolling customer in group:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update chit group details
router.put('/:id', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const { name, value, installments, monthlyContribution, status, installmentSchedule } = req.body;
  const tenantDb = req.db;

  if (!name || !value || !installments || !monthlyContribution) {
    return res.status(400).json({ message: 'Name, Value, Installments and Monthly Contribution are required' });
  }

  try {
    const [existing] = await tenantDb.query('SELECT * FROM chit_groups WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Chit Group not found' });
    }

    const scheduleJson = installmentSchedule ? JSON.stringify(installmentSchedule) : null;

    await tenantDb.query(
      'UPDATE chit_groups SET name = ?, value = ?, installments = ?, monthly_contribution = ?, status = ?, installment_schedule = ? WHERE id = ?',
      [name, value, installments, monthlyContribution, status || 'Active', scheduleJson, id]
    );

    // 5. Recalculate status for all enrolled members in this group
    await recalculateGroupMembersStatus(tenantDb, id);

    res.json({ message: 'Chit Group updated successfully' });
  } catch (error) {
    console.error('Error updating chit group:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Send enrollment summary email to admin + welcome emails to members
router.post('/:id/notify-enrollment', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const tenantDb = req.db;

  try {
    // 1. Fetch group details
    const [groupRows] = await tenantDb.query('SELECT * FROM chit_groups WHERE id = ?', [id]);
    if (groupRows.length === 0) {
      return res.status(404).json({ message: 'Chit Group not found.' });
    }
    const group = groupRows[0];

    // 2. Fetch all current members of this group
    const [members] = await tenantDb.query(`
      SELECT c.id, c.customer_code, c.name, c.email, c.mobile, cc.joined_date
      FROM customers c
      JOIN customer_chits cc ON c.id = cc.customer_id
      WHERE cc.chit_group_id = ?
      ORDER BY cc.joined_date ASC
    `, [id]);

    if (members.length === 0) {
      return res.status(400).json({ message: 'No members enrolled in this group yet. Add members first.' });
    }

    // 3. Detect cross-enrollment: find if any member is in other groups too
    const crossEnrollments = {};
    for (const member of members) {
      const [otherGroups] = await tenantDb.query(`
        SELECT cg.id, cg.name
        FROM customer_chits cc
        JOIN chit_groups cg ON cc.chit_group_id = cg.id
        WHERE cc.customer_id = ? AND cc.chit_group_id != ?
      `, [member.id, id]);

      if (otherGroups.length > 0) {
        crossEnrollments[member.id] = otherGroups.map(g => `${g.name} (${g.id})`);
      }
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    let memberEmailsSent = 0;
    let memberEmailsFailed = 0;

    // 4. Generate installment schedule PDF
    let pdfAttachment = null;
    try {
      const pdfBuffer = await generateInstallmentPDF(group, members);
      pdfAttachment = {
        filename: `Installment_Schedule_${group.id}_${group.name.replace(/\s+/g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      };
      console.log(`✅ PDF generated for group ${group.id} (${pdfBuffer.length} bytes)`);
    } catch (pdfErr) {
      console.error('⚠️ PDF generation failed, sending email without attachment:', pdfErr.message);
    }

    // 5. Send admin summary email (with PDF attachment)
    const adminHtml = buildAdminSummaryEmail(group, members, crossEnrollments);
    await sendMail(
      adminEmail,
      `[FinCore] Group Enrollment Summary — ${group.name} (${group.id}) | ${members.length} Members`,
      adminHtml,
      pdfAttachment ? [pdfAttachment] : []
    );

    // 5. Send welcome email to each member who has a valid email
    for (const member of members) {
      if (member.email && member.email.includes('@')) {
        const memberHtml = buildMemberWelcomeEmail(member, group);
        const result = await sendMail(
          member.email,
          `Welcome to ${group.name} — Your Chit Group Enrollment Confirmation`,
          memberHtml,
          pdfAttachment ? [pdfAttachment] : []
        );
        if (result.success) {
          memberEmailsSent++;
        } else {
          memberEmailsFailed++;
        }
      }
    }

    // 6. Log notification in DB
    await tenantDb.query(
      'INSERT INTO notifications (title, message, type) VALUES (?, ?, "success")',
      [
        `Enrollment Summary Sent: ${group.name}`,
        `Admin summary email dispatched for group ${group.id} with ${members.length} members. ${memberEmailsSent} member welcome emails sent.`
      ]
    );

    res.json({
      success: true,
      message: `Summary sent to ${adminEmail}. ${memberEmailsSent} member welcome email(s) sent.`,
      adminEmail,
      totalMembers: members.length,
      memberEmailsSent,
      memberEmailsFailed,
      crossEnrollmentCount: Object.keys(crossEnrollments).length
    });

  } catch (error) {
    console.error('Error sending enrollment notification emails:', error);
    res.status(500).json({ message: 'Failed to send emails. Please check email configuration.', error: error.message });
  }
});

// Get all saved templates
router.get('/config/templates', authenticateJWT, resolveTenant, async (req, res) => {
  try {
    const tenantDb = req.db;
    const [templates] = await tenantDb.query('SELECT * FROM chit_templates ORDER BY name ASC');
    
    // Parse installment_schedule if stored as string
    const parsed = templates.map(t => ({
      ...t,
      installmentSchedule: t.installment_schedule ? JSON.parse(t.installment_schedule) : []
    }));
    
    res.json(parsed);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Save a new template
router.post('/config/templates', authenticateJWT, resolveTenant, async (req, res) => {
  const { name, value, installments, monthlyContribution, installmentSchedule } = req.body;
  const tenantDb = req.db;

  if (!name || !value || !installments || !monthlyContribution) {
    return res.status(400).json({ message: 'Name, Value, Installments and Monthly Contribution are required' });
  }

  try {
    const scheduleJson = installmentSchedule ? JSON.stringify(installmentSchedule) : null;

    await tenantDb.query(`
      INSERT INTO chit_templates (name, value, installments, monthly_contribution, installment_schedule)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        value = VALUES(value),
        installments = VALUES(installments),
        monthly_contribution = VALUES(monthly_contribution),
        installment_schedule = VALUES(installment_schedule)
    `, [name, value, installments, monthlyContribution, scheduleJson]);

    res.status(201).json({ message: 'Template saved successfully' });
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ message: 'Failed to save template to database.' });
  }
});

// Delete a template
router.delete('/config/templates/:id', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const tenantDb = req.db;

  try {
    await tenantDb.query('DELETE FROM chit_templates WHERE id = ?', [id]);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
