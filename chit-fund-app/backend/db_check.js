import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';

async function run() {
  const connection = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: 'chit_fund_tenant_1'
  });

  const id = 'CH001';
  const [members] = await connection.query(`
    SELECT c.id, c.name, c.email, c.mobile, c.status
    FROM customers c
    JOIN customer_chits cc ON c.id = cc.customer_id
    WHERE cc.chit_group_id = ?
  `, [id]);

  console.log('Query result for members under CH001:', members);

  await connection.end();
}

run().catch(console.error);
