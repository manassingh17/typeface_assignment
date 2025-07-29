const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    lowercase: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  receipt: {
    type: String, // URL or path to the receipt image/PDF
    default: null
  },
  items: [{
    description: String,
    amount: Number
  }],
  merchant: {
    type: String,
    trim: true,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ user: 1, category: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction; 