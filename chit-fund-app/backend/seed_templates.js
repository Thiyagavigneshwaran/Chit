import { getTenantPool } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

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
  { month: 7, actualAmount: 16400, payingAmount: 14800, bidAmount: 36000, repaymentAmount: 1600 },
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

const run = async () => {
  try {
    const tenants = ['tenant_1', 'tenant_2'];
    
    for (const tenantId of tenants) {
      console.log(`Seeding default chit templates in ${tenantId}...`);
      const db = await getTenantPool(tenantId);
      
      for (const item of seedData) {
        await db.query(`
          INSERT INTO chit_templates (name, value, installments, monthly_contribution, installment_schedule)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            value = VALUES(value),
            installments = VALUES(installments),
            monthly_contribution = VALUES(monthly_contribution),
            installment_schedule = VALUES(installment_schedule)
        `, [item.name, item.value, item.installments, item.monthly, JSON.stringify(item.schedule)]);
      }
      console.log(`✅ Templates seeded successfully for ${tenantId}`);
    }
  } catch (err) {
    console.error('Failed to seed templates:', err);
  } finally {
    process.exit(0);
  }
};

run();
