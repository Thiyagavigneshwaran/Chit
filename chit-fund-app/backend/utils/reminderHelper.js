import { sendMail } from './mailer.js';

/**
 * Sends a due reminder email to a customer for their chit groups.
 * Used for both manual triggers and automated background triggers.
 * 
 * @param {object} tenantDb - Database connection pool/client
 * @param {number} customerId - ID of the customer to notify
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const sendCustomerReminderEmail = async (tenantDb, customerId) => {
  try {
    // 1. Fetch customer details
    const [customerRows] = await tenantDb.query('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (customerRows.length === 0) {
      return { success: false, error: 'Customer not found' };
    }
    const customer = customerRows[0];

    // 2. Fetch joined chit groups
    const [joinedChits] = await tenantDb.query(`
      SELECT cg.id, cg.name, cg.value, cg.monthly_contribution, cg.installments, cg.installment_schedule
      FROM customer_chits cc
      JOIN chit_groups cg ON cc.chit_group_id = cg.id
      WHERE cc.customer_id = ?
    `, [customerId]);

    if (joinedChits.length === 0) {
      return { success: false, error: 'Customer is not enrolled in any active chit groups.' };
    }

    // 3. Construct dues summary rows
    let htmlDuesRows = '';
    for (const chit of joinedChits) {
      let schedule = [];
      if (chit.installment_schedule) {
        try {
          schedule = typeof chit.installment_schedule === 'string'
            ? JSON.parse(chit.installment_schedule)
            : chit.installment_schedule;
        } catch (e) {
          console.error('Failed to parse schedule:', e);
        }
      }

      // Estimate current installment number based on completed auctions
      const [auctions] = await tenantDb.query(
        'SELECT MAX(installment_no) as last_inst FROM auctions WHERE chit_group_id = ?',
        [chit.id]
      );
      const currentInstNo = (auctions[0].last_inst || 0) + 1;

      // Find contribution for this installment
      let contribution = parseFloat(chit.monthly_contribution);
      let dueDate = 'N/A';
      if (Array.isArray(schedule) && schedule.length >= currentInstNo) {
        const matchedRow = schedule[currentInstNo - 1];
        if (matchedRow) {
          contribution = parseFloat(matchedRow.payingAmount) || contribution;
          dueDate = matchedRow.dueDate || dueDate;
        }
      }

      htmlDuesRows += `
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #1E40AF;">${chit.id} - ${chit.name}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Installment #${currentInstNo}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; color: #b91c1c; font-weight: bold;">INR ${contribution.toLocaleString('en-IN')}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${dueDate}</td>
        </tr>
      `;
    }

    const emailHtmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <h2 style="color: #1E40AF; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0; font-weight: 800;">Chit Installment Due Reminder</h2>
        <p style="font-size: 14px; color: #334155;">Dear <strong>${customer.name}</strong> (Customer ID: ${customer.customer_code || '—'}),</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.5;">This is a reminder regarding your outstanding installment dues for your active chit groups. Below is a detailed summary of your current outstanding contributions:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; font-size: 13px;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Chit Group</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Installment</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">Amount Due</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${htmlDuesRows}
          </tbody>
        </table>

        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 15px; margin-top: 20px; margin-bottom: 20px;">
          <span style="color: #b45309; font-weight: 700; font-size: 13px;">⚠️ Total Pending Outstanding Dues: INR ${parseFloat(customer.pending_amount).toLocaleString('en-IN')}</span>
        </div>

        <p style="font-size: 14px; color: #334155; line-height: 1.5;">Please ensure that your payment is settled promptly to keep your account status active and avoid late fee penalties. If you have already made this payment, please disregard this notification.</p>
        
        <div style="border-top: 1px solid #f1f5f9; padding-top: 15px; margin-top: 25px; font-size: 12px; color: #64748b; line-height: 1.4;">
          Regards,<br/>
          <strong>Sri Vinayaga Chit Funds</strong>
        </div>
      </div>
    `;

    const mailRes = await sendMail(customer.email, 'FinCore Chit Funds - Installment Due Reminder', emailHtmlBody);
    return mailRes;
  } catch (error) {
    console.error('Error inside sendCustomerReminderEmail utility:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Automatically triggers email reminders for all members of a group who have auto-reminder enabled.
 * Designed to run in background (asynchronously) without blocking critical auction flow.
 * 
 * @param {object} tenantDb - Database connection pool/client
 * @param {string} chitGroupId - Group ID
 */
export const triggerAutoRemindersForGroup = async (tenantDb, chitGroupId) => {
  try {
    // 1. Fetch group members with auto_reminder turned on
    const [members] = await tenantDb.query(`
      SELECT id, name, email, auto_reminder 
      FROM customers c
      JOIN customer_chits cc ON c.id = cc.customer_id
      WHERE cc.chit_group_id = ? AND c.auto_reminder = 1
    `, [chitGroupId]);

    console.log(`[Auto Reminder Trigger] Found ${members.length} members with auto-reminder enabled in group ${chitGroupId}.`);

    // 2. Dispatch reminder email to each eligible member
    for (const member of members) {
      console.log(`[Auto Reminder Trigger] Dispatching auto reminder email to ${member.name} (${member.email})...`);
      sendCustomerReminderEmail(tenantDb, member.id).catch(err => {
        console.error(`[Auto Reminder Trigger] Failed auto dispatch to member ${member.id}:`, err.message);
      });
    }
  } catch (error) {
    console.error('Error inside triggerAutoRemindersForGroup helper:', error.message);
  }
};
