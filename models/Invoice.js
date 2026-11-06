const mongoose = require('mongoose');
const {
  calculateLineTotal,
  calculateInvoiceTotals
} = require('../utils/financialMath');

const integerValidator = {
  validator: function (val) {
    return typeof val === 'number' && Number.isInteger(val) && val >= 0;
  },
  message: (props) => `${props.path} must be a non-negative whole integer in cents (got ${props.value})`
};

const positiveIntegerValidator = {
  validator: function (val) {
    return typeof val === 'number' && Number.isInteger(val) && val > 0;
  },
  message: (props) => `${props.path} must be a positive whole integer (got ${props.value})`
};

const lineItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Line item description is required'],
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Line item quantity is required'],
      validate: positiveIntegerValidator
    },
    unitPriceCents: {
      type: Number,
      required: [true, 'Line item unitPriceCents is required'],
      validate: integerValidator
    },
    totalCents: {
      type: Number,
      required: true,
      validate: integerValidator
    }
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required'],
      index: true
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      trim: true,
      default: function () {
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `INV-${new Date().getFullYear()}-${rand}`;
      }
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'paid', 'void'],
      default: 'draft'
    },
    currency: {
      type: String,
      lowercase: true,
      trim: true,
      default: 'usd'
    },
    lineItems: {
      type: [lineItemSchema],
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'Invoice must contain at least one line item'
      }
    },
    subtotalCents: {
      type: Number,
      required: true,
      validate: integerValidator
    },
    taxPercent: {
      type: Number,
      default: 0,
      min: [0, 'taxPercent cannot be negative']
    },
    taxCents: {
      type: Number,
      required: true,
      validate: integerValidator
    },
    totalCents: {
      type: Number,
      required: true,
      validate: integerValidator
    },
    dueDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    paidAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

invoiceSchema.pre('validate', function () {
  if (Array.isArray(this.lineItems) && this.lineItems.length > 0) {
    for (let i = 0; i < this.lineItems.length; i++) {
      const item = this.lineItems[i];
      item.totalCents = calculateLineTotal(item.quantity, item.unitPriceCents);
    }
    const taxRate = this.taxPercent !== undefined && this.taxPercent !== null ? this.taxPercent : 0;
    const { subtotalCents, taxCents, totalCents } = calculateInvoiceTotals(this.lineItems, taxRate);
    this.subtotalCents = subtotalCents;
    this.taxCents = taxCents;
    this.totalCents = totalCents;
  }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
