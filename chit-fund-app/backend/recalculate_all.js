import { getTenantPool } from './db.js';
import { recalculateCustomerStatus } from './utils/statusHelper.js';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  try {
    console.log('Resolving tenant pools...');
    const tenants = ['tenant_1', 'tenant_2'];
    
    for (const tenantId of tenants) {
      console.log(`Processing ${tenantId}...`);
      const db = await getTenantPool(tenantId);
      
      const [customers] = await db.query('SELECT id, name FROM customers');
      console.log(`Found ${customers.length} customers in ${tenantId}. Recalculating...`);
      
      for (const customer of customers) {
        await recalculateCustomerStatus(db, customer.id);
        console.log(`  Recalculated: ${customer.name}`);
      }
    }
    console.log('✅ All customer statuses successfully updated!');
  } catch (err) {
    console.error('Failed to recalculate:', err);
  } finally {
    process.exit(0);
  }
};

run();
