const express = require('express');
const router = express.Router();
const {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoiceStatus
} = require('../controllers/invoiceController');
const { authMiddleware } = require('../utils/authMiddleware');

router.use(authMiddleware);

router.route('/').post(createInvoice).get(getInvoices);
router.route('/:id').get(getInvoiceById).put(updateInvoiceStatus);
router.patch('/:id/status', updateInvoiceStatus);

module.exports = router;
