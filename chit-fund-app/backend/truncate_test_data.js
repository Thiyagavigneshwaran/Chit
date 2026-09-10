import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';

async function truncateAll() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
    });

    console.log('Successfully connected to the database server.');

    // 1. Find all tenant databases matching 'chit_fund_tenant_%'
    const [databases] = await connection.query("SHOW DATABASES LIKE 'chit_fund_tenant_%'");
    
    if (databases.length === 0) {
      console.log('No tenant databases found.');
      return;
    }

    const dbNames = databases.map(dbObj => Object.values(dbObj)[0]);
    console.log(`Found tenant databases: ${dbNames.join(', ')}`);

    const tablesToTruncate = [
      'loan_repayments',
      'loans',
      'guarantees',
      'collections',
      'auctions',
      'payments',
      'customer_chits',
      'customers',
      'chit_groups',
      'notifications'
    ];

    for (const dbName of dbNames) {
      console.log(`\n--------------------------------------------`);
      console.log(`Cleaning database: ${dbName}`);
      console.log(`--------------------------------------------`);

      await connection.query(`USE \`${dbName}\``);

      // Disable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      console.log('Disabled foreign key constraints.');

      // Truncate each table
      for (const table of tablesToTruncate) {
        try {
          // Check if table exists in this database first
          const [tableExists] = await connection.query(`SHOW TABLES LIKE '${table}'`);
          if (tableExists.length > 0) {
            await connection.query(`TRUNCATE TABLE \`${table}\``);
            console.log(`✔ Truncated table: ${table}`);
          } else {
            console.log(`➖ Table '${table}' does not exist, skipping.`);
          }
        } catch (error) {
          console.error(`❌ Error truncating table '${table}':`, error.message);
        }
      }

      // Re-enable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('Re-enabled foreign key constraints.');
    }

    console.log(`\n============================================`);
    console.log('Database truncation completed successfully!');
    console.log(`============================================`);

  } catch (error) {
    console.error('Fatal execution error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

truncateAll();
