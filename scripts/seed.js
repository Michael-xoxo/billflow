require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const ApiKey = require('../models/ApiKey');
const WebhookEvent = require('../models/WebhookEvent');

const DEMO_EMAIL = 'demo@billflow.io';
const DEMO_PASSWORD = 'Password123!';

async function seedDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not defined');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for seeding...');

  try {
    // Idempotent cleanup of existing demo user records
    const existingDemoUser = await User.findOne({ email: DEMO_EMAIL });
    if (existingDemoUser) {
      await Promise.all([
        Invoice.deleteMany({ user: existingDemoUser._id }),
        Customer.deleteMany({ user: existingDemoUser._id }),
        ApiKey.deleteMany({ user: existingDemoUser._id }),
        WebhookEvent.deleteMany({ eventId: { $in: ['evt_seed_recent_001', 'evt_seed_historical_002'] } }),
        User.deleteOne({ _id: existingDemoUser._id })
      ]);
      console.log('Cleared previous demo records for', DEMO_EMAIL);
    }

    // 1. Create Demo Contractor Account
    const demoUser = await User.create({
      name: 'BillFlow Demo Contractor',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      role: 'admin'
    });
    console.log('Seeded Demo User:', demoUser.email, `(_id: ${demoUser._id})`);

    // 2. Create 2 Customers ("Starlight AI", "Apex Systems")
    const [starlight, apex] = await Customer.create([
      {
        user: demoUser._id,
        name: 'Starlight AI',
        email: 'billing@starlight.ai',
        company: 'Starlight AI Labs'
      },
      {
        user: demoUser._id,
        name: 'Apex Systems',
        email: 'accounts@apexsystems.io',
        company: 'Apex Enterprise Systems'
      }
    ]);
    console.log('Seeded Customers:', starlight.name, '&', apex.name);

    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const dueIn14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const dueIn30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 3. Create 4 Invoices using pure integer cents
    const invoices = await Invoice.create([
      {
        user: demoUser._id,
        customer: starlight._id,
        invoiceNumber: 'INV-2026-1001',
        status: 'paid',
        currency: 'usd',
        lineItems: [
          {
            description: 'Dedicated GPU Cluster Retainer',
            quantity: 2,
            unitPriceCents: 25000,
            totalCents: 50000
          }
        ],
        subtotalCents: 50000,
        taxPercent: 10,
        taxCents: 5000,
        totalCents: 55000,
        dueDate: now,
        paidAt: fiveDaysAgo
      },
      {
        user: demoUser._id,
        customer: apex._id,
        invoiceNumber: 'INV-2026-1002',
        status: 'paid',
        currency: 'usd',
        lineItems: [
          {
            description: 'Q3 Security Architecture Audit',
            quantity: 1,
            unitPriceCents: 30000,
            totalCents: 30000
          }
        ],
        subtotalCents: 30000,
        taxPercent: 0,
        taxCents: 0,
        totalCents: 30000,
        dueDate: fortyFiveDaysAgo,
        paidAt: fortyFiveDaysAgo
      },
      {
        user: demoUser._id,
        customer: starlight._id,
        invoiceNumber: 'INV-2026-1003',
        status: 'pending',
        currency: 'usd',
        lineItems: [
          {
            description: 'Webhook Telemetry Pipeline Integration',
            quantity: 3,
            unitPriceCents: 12000,
            totalCents: 36000
          }
        ],
        subtotalCents: 36000,
        taxPercent: 5,
        taxCents: 1800,
        totalCents: 37800,
        dueDate: dueIn14Days,
        paidAt: null
      },
      {
        user: demoUser._id,
        customer: apex._id,
        invoiceNumber: 'INV-2026-1004',
        status: 'draft',
        currency: 'usd',
        lineItems: [
          {
            description: 'Custom PDF Branding Package',
            quantity: 1,
            unitPriceCents: 15000,
            totalCents: 15000
          }
        ],
        subtotalCents: 15000,
        taxPercent: 0,
        taxCents: 0,
        totalCents: 15000,
        dueDate: dueIn30Days,
        paidAt: null
      }
    ]);

    console.log(
      `Seeded ${invoices.length} Invoices:`,
      invoices.map((i) => `${i.invoiceNumber} (${i.status}: ${i.totalCents}c)`).join(', ')
    );
    console.log('Database seeding completed successfully.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
