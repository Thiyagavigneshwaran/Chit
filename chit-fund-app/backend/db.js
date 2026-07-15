import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';

// Create connection pool for the main database
export const mainPool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: 'chit_fund_main',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Cache for tenant connection pools
const tenantPools = {};

// Get or create a connection pool for a specific tenant database
export const getTenantPool = async (tenantId, year = '2026') => {
  const poolKey = `${tenantId}_${year}`;
  if (tenantPools[poolKey]) {
    return tenantPools[poolKey];
  }

  // Fetch the tenant's database details from the main database
  try {
    const [rows] = await mainPool.query('SELECT db_name FROM tenants WHERE id = ?', [tenantId]);

    if (rows.length === 0) {
      throw new Error(`Tenant '${tenantId}' not found in main database.`);
    }

    const baseDbName = rows[0].db_name;
    const dbName = `${baseDbName}_${year}`;

    console.log(`Resolving connection pool for tenant: ${tenantId}, Year: ${year} (${dbName})`);

    // Ensure database exists and schema is loaded
    let connection;
    try {
      connection = await mysql.createConnection({
        host: dbHost,
        user: dbUser,
        password: dbPassword
      });

      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await connection.query(`USE \`${dbName}\``);

      // Verify tables
      const [tables] = await connection.query(`SHOW TABLES LIKE 'customers'`);
      if (tables.length === 0) {
        console.log(`Database '${dbName}' is new. Generating schema...`);
        await createTenantTables(connection);
      }
    } catch (err) {
      console.error(`Error checking/initializing database '${dbName}':`, err);
      throw err;
    } finally {
      if (connection) await connection.end();
    }

    const pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });

    // Cache the pool
    tenantPools[poolKey] = pool;
    return pool;
  } catch (error) {
    console.error(`Error resolving pool for tenant: ${tenantId}, Year: ${year}`, error);
    throw error;
  }
};

// Main initializer to check MySQL connection and create/seed databases if needed
export const initDb = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword
    });

    console.log('Successfully connected to MySQL server.');

    // 1. Initialize Main DB
    await connection.query('CREATE DATABASE IF NOT EXISTS chit_fund_main');
    await connection.query('USE chit_fund_main');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        db_name VARCHAR(100) NOT NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        tenant_id VARCHAR(50),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Seed tenants
    await connection.query(`
      INSERT INTO tenants (id, name, db_name) VALUES
      ('tenant_1', 'Sri Vinayaga Chit Funds', 'chit_fund_tenant_1'),
      ('tenant_2', 'Premier Chit Group Ltd', 'chit_fund_tenant_2')
      ON DUPLICATE KEY UPDATE name=VALUES(name), db_name=VALUES(db_name)
    `);

    // Seed users with encrypted passwords (admin123, manager123, agent123, accountant123)
    await connection.query(`
      INSERT INTO users (username, password, name, role, tenant_id) VALUES
      ('admin', '$2a$10$Wl4.fVviXNwuT7sSC3ogveKEVknmv570KC/6EkrpXXqMaM19vCUWC', 'Vijay Kumar', 'Super Admin', 'tenant_1'),
      ('manager', '$2a$10$.sLIooSMjEFG2rEvX.zLde/Cc1OG7FpE3MJX8FTTTYGnCeNDPY5o2', 'Suresh Kumar', 'Manager', 'tenant_2'),
      ('agent', '$2a$10$WpA/whcmpCd/z5UFDEmPkupDp4DTt0eY7Op5F1EeI81zyIuig96wS', 'Vijay Sharma', 'Collection Agent', 'tenant_1'),
      ('accountant', '$2a$10$Nhk5hdUrLSY.tqEwQaHio.1RO1cmM7VVMUejSmxWgLIyLk3uc3SCG', 'Meera Nair', 'Accountant', 'tenant_1')
      ON DUPLICATE KEY UPDATE password=VALUES(password), name=VALUES(name), role=VALUES(role), tenant_id=VALUES(tenant_id)
    `);

    // 2. Initialize Tenant 1 DB for default Year 2026
    await connection.query('CREATE DATABASE IF NOT EXISTS chit_fund_tenant_1_2026');
    await connection.query('USE chit_fund_tenant_1_2026');
    await createTenantTables(connection);

    // Seed Tenant 1 Notifications
    await connection.query(`
      INSERT INTO notifications (id, title, message, created_date, is_read, type) VALUES
      (1, 'Welcome to Sri Vinayaga Chit Funds', 'Your multi-tenant account is set up and active.', DATE_SUB(NOW(), INTERVAL 10 DAY), 1, 'success')
      ON DUPLICATE KEY UPDATE title=VALUES(title), message=VALUES(message)
    `);

    // 3. Initialize Tenant 2 DB for default Year 2026
    await connection.query('CREATE DATABASE IF NOT EXISTS chit_fund_tenant_2_2026');
    await connection.query('USE chit_fund_tenant_2_2026');
    await createTenantTables(connection);

    // Seed Tenant 2 Notifications
    await connection.query(`
      INSERT INTO notifications (id, title, message, created_date, is_read, type) VALUES
      (1, 'Welcome to Premier Chit Group Ltd', 'Your multi-tenant database is provisioned.', DATE_SUB(NOW(), INTERVAL 5 DAY), 1, 'success')
      ON DUPLICATE KEY UPDATE message=VALUES(message)
    `);

    console.log('MySQL databases initialized and seeded successfully.');
  } catch (error) {
    console.error('MySQL connection/initialization error:', error.message);
    console.log('Skipping immediate MySQL query execution. Make sure MySQL service is running.');
  } finally {
    if (connection) await connection.end();
  }
};

const createTenantTables = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      total_chits INT DEFAULT 0,
      paid_amount DECIMAL(15,2) DEFAULT 0.00,
      pending_amount DECIMAL(15,2) DEFAULT 0.00,
      status VARCHAR(20) DEFAULT 'Paid',
      auto_reminder BOOLEAN DEFAULT TRUE,
      customer_code VARCHAR(50) UNIQUE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS chit_groups (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      value DECIMAL(15,2) NOT NULL,
      installments INT NOT NULL,
      monthly_contribution DECIMAL(15,2) NOT NULL,
      active_members INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'Active',
      installment_schedule TEXT NULL
    )
  `);

  try {
    await connection.query('ALTER TABLE chit_groups ADD COLUMN installment_schedule TEXT NULL');
  } catch (err) {
    // Ignore duplicate column or connection errors
  }


  await connection.query(`
    CREATE TABLE IF NOT EXISTS customer_chits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT,
      chit_group_id VARCHAR(50),
      joined_date DATE,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS collections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT,
      customer_name VARCHAR(100) NOT NULL,
      chit_group_id VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      payment_date DATE NOT NULL,
      receipt_no VARCHAR(50) UNIQUE NOT NULL,
      collected_by VARCHAR(100) NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS auctions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chit_group_id VARCHAR(50) NOT NULL,
      installment_no INT NOT NULL,
      auction_date DATE NOT NULL,
      winning_bidder_id INT NOT NULL,
      winning_bidder_name VARCHAR(100) NOT NULL,
      bid_amount DECIMAL(15,2) NOT NULL,
      dividend_amount DECIMAL(15,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'Completed',
      FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id),
      FOREIGN KEY (winning_bidder_id) REFERENCES customers(id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      customer_name VARCHAR(100) NOT NULL,
      chit_group_id VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      transaction_ref VARCHAR(50) NOT NULL,
      type VARCHAR(50) DEFAULT 'Chit Payout',
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_read BOOLEAN DEFAULT FALSE,
      type VARCHAR(50) DEFAULT 'info'
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS loans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      customer_name VARCHAR(100) NOT NULL,
      principal_amount DECIMAL(15,2) NOT NULL,
      interest_rate DECIMAL(5,2) NOT NULL,
      interest_type VARCHAR(20) DEFAULT 'Monthly',
      loan_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'Active',
      closed_date DATE DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS loan_repayments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      loan_id INT NOT NULL,
      interest_paid DECIMAL(15,2) DEFAULT 0.00,
      principal_paid DECIMAL(15,2) DEFAULT 0.00,
      total_paid DECIMAL(15,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      transaction_ref VARCHAR(100) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS chit_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      value DECIMAL(15,2) NOT NULL,
      installments INT NOT NULL,
      monthly_contribution DECIMAL(15,2) NOT NULL,
      installment_schedule TEXT NULL
    )
  `);

  try {
    await connection.query('ALTER TABLE loan_repayments ADD COLUMN transaction_ref VARCHAR(100) DEFAULT NULL');
  } catch (err) {
    // Ignore duplicate column or connection errors
  }

  try {
    await connection.query('ALTER TABLE customers ADD COLUMN auto_reminder BOOLEAN DEFAULT TRUE');
  } catch (err) {
    // Ignore duplicate column or connection errors
  }

  try {
    await connection.query('ALTER TABLE customers ADD COLUMN customer_code VARCHAR(50) UNIQUE');
  } catch (err) {
    // Ignore duplicate column or connection errors
  }

  // Backfill existing customers without a customer_code
  try {
    const [customers] = await connection.query('SELECT id FROM customers WHERE customer_code IS NULL OR customer_code = ""');
    for (const c of customers) {
      const code = `CUST-${String(c.id).padStart(4, '0')}`;
      await connection.query('UPDATE customers SET customer_code = ? WHERE id = ?', [code, c.id]);
    }
  } catch (err) {
    console.error('Failed to backfill customer codes:', err.message);
  }

  // Seed default templates
  await seedDefaultTemplates(connection);
};

const seedDefaultTemplates = async (connection) => {
  const template100kSchedule = [
    { month: 1, actualAmount: 3575, payingAmount: 3600, bidAmount: 68500, repaymentAmount: 1400 },
    { month: 2, actualAmount: 3650, payingAmount: 3700, bidAmount: 70000, repaymentAmount: 1300 },
    { month: 3, actualAmount: 3725, payingAmount: 3700, bidAmount: 71500, repaymentAmount: 1300 },
    { month: 4, actualAmount: 3800, payingAmount: 3800, bidAmount: 73000, repaymentAmount: 1200 },
    { month: 5, actualAmount: 3875, payingAmount: 3900, bidAmount: 74500, repaymentAmount: 1100 },
    { month: 6, actualAmount: 3950, payingAmount: 4000, bidAmount: 76000, repaymentAmount: 1000 },
    { month: 7, actualAmount: 4025, payingAmount: 4000, bidAmount: 77500, repaymentAmount: 1000 },
    { month: 8, actualAmount: 4100, payingAmount: 4100, bidAmount: 79000, repaymentAmount: 900 },
    { month: 9, actualAmount: 4175, payingAmount: 4200, bidAmount: 80000, repaymentAmount: 800 },
    { month: 10, actualAmount: 4250, payingAmount: 4300, bidAmount: 82000, repaymentAmount: 700 },
    { month: 11, actualAmount: 4325, payingAmount: 4300, bidAmount: 83500, repaymentAmount: 700 },
    { month: 12, actualAmount: 4400, payingAmount: 4400, bidAmount: 85000, repaymentAmount: 600 },
    { month: 13, actualAmount: 4475, payingAmount: 4500, bidAmount: 86000, repaymentAmount: 500 },
    { month: 14, actualAmount: 4550, payingAmount: 4600, bidAmount: 88000, repaymentAmount: 400 },
    { month: 15, actualAmount: 4625, payingAmount: 4600, bidAmount: 89500, repaymentAmount: 400 },
    { month: 16, actualAmount: 4700, payingAmount: 4700, bidAmount: 91000, repaymentAmount: 300 },
    { month: 17, actualAmount: 4775, payingAmount: 4800, bidAmount: 92500, repaymentAmount: 200 },
    { month: 18, actualAmount: 4850, payingAmount: 4900, bidAmount: 94000, repaymentAmount: 100 },
    { month: 19, actualAmount: 4925, payingAmount: 4900, bidAmount: 95500, repaymentAmount: 100 },
    { month: 20, actualAmount: 5000, payingAmount: 5000, bidAmount: 97000, repaymentAmount: 0 }
  ];

  const template50kSchedule = template100kSchedule.map(row => ({
    month: row.month,
    actualAmount: Math.round(row.actualAmount * 0.5),
    payingAmount: Math.round(row.payingAmount * 0.5),
    bidAmount: Math.round(row.bidAmount * 0.5),
    repaymentAmount: Math.round(row.repaymentAmount * 0.5)
  }));

  const template200kSchedule = [
    { month: 1, actualAmount: 7150, payingAmount: 7200, bidAmount: 137000, repaymentAmount: 2800 },
    { month: 2, actualAmount: 7300, payingAmount: 7300, bidAmount: 140000, repaymentAmount: 2700 },
    { month: 3, actualAmount: 7450, payingAmount: 7500, bidAmount: 143000, repaymentAmount: 2500 },
    { month: 4, actualAmount: 7600, payingAmount: 7600, bidAmount: 146000, repaymentAmount: 2400 },
    { month: 5, actualAmount: 7750, payingAmount: 7800, bidAmount: 149000, repaymentAmount: 2200 },
    { month: 6, actualAmount: 7900, payingAmount: 7900, bidAmount: 152000, repaymentAmount: 2100 },
    { month: 7, actualAmount: 8050, payingAmount: 8100, bidAmount: 155000, repaymentAmount: 1900 },
    { month: 8, actualAmount: 8200, payingAmount: 8200, bidAmount: 158000, repaymentAmount: 1800 },
    { month: 9, actualAmount: 8350, payingAmount: 8400, bidAmount: 161000, repaymentAmount: 1600 },
    { month: 10, actualAmount: 8500, payingAmount: 8500, bidAmount: 164000, repaymentAmount: 1500 },
    { month: 11, actualAmount: 8650, payingAmount: 8700, bidAmount: 167000, repaymentAmount: 1300 },
    { month: 12, actualAmount: 8800, payingAmount: 8800, bidAmount: 170000, repaymentAmount: 1200 },
    { month: 13, actualAmount: 8950, payingAmount: 9000, bidAmount: 173000, repaymentAmount: 1000 },
    { month: 14, actualAmount: 9100, payingAmount: 9100, bidAmount: 176000, repaymentAmount: 900 },
    { month: 15, actualAmount: 9250, payingAmount: 9300, bidAmount: 179000, repaymentAmount: 700 },
    { month: 16, actualAmount: 9400, payingAmount: 9400, bidAmount: 182000, repaymentAmount: 600 },
    { month: 17, actualAmount: 9550, payingAmount: 9600, bidAmount: 185000, repaymentAmount: 400 },
    { month: 18, actualAmount: 9700, payingAmount: 9700, bidAmount: 188000, repaymentAmount: 300 },
    { month: 19, actualAmount: 9850, payingAmount: 9900, bidAmount: 191000, repaymentAmount: 100 },
    { month: 20, actualAmount: 10000, payingAmount: 10000, bidAmount: 194000, repaymentAmount: 0 }
  ];

  const template500kSchedule = [
    { month: 1, actualAmount: 15200, payingAmount: 12000, bidAmount: 32000, repaymentAmount: 3200 },
    { month: 2, actualAmount: 15400, payingAmount: 13200, bidAmount: 32000, repaymentAmount: 2200 },
    { month: 3, actualAmount: 15600, payingAmount: 14000, bidAmount: 32000, repaymentAmount: 1600 },
    { month: 4, actualAmount: 15800, payingAmount: 14000, bidAmount: 34000, repaymentAmount: 1800 },
    { month: 5, actualAmount: 16000, payingAmount: 14200, bidAmount: 34000, repaymentAmount: 1800 },
    { month: 6, actualAmount: 16200, payingAmount: 14400, bidAmount: 35000, repaymentAmount: 1800 },
    { month: 7, actualAmount: 16400, ipadAmount: 14800, payingAmount: 14800, bidAmount: 36000, repaymentAmount: 1600 },
    { month: 8, actualAmount: 16600, payingAmount: 15000, bidAmount: 37500, repaymentAmount: 1600 },
    { month: 9, actualAmount: 16800, payingAmount: 15200, bidAmount: 37000, repaymentAmount: 1600 },
    { month: 10, actualAmount: 17000, payingAmount: 15400, bidAmount: 36500, repaymentAmount: 1600 },
    { month: 11, actualAmount: 17200, payingAmount: 15800, bidAmount: 37500, repaymentAmount: 1400 },
    { month: 12, actualAmount: 17400, payingAmount: 16000, bidAmount: 38500, repaymentAmount: 1400 },
    { month: 13, actualAmount: 17600, payingAmount: 16200, bidAmount: 39000, repaymentAmount: 1400 },
    { month: 14, actualAmount: 17800, payingAmount: 16400, bidAmount: 39500, repaymentAmount: 1400 },
    { month: 15, actualAmount: 18000, payingAmount: 16600, bidAmount: 40000, repaymentAmount: 1400 },
    { month: 16, actualAmount: 18200, payingAmount: 16800, bidAmount: 41500, repaymentAmount: 1400 },
    { month: 17, actualAmount: 18400, payingAmount: 17000, bidAmount: 40500, repaymentAmount: 1400 },
    { month: 18, actualAmount: 18600, payingAmount: 17200, bidAmount: 42500, repaymentAmount: 1400 },
    { month: 19, actualAmount: 18800, payingAmount: 17400, bidAmount: 43000, repaymentAmount: 1400 },
    { month: 20, actualAmount: 19000, payingAmount: 17600, bidAmount: 43500, repaymentAmount: 1400 },
    { month: 21, actualAmount: 19200, payingAmount: 17800, bidAmount: 44500, repaymentAmount: 1400 },
    { month: 22, actualAmount: 19400, payingAmount: 18000, bidAmount: 45000, repaymentAmount: 1400 },
    { month: 23, actualAmount: 19600, payingAmount: 18200, bidAmount: 45500, repaymentAmount: 1400 },
    { month: 24, actualAmount: 19800, payingAmount: 19800, bidAmount: 0, repaymentAmount: 0 },
    { month: 25, actualAmount: 20000, payingAmount: 20000, bidAmount: 0, repaymentAmount: 0 }
  ];

  const seedData = [
    { name: '50K Scheme', value: 50000, installments: 20, monthly: 2500, schedule: template50kSchedule },
    { name: '100K Scheme', value: 100000, installments: 20, monthly: 5000, schedule: template100kSchedule },
    { name: '200K Scheme', value: 200000, installments: 20, monthly: 10000, schedule: template200kSchedule },
    { name: '500K Scheme', value: 500000, installments: 25, monthly: 20000, schedule: template500kSchedule }
  ];

  try {
    for (const item of seedData) {
      await connection.query(`
        INSERT INTO chit_templates (name, value, installments, monthly_contribution, installment_schedule)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          value = VALUES(value),
          installments = VALUES(installments),
          monthly_contribution = VALUES(monthly_contribution),
          installment_schedule = VALUES(installment_schedule)
      `, [item.name, item.value, item.installments, item.monthly, JSON.stringify(item.schedule)]);
    }
  } catch (err) {
    console.error('Failed to seed templates inside createTenantTables:', err.message);
  }
};

export default mainPool;


