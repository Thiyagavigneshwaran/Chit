import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create reusable Gmail transporter using App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  debug: true,
  logger: true,
});

/**
 * Send an email
 * @param {string|string[]} to - recipient(s)
 * @param {string} subject
 * @param {string} html - HTML email body
 * @param {Array} [attachments] - Optional mail attachments array
 */
export const sendMail = async (to, subject, html, attachments = []) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_SENDER_NAME || 'FinCore Chit Fund'}" <${process.env.GMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      attachments,
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email send failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

export default transporter;
