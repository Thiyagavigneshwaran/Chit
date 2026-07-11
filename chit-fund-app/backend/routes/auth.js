import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mainPool } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'premium_chit_secret_key';

// Middleware to authenticate JWT
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ message: 'Forbidden: Invalid Token' });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ message: 'Unauthorized: Missing Token' });
  }
};

// Middleware to check roles
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient Permissions' });
    }
    next();
  };
};

// Login API querying main database
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const [rows] = await mainPool.query(
      `SELECT u.*, t.name as tenant_name, t.db_name 
       FROM users u 
       JOIN tenants t ON u.tenant_id = t.id 
       WHERE u.username = ?`, 
      [username]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Generate JWT including tenant_id
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        name: user.name, 
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Profile validation
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const [rows] = await mainPool.query(
      `SELECT u.id, u.username, u.name, u.role, u.tenant_id, t.name as tenant_name 
       FROM users u 
       JOIN tenants t ON u.tenant_id = t.id 
       WHERE u.id = ?`, 
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
