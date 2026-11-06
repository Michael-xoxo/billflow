const express = require('express');
const router = express.Router();
const {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoiceStatus
} = require('../controllers/invoiceController');
const { authGuard } = require('../middleware/authGuard');
const rateLimiter = require('../middleware/rateLimiter');
const requireScope = require('../middleware/requireScope');

router.use(authGuard, rateLimiter);

router
  .route('/')
  .get(requireScope('invoices:read'), getInvoices)
  .post(requireScope('invoices:write'), createInvoice);

router
  .route('/:id')
  .get(requireScope('invoices:read'), getInvoiceById)
  .put(requireScope('invoices:write'), updateInvoiceStatus);

router.patch('/:id/status', requireScope('invoices:write'), updateInvoiceStatus);

module.exports = router;
