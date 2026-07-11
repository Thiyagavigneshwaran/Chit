import express from 'express';
import { authenticateJWT } from './auth.js';
import { resolveTenant } from '../middleware/tenant.js';

const router = express.Router();

// Get all active alerts
router.get('/', authenticateJWT, resolveTenant, async (req, res) => {
  try {
    const tenantDb = req.db;
    const [notifications] = await tenantDb.query('SELECT * FROM notifications ORDER BY created_date DESC');
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Create new notification manually
router.post('/', authenticateJWT, resolveTenant, async (req, res) => {
  const { title, message, type } = req.body;
  const tenantDb = req.db;

  if (!title || !message) {
    return res.status(400).json({ message: 'Title and message are required' });
  }

  try {
    const [result] = await tenantDb.query(
      'INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)',
      [title, message, type || 'info']
    );

    res.status(201).json({
      message: 'Notification created successfully',
      notification: {
        id: result.insertId,
        title,
        message,
        type: type || 'info',
        is_read: false,
        created_date: new Date()
      }
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const tenantDb = req.db;
  try {
    await tenantDb.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error updating notification status:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Clear notification
router.delete('/:id', authenticateJWT, resolveTenant, async (req, res) => {
  const { id } = req.params;
  const tenantDb = req.db;
  try {
    await tenantDb.query('DELETE FROM notifications WHERE id = ?', [id]);
    res.json({ message: 'Notification cleared successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
