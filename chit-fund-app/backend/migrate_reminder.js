import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';

async function run() {
  const databases = ['chit_fund_tenant_1', 'chit_fund_tenant_2'];
  
  for (const dbName of databases) {
    console.log(`Migrating database ${dbName}...`);
    let connection;
    try {
      connection = await mysql.createConnection({
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        database: dbName
      });

      // Add auto_reminder column to customers
      try {
        await connection.query('ALTER TABLE customers ADD COLUMN auto_reminder BOOLEAN DEFAULT TRUE');
        console.log(`- Successfully added auto_reminder column to customers in ${dbName}.`);
      } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
          console.log(`- auto_reminder column already exists in customers in ${dbName}.`);
        } else {
          console.error(`- Error adding column to ${dbName}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`Failed to connect to database ${dbName}:`, err.message);
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }
  console.log('Migration finished!');
}

run().catch(console.error);
