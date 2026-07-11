import { getTenantPool } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  try {
    const tenants = ['tenant_1', 'tenant_2'];
    
    for (const tenantId of tenants) {
      console.log(`Creating chit_templates table in database for ${tenantId}...`);
      const db = await getTenantPool(tenantId);
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS chit_templates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          value DECIMAL(15,2) NOT NULL,
          installments INT NOT NULL,
          monthly_contribution DECIMAL(15,2) NOT NULL,
          installment_schedule TEXT NULL
        )
      `);
      console.log(`✅ Success for ${tenantId}`);
    }
  } catch (err) {
    console.error('Failed to create templates table:', err);
  } finally {
    process.exit(0);
  }
};

run();
