-- =======================================================
-- MULTI-TENANT CHIT FUND DATABASE SCHEMA
-- =======================================================

-- 1. Main Database
CREATE DATABASE IF NOT EXISTS chit_fund_main;
USE chit_fund_main;

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  db_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL, -- Super Admin, Manager, Collection Agent, Accountant
  tenant_id VARCHAR(50),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Seed Main Database
INSERT INTO tenants (id, name, db_name) VALUES
('tenant_1', 'Sri Vinayaga Chit Funds', 'chit_fund_tenant_1'),
('tenant_2', 'Premier Chit Group Ltd', 'chit_fund_tenant_2')
ON DUPLICATE KEY UPDATE name=VALUES(name), db_name=VALUES(db_name);

-- Default passwords are encrypted bcrypt hashes (salt rounds = 10)
-- admin -> admin123
-- manager -> manager123
-- agent -> agent123
-- accountant -> accountant123
INSERT INTO users (username, password, name, role, tenant_id) VALUES
('admin', '$2a$10$tMhIe8sS/aXNveC7UoV5f.6H17yW38yMsc9L66j212c1F91j1m22O', 'Vijay Kumar', 'Super Admin', 'tenant_1'),
('manager', '$2a$10$wN1F1y1C48d2C/827O25yO5k8P18.c1h38v8212C12D2.z1v3w3vO', 'Suresh Kumar', 'Manager', 'tenant_2'),
('agent', '$2a$10$lU2B/Y.U54HwL82j2/58yO5o8p18.c1h38v8212C12D2.z1v3w3vO', 'Vijay Sharma', 'Collection Agent', 'tenant_1'),
('accountant', '$2a$10$pT2R/M.Z54HwL82k2/58yO5p8p18.c1h38v8212C12D2.z1v3w3vO', 'Meera Nair', 'Accountant', 'tenant_1')
ON DUPLICATE KEY UPDATE password=VALUES(password), name=VALUES(name), role=VALUES(role), tenant_id=VALUES(tenant_id);


-- 2. Tenant 1 Database
CREATE DATABASE IF NOT EXISTS chit_fund_tenant_1;
USE chit_fund_tenant_1;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  total_chits INT DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0.00,
  pending_amount DECIMAL(15,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'Paid'
);

CREATE TABLE IF NOT EXISTS chit_groups (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  value DECIMAL(15,2) NOT NULL,
  installments INT NOT NULL,
  monthly_contribution DECIMAL(15,2) NOT NULL,
  active_members INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS customer_chits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  chit_group_id VARCHAR(50),
  joined_date DATE,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id)
);

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
);

-- Seed Tenant 1
INSERT INTO chit_groups (id, name, value, installments, monthly_contribution, active_members) VALUES
('CH001', 'Gold Plan', 100000.00, 50, 2000.00, 50),
('CH002', 'Silver Plan', 50000.00, 25, 2000.00, 25),
('CH003', 'Diamond Plan', 500000.00, 50, 10000.00, 45)
ON DUPLICATE KEY UPDATE name=VALUES(name), value=VALUES(value), installments=VALUES(installments), monthly_contribution=VALUES(monthly_contribution), active_members=VALUES(active_members);

INSERT INTO customers (id, name, email, mobile, total_chits, paid_amount, pending_amount, status) VALUES
(1, 'Amit Patel', 'amit.patel@gmail.com', '9876543210', 2, 150000.00, 10000.00, 'Paid'),
(2, 'Priya Sharma', 'priya.s@yahoo.com', '9812345678', 1, 45000.00, 5000.00, 'Pending'),
(3, 'Rohan Verma', 'rohan.v@outlook.com', '9765432109', 3, 420000.00, 80000.00, 'Overdue'),
(4, 'Sunita Reddy', 'sunita.reddy@gmail.com', '9543210987', 1, 80000.00, 20000.00, 'Paid'),
(5, 'Vikram Singh', 'vikram.s@live.com', '9432109876', 2, 125000.00, 5000.00, 'Paid')
ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), mobile=VALUES(mobile), total_chits=VALUES(total_chits), paid_amount=VALUES(paid_amount), pending_amount=VALUES(pending_amount), status=VALUES(status);

INSERT INTO customer_chits (customer_id, chit_group_id, joined_date) VALUES
(1, 'CH001', '2026-01-10'),
(1, 'CH002', '2026-02-15'),
(2, 'CH001', '2026-01-12'),
(3, 'CH001', '2026-01-15'),
(3, 'CH002', '2026-02-15'),
(3, 'CH003', '2026-03-01'),
(4, 'CH001', '2026-01-20'),
(5, 'CH001', '2026-01-22'),
(5, 'CH002', '2026-02-18');

INSERT INTO collections (customer_id, customer_name, chit_group_id, amount, payment_method, payment_date, receipt_no, collected_by) VALUES
(1, 'Amit Patel', 'CH001', 2000.00, 'UPI', '2026-06-01', 'REC-2026-001', 'Vijay Sharma'),
(1, 'Amit Patel', 'CH002', 2000.00, 'UPI', '2026-06-02', 'REC-2026-002', 'Vijay Sharma'),
(2, 'Priya Sharma', 'CH001', 2000.00, 'Cash', '2026-06-05', 'REC-2026-003', 'Vijay Sharma'),
(3, 'Rohan Verma', 'CH003', 10000.00, 'Bank Transfer', '2026-06-08', 'REC-2026-004', 'Vijay Kumar'),
(4, 'Sunita Reddy', 'CH001', 2000.00, 'UPI', '2026-06-10', 'REC-2026-005', 'Vijay Sharma'),
(5, 'Vikram Singh', 'CH001', 2000.00, 'Cash', '2026-06-12', 'REC-2026-006', 'Vijay Sharma'),
(5, 'Vikram Singh', 'CH002', 2000.00, 'UPI', '2026-06-15', 'REC-2026-007', 'Vijay Sharma')
ON DUPLICATE KEY UPDATE amount=VALUES(amount), payment_method=VALUES(payment_method), payment_date=VALUES(payment_date), collected_by=VALUES(collected_by);


-- 3. Tenant 2 Database
CREATE DATABASE IF NOT EXISTS chit_fund_tenant_2;
USE chit_fund_tenant_2;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  total_chits INT DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0.00,
  pending_amount DECIMAL(15,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'Paid'
);

CREATE TABLE IF NOT EXISTS chit_groups (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  value DECIMAL(15,2) NOT NULL,
  installments INT NOT NULL,
  monthly_contribution DECIMAL(15,2) NOT NULL,
  active_members INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS customer_chits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  chit_group_id VARCHAR(50),
  joined_date DATE,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id)
);

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
);

-- Seed Tenant 2 (Different data to verify isolation)
INSERT INTO chit_groups (id, name, value, installments, monthly_contribution, active_members) VALUES
('CH001', 'Gold Plan', 100000.00, 50, 2000.00, 48),
('CH003', 'Diamond Plan', 500000.00, 50, 10000.00, 40)
ON DUPLICATE KEY UPDATE name=VALUES(name), value=VALUES(value), installments=VALUES(installments), monthly_contribution=VALUES(monthly_contribution), active_members=VALUES(active_members);

INSERT INTO customers (id, name, email, mobile, total_chits, paid_amount, pending_amount, status) VALUES
(1, 'John Doe', 'john.doe@gmail.com', '9999888877', 1, 95000.00, 5000.00, 'Paid'),
(2, 'Jane Smith', 'jane.smith@yahoo.com', '9888777766', 2, 210000.00, 40000.00, 'Pending'),
(3, 'Alice Cooper', 'alice.c@gmail.com', '9777666655', 1, 10000.00, 90000.00, 'Overdue')
ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), mobile=VALUES(mobile), total_chits=VALUES(total_chits), paid_amount=VALUES(paid_amount), pending_amount=VALUES(pending_amount), status=VALUES(status);

INSERT INTO customer_chits (customer_id, chit_group_id, joined_date) VALUES
(1, 'CH001', '2026-01-15'),
(2, 'CH001', '2026-01-18'),
(2, 'CH003', '2026-03-05'),
(3, 'CH001', '2026-02-01');

INSERT INTO collections (customer_id, customer_name, chit_group_id, amount, payment_method, payment_date, receipt_no, collected_by) VALUES
(1, 'John Doe', 'CH001', 2000.00, 'Cash', '2026-06-03', 'REC-T2-001', 'Suresh Kumar'),
(2, 'Jane Smith', 'CH001', 2000.00, 'UPI', '2026-06-04', 'REC-T2-002', 'Suresh Kumar'),
(2, 'Jane Smith', 'CH003', 10000.00, 'Bank Transfer', '2026-06-06', 'REC-T2-003', 'Suresh Kumar')
ON DUPLICATE KEY UPDATE amount=VALUES(amount), payment_method=VALUES(payment_method), payment_date=VALUES(payment_date), collected_by=VALUES(collected_by);

-- 4. Shared schema structures for reference (created inside Tenant DBs)
-- CREATE TABLE IF NOT EXISTS auctions (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   chit_group_id VARCHAR(50) NOT NULL,
--   installment_no INT NOT NULL,
--   auction_date DATE NOT NULL,
--   winning_bidder_id INT NOT NULL,
--   winning_bidder_name VARCHAR(100) NOT NULL,
--   bid_amount DECIMAL(15,2) NOT NULL,
--   dividend_amount DECIMAL(15,2) NOT NULL,
--   status VARCHAR(20) DEFAULT 'Completed',
--   FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id),
--   FOREIGN KEY (winning_bidder_id) REFERENCES customers(id)
-- );

-- CREATE TABLE IF NOT EXISTS payments (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   customer_id INT NOT NULL,
--   customer_name VARCHAR(100) NOT NULL,
--   chit_group_id VARCHAR(50) NOT NULL,
--   amount DECIMAL(15,2) NOT NULL,
--   payment_date DATE NOT NULL,
--   payment_method VARCHAR(50) NOT NULL,
--   transaction_ref VARCHAR(50) NOT NULL,
--   type VARCHAR(50) DEFAULT 'Chit Payout',
--   FOREIGN KEY (customer_id) REFERENCES customers(id),
--   FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id)
-- );

-- CREATE TABLE IF NOT EXISTS notifications (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   title VARCHAR(200) NOT NULL,
--   message TEXT NOT NULL,
--   created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   is_read BOOLEAN DEFAULT FALSE,
--   type VARCHAR(50) DEFAULT 'info'
-- );

