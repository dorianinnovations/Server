import mongoose from "mongoose";

const creditPoolSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD'],
  },
  stripeCustomerId: {
    type: String,
    default: null,
  },
  paymentMethods: [{
    id: {
      type: String,
      required: true,
    },
    stripePaymentMethodId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['credit_card', 'debit_card', 'bank_account', 'paypal'],
    },
    last4: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiryDate: {
      type: Date,
    },
    metadata: {
      type: Object,
      default: {},
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  transactions: [{
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['credit', 'debit', 'refund', 'fee'],
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    toolName: {
      type: String,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    paymentMethodId: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    metadata: {
      type: Object,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  settings: {
    autoRecharge: {
      enabled: {
        type: Boolean,
        default: false,
      },
      threshold: {
        type: Number,
        default: 10,
      },
      amount: {
        type: Number,
        default: 50,
      },
      paymentMethodId: {
        type: String,
      },
    },
    spendingLimits: {
      daily: {
        type: Number,
        default: 100,
      },
      weekly: {
        type: Number,
        default: 500,
      },
      monthly: {
        type: Number,
        default: 1000,
      },
      perTransaction: {
        type: Number,
        default: 50,
      },
    },
    notifications: {
      lowBalance: {
        type: Boolean,
        default: true,
      },
      transactions: {
        type: Boolean,
        default: true,
      },
      spendingLimits: {
        type: Boolean,
        default: true,
      },
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// userId index automatically created by unique: true in schema
creditPoolSchema.index({ 'transactions.timestamp': -1 });
creditPoolSchema.index({ 'transactions.type': 1 });

creditPoolSchema.methods.canSpend = function(amount) {
  if (!this.isActive || !this.isVerified) return false;
  if (this.balance < amount) return false;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentTransactions = this.transactions.filter(t => 
    t.type === 'debit' && t.status === 'completed'
  );
  
  const dailySpent = recentTransactions
    .filter(t => t.timestamp >= today)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const weeklySpent = recentTransactions
    .filter(t => t.timestamp >= weekAgo)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const monthlySpent = recentTransactions
    .filter(t => t.timestamp >= monthAgo)
    .reduce((sum, t) => sum + t.amount, 0);
  
  return (
    amount <= this.settings.spendingLimits.perTransaction &&
    dailySpent + amount <= this.settings.spendingLimits.daily &&
    weeklySpent + amount <= this.settings.spendingLimits.weekly &&
    monthlySpent + amount <= this.settings.spendingLimits.monthly
  );
};

creditPoolSchema.methods.deductBalance = function(amount, description, toolName, taskId) {
  if (!this.canSpend(amount)) {
    throw new Error('Insufficient balance or spending limit exceeded');
  }
  
  this.balance -= amount;
  this.transactions.push({
    id: new mongoose.Types.ObjectId().toString(),
    type: 'debit',
    amount: amount,
    description: description,
    toolName: toolName,
    taskId: taskId,
    status: 'completed',
  });
  
  return this.save();
};

creditPoolSchema.methods.addBalance = function(amount, description, paymentMethodId) {
  this.balance += amount;
  this.transactions.push({
    id: new mongoose.Types.ObjectId().toString(),
    type: 'credit',
    amount: amount,
    description: description,
    paymentMethodId: paymentMethodId,
    status: 'completed',
  });
  
  return this.save();
};

export default mongoose.model("CreditPool", creditPoolSchema);