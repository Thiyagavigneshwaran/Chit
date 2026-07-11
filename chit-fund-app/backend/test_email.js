import { getTenantPool } from './db.js';
import { generateInstallmentPDF } from './utils/pdfGenerator.js';
import { sendMail } from './utils/mailer.js';
import { buildAdminSummaryEmail } from './utils/emailTemplates.js';
import dotenv from 'dotenv';

dotenv.config();

const test = async () => {
  try {
    console.log('Resolving tenant pool...');
    const db = await getTenantPool('tenant_1');
    
    console.log('Fetching groups...');
    const [groups] = await db.query('SELECT * FROM chit_groups LIMIT 1');
    if (groups.length === 0) {
      console.log('No groups found.');
      return;
    }
    const group = groups[0];
    console.log('Selected group:', group.id, group.name);

    console.log('Fetching members...');
    const [members] = await db.query(`
      SELECT c.id, c.name, c.email, c.mobile, cc.joined_date
      FROM customers c
      JOIN customer_chits cc ON c.id = cc.customer_id
      WHERE cc.chit_group_id = ?
    `, [group.id]);
    console.log(`Found ${members.length} members.`);

    console.log('Generating PDF...');
    const pdfBuffer = await generateInstallmentPDF(group, members);
    console.log(`PDF generated. Buffer length: ${pdfBuffer.length} bytes`);

    const pdfAttachment = {
      filename: `Test_Installment_Schedule_${group.id}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    };

    console.log('Sending email to:', process.env.ADMIN_EMAIL);
    const adminHtml = buildAdminSummaryEmail(group, members, {});
    const result = await sendMail(
      process.env.ADMIN_EMAIL,
      `[Test] Group Enrollment Summary — ${group.name}`,
      adminHtml,
      [pdfAttachment]
    );

    console.log('Send Result:', result);
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    process.exit(0);
  }
};

test();
