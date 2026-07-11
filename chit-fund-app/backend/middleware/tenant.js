import { getTenantPool } from '../db.js';

export const resolveTenant = async (req, res, next) => {
  if (!req.user || !req.user.tenant_id) {
    return res.status(400).json({ message: 'Bad Request: Tenant identity could not be resolved.' });
  }

  try {
    const tenantId = req.user.tenant_id;
    const year = req.headers['x-year'] || req.query.year || '2026';
    const pool = await getTenantPool(tenantId, year);
    
    // Attach the connection pool to the request object
    req.db = pool;
    req.year = year;
    next();
  } catch (error) {
    console.error('Error resolving tenant database:', error);
    res.status(500).json({ message: 'Internal Server Error: Failed to connect to tenant database.' });
  }
};
