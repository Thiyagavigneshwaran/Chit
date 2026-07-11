import express from 'express';
import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { authenticateJWT } from './auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { mainPool } from '../db.js';

dotenv.config();

const router = express.Router();

const dbHost = process.env.DB_HOST || 'localhost';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';

// Node-native function to generate MySQL SQL Dump string
const generateSqlDump = async (dbName) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName
    });

    let dump = `-- Antigravity Chit-Fund Database Backup Dump\n`;
    dump += `-- Database: ${dbName}\n`;
    dump += `-- Generated: ${new Date().toISOString()}\n`;
    dump += `-- ------------------------------------------------------\n\n`;
    dump += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

    // Query tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableKey = `Tables_in_${dbName}`;

    for (const tableRow of tables) {
      const tableName = tableRow[tableKey];

      // DDL: SHOW CREATE TABLE
      const [createTableRows] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createTableSql = createTableRows[0]['Create Table'];

      dump += `--\n-- Table structure for table \`${tableName}\`\n--\n\n`;
      dump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      dump += `${createTableSql};\n\n`;

      // Data: SELECT * FROM table
      const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
      if (rows.length > 0) {
        dump += `--\n-- Dumping data for table \`${tableName}\`\n--\n\n`;
        dump += `LOCK TABLES \`${tableName}\` WRITE;\n`;

        for (const row of rows) {
          const keys = Object.keys(row);
          const escapedValues = keys.map(key => {
            const val = row[key];
            if (val === null || val === undefined) {
              return 'NULL';
            }
            if (typeof val === 'number') {
              return val;
            }
            if (typeof val === 'boolean') {
              return val ? 1 : 0;
            }
            if (val instanceof Date) {
              return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            }
            if (typeof val === 'object') {
              if (Buffer.isBuffer(val)) {
                return `X'${val.toString('hex')}'`;
              }
              // Handle JSON structures
              const jsonStr = JSON.stringify(val);
              const escapedJson = jsonStr
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
              return `'${escapedJson}'`;
            }
            // Strings and other types
            const escapedStr = String(val)
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "\\'")
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r');
            return `'${escapedStr}'`;
          });
          const columns = keys.map(k => '`' + k + '`').join(', ');
          dump += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${escapedValues.join(', ')});\n`;
        }
        dump += `UNLOCK TABLES;\n\n`;
      }
    }

    dump += `SET FOREIGN_KEY_CHECKS=1;\n`;
    return dump;
  } catch (error) {
    console.error(`Error generating SQL dump for ${dbName}:`, error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

// Helper to check and list Windows drive letters
const getWindowsDrives = async () => {
  const drives = [];
  const driveLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < driveLetters.length; i++) {
    const drive = `${driveLetters[i]}:\\`;
    try {
      await fs.access(drive);
      drives.push({ name: drive, path: drive });
    } catch (e) {
      // Drive doesn't exist
    }
  }
  return drives;
};

// Helper to list and filter directory folders
const browseDirectories = async (currentPath) => {
  if (!currentPath) {
    return await getWindowsDrives();
  }

  let targetPath = path.normalize(currentPath);
  
  if (/^[A-Z]:$/i.test(targetPath)) {
    targetPath += '\\';
  }

  try {
    const items = await fs.readdir(targetPath, { withFileTypes: true });
    const subdirs = [];

    // Parent folder navigation option
    const parentDir = path.dirname(targetPath);
    if (parentDir !== targetPath) {
      subdirs.push({
        name: '.. (Parent Folder)',
        path: parentDir.endsWith('\\') || parentDir.endsWith('/') ? parentDir : parentDir + path.sep
      });
    }

    for (const item of items) {
      try {
        if (item.isDirectory() && !item.name.startsWith('$') && !item.name.startsWith('.')) {
          const fullPath = path.join(targetPath, item.name);
          subdirs.push({
            name: item.name,
            path: fullPath.endsWith('\\') || fullPath.endsWith('/') ? fullPath : fullPath + path.sep
          });
        }
      } catch (err) {
        // Skip inaccessible folders
      }
    }
    return subdirs;
  } catch (error) {
    // Autocomplete logic fallback: search parent directory matching prefix
    try {
      const parentDir = path.dirname(targetPath);
      const partialName = path.basename(targetPath).toLowerCase();

      const items = await fs.readdir(parentDir, { withFileTypes: true });
      const subdirs = [];

      for (const item of items) {
        if (item.isDirectory() && item.name.toLowerCase().startsWith(partialName) && !item.name.startsWith('$')) {
          const fullPath = path.join(parentDir, item.name);
          subdirs.push({
            name: item.name,
            path: fullPath.endsWith('\\') || fullPath.endsWith('/') ? fullPath : fullPath + path.sep
          });
        }
      }
      return subdirs;
    } catch (err2) {
      return [];
    }
  }
};

// POST: Browse/autocomplete local directories
router.post('/browse-directories', authenticateJWT, async (req, res) => {
  const { currentPath } = req.body;
  try {
    const suggestions = await browseDirectories(currentPath);
    res.json(suggestions);
  } catch (error) {
    res.json([]);
  }
});

// POST: Backup database and store on local system path
router.post('/export', authenticateJWT, resolveTenant, async (req, res) => {
  const { directoryPath, type } = req.body;

  if (!directoryPath) {
    return res.status(400).json({ message: 'Target directory path is required.' });
  }

  try {
    let dbName = '';
    const activeYear = req.year || '2026';

    if (type === 'main') {
      dbName = 'chit_fund_main';
    } else {
      // default: active year tenant db
      const [rows] = await mainPool.query('SELECT db_name FROM tenants WHERE id = ?', [req.user.tenant_id]);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Tenant database not found.' });
      }
      dbName = `${rows[0].db_name}_${activeYear}`;
    }

    console.log(`Starting local path backup for database '${dbName}' to directory: ${directoryPath}`);

    // Generate dump content
    const dumpContent = await generateSqlDump(dbName);

    // Verify and create target folder path
    const normalizedPath = path.normalize(directoryPath);
    await fs.mkdir(normalizedPath, { recursive: true });

    // Build backup file name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${dbName}_${timestamp}.sql`;
    const fullPath = path.join(normalizedPath, fileName);

    // Save the file
    await fs.writeFile(fullPath, dumpContent, 'utf8');

    res.json({
      message: `Database backup for ${dbName} completed successfully!`,
      filePath: fullPath,
      fileName: fileName
    });
  } catch (error) {
    console.error('Error saving local backup:', error);
    res.status(500).json({ message: `Failed to save backup: ${error.message}` });
  }
});

// GET: Direct browser SQL download stream
router.get('/download', authenticateJWT, resolveTenant, async (req, res) => {
  const { type } = req.query;

  try {
    let dbName = '';
    const activeYear = req.year || '2026';

    if (type === 'main') {
      dbName = 'chit_fund_main';
    } else {
      // default: active year tenant db
      const [rows] = await mainPool.query('SELECT db_name FROM tenants WHERE id = ?', [req.user.tenant_id]);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Tenant database not found.' });
      }
      dbName = `${rows[0].db_name}_${activeYear}`;
    }

    console.log(`Streaming browser download of backup for database: ${dbName}`);

    const dumpContent = await generateSqlDump(dbName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${dbName}_${timestamp}.sql`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(dumpContent);
  } catch (error) {
    console.error('Error streaming backup download:', error);
    res.status(500).json({ message: `Backup generation failed: ${error.message}` });
  }
});

export default router;
