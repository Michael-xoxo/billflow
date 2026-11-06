require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const WebhookEvent = require('./models/WebhookEvent');
const ApiKey = require('./models/ApiKey');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'billflow-financial-engine' });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/analytics', analyticsRoutes);

if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, 'client/dist');
  app.use(express.static(clientDistPath));

  app.get('/{*splat}', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ message: 'API endpoint not found' });
    }
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

async function connectDB() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not defined');
  }
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([WebhookEvent.init(), ApiKey.init()]);
}

if (require.main === module) {
  connectDB()
    .then(() => {
      console.log('MongoDB connected & indexes initialized');
      app.listen(PORT, () => {
        console.log(`BillFlow server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize server:', err.message);
      process.exit(1);
    });
}

module.exports = { app, connectDB };
