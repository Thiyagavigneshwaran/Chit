export const recalculateCustomerStatus = async (db, customerId) => {
  // 1. Get customer details
  const [customerRows] = await db.query('SELECT * FROM customers WHERE id = ?', [customerId]);
  if (customerRows.length === 0) return;
  const customer = customerRows[0];

  // 2. Get all groups this customer is enrolled in
  const [enrolledGroups] = await db.query(`
    SELECT cg.*, cc.joined_date
    FROM customer_chits cc
    JOIN chit_groups cg ON cc.chit_group_id = cg.id
    WHERE cc.customer_id = ?
  `, [customerId]);

  // 3. Get total collections (payments made) by the customer for each group
  const [collections] = await db.query(`
    SELECT chit_group_id, SUM(amount) as total_paid
    FROM collections
    WHERE customer_id = ?
    GROUP BY chit_group_id
  `, [customerId]);

  const paidMap = {};
  collections.forEach(col => {
    paidMap[col.chit_group_id] = parseFloat(col.total_paid) || 0;
  });

  let totalPaid = 0;
  let totalPending = 0;
  let hasOverdue = false;
  let hasPending = false;

  const todayStr = new Date().toISOString().split('T')[0];

  for (const group of enrolledGroups) {
    const groupId = group.id;
    const monthlyContribution = parseFloat(group.monthly_contribution);
    const tenure = parseInt(group.installments);
    const paidForGroup = paidMap[groupId] || 0;
    totalPaid += paidForGroup;

    // Parse the installment schedule
    let schedule = [];
    if (group.installment_schedule) {
      try {
        schedule = typeof group.installment_schedule === 'string'
          ? JSON.parse(group.installment_schedule)
          : group.installment_schedule;
      } catch (e) {
        console.error(`Failed to parse schedule for group ${groupId}:`, e);
      }
    }

    // If schedule is empty or legacy, generate a default one based on joined_date
    if (!Array.isArray(schedule) || schedule.length === 0) {
      schedule = [];
      const joinDate = new Date(group.joined_date || todayStr);
      for (let i = 0; i < tenure; i++) {
        const dueDate = new Date(joinDate);
        dueDate.setMonth(joinDate.getMonth() + i);
        schedule.push({
          amount: monthlyContribution,
          dueDate: dueDate.toISOString().split('T')[0]
        });
      }
    } else {
      // If the schedule is legacy (array of numbers), convert to objects
      schedule = schedule.map((item, index) => {
        const joinDate = new Date(group.joined_date || todayStr);
        const dueDate = new Date(joinDate);
        dueDate.setMonth(joinDate.getMonth() + index);

        if (typeof item === 'number' || typeof item === 'string') {
          return {
            amount: parseFloat(item) || monthlyContribution,
            dueDate: dueDate.toISOString().split('T')[0]
          };
        }
        return {
          amount: parseFloat(item.amount) || monthlyContribution,
          dueDate: item.dueDate || dueDate.toISOString().split('T')[0]
        };
      });
    }

    // Compute overdue and pending for this group
    let remainingPaid = paidForGroup;
    let groupOverdue = 0;
    let groupPending = 0;

    for (const inst of schedule) {
      const instAmount = inst.amount;
      const instDueDate = inst.dueDate;

      if (remainingPaid >= instAmount) {
        // Fully paid
        remainingPaid -= instAmount;
      } else {
        // Not fully paid
        const unpaidAmount = instAmount - remainingPaid;
        remainingPaid = 0;

        if (instDueDate < todayStr) {
          groupOverdue += unpaidAmount;
        } else {
          groupPending += unpaidAmount;
        }
      }
    }

    // Determine current month status for this group
    // Find the end of the current calendar month (today's billing month cycle)
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

    let remainingPaidForStatus = paidForGroup;
    let groupHasUnpaidCurrentOrPastMonth = false;

    for (const inst of schedule) {
      const instAmount = inst.amount;
      const instDueDate = inst.dueDate;

      if (remainingPaidForStatus >= instAmount) {
        remainingPaidForStatus -= instAmount;
      } else {
        // Unpaid amount exists
        if (instDueDate <= endOfMonthStr) {
          groupHasUnpaidCurrentOrPastMonth = true;
          break;
        }
      }
    }

    totalPending += (groupOverdue + groupPending);
    if (groupOverdue > 0) {
      hasOverdue = true;
    }
    if (groupHasUnpaidCurrentOrPastMonth) {
      hasPending = true;
    }
  }

  let finalStatus = 'Paid';
  if (hasOverdue) {
    finalStatus = 'Overdue';
  } else if (hasPending) {
    finalStatus = 'Pending';
  }

  // Update customer record
  await db.query(`
    UPDATE customers
    SET paid_amount = ?, pending_amount = ?, status = ?
    WHERE id = ?
  `, [totalPaid, totalPending, finalStatus, customerId]);
};

// Recalculate status for all customers enrolled in a group
export const recalculateGroupMembersStatus = async (db, groupId) => {
  const [members] = await db.query('SELECT customer_id FROM customer_chits WHERE chit_group_id = ?', [groupId]);
  for (const m of members) {
    await recalculateCustomerStatus(db, m.customer_id);
  }
};
