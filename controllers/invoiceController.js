const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const {
  calculateLineTotal,
  calculateInvoiceTotals
} = require('../utils/financialMath');
const { streamInvoicePDF } = require('../services/pdfService');

async function createInvoice(req, res) {
  try {
    const {
      customer,
      customerId,
      invoiceNumber,
      status,
      currency,
      lineItems,
      taxPercent = 0,
      dueDate,
      paidAt
    } = req.body;

    const resolvedCustomerId = customer || customerId;
    if (!resolvedCustomerId) {
      return res.status(400).json({ message: 'Customer reference is required' });
    }

    const existingCustomer = await Customer.findOne({
      _id: resolvedCustomerId,
      user: req.user._id
    });
    if (!existingCustomer) {
      return res.status(404).json({ message: 'Customer not found for this user' });
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ message: 'At least one line item is required' });
    }

    const computedLineItems = lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: calculateLineTotal(item.quantity, item.unitPriceCents)
    }));

    const { subtotalCents, taxCents, totalCents } = calculateInvoiceTotals(
      computedLineItems,
      taxPercent
    );

    const invoiceData = {
      user: req.user._id,
      customer: resolvedCustomerId,
      status: status || 'draft',
      currency: currency || 'usd',
      lineItems: computedLineItems,
      subtotalCents,
      taxPercent,
      taxCents,
      totalCents
    };

    if (invoiceNumber) {
      invoiceData.invoiceNumber = invoiceNumber;
    }
    if (dueDate) {
      invoiceData.dueDate = dueDate;
    }
    if (paidAt) {
      invoiceData.paidAt = new Date(paidAt);
    } else if (invoiceData.status === 'paid') {
      invoiceData.paidAt = new Date();
    }

    const invoice = await Invoice.create(invoiceData);
    return res.status(201).json(invoice);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function getInvoices(req, res) {
  try {
    const invoices = await Invoice.find({ user: req.user._id })
      .populate('customer', 'name email company')
      .sort({ createdAt: -1 });
    return res.status(200).json(invoices);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getInvoiceById(req, res) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('customer', 'name email company');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    return res.status(200).json(invoice);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function updateInvoiceStatus(req, res) {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (status) {
      invoice.status = status;
      if (status === 'paid' && !invoice.paidAt) {
        invoice.paidAt = new Date();
      }
      if (status === 'void' && !invoice.voidedAt) {
        invoice.voidedAt = new Date();
      }
    }

    await invoice.save();
    return res.status(200).json(invoice);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function voidInvoice(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: 'Invoice not found',
        message: 'Invoice not found'
      });
    }

    const updatedInvoice = await Invoice.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
        status: { $in: ['draft', 'pending'] }
      },
      {
        $set: {
          status: 'void',
          voidedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    ).populate('customer', 'name email company');

    if (updatedInvoice) {
      return res.status(200).json(updatedInvoice);
    }

    const existingInvoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('customer', 'name email company');

    if (!existingInvoice) {
      return res.status(404).json({
        error: 'Invoice not found',
        message: 'Invoice not found'
      });
    }

    if (existingInvoice.status === 'paid') {
      return res.status(400).json({
        error: 'Cannot void an invoice that is already paid',
        message: 'Cannot void an invoice that is already paid'
      });
    }

    if (existingInvoice.status === 'void') {
      return res.status(400).json({
        error: 'Invoice is already voided',
        message: 'Invoice is already voided'
      });
    }

    return res.status(400).json({
      error: `Cannot void invoice with status ${existingInvoice.status}`,
      message: `Cannot void invoice with status ${existingInvoice.status}`
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      message: error.message
    });
  }
}

async function downloadInvoicePDF(req, res) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id
    })
      .populate('customer', 'name email company')
      .populate('user', 'name email');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.status(200);
    return streamInvoicePDF(invoice, res);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  voidInvoice,
  downloadInvoicePDF
};
