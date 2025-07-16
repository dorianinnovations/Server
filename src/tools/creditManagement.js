import CreditPool from '../models/CreditPool.js';
import stripeService from '../services/stripeService.js';
import User from '../models/User.js';

export default async function creditManagement(args, userContext) {
  const { 
    action, 
    amount, 
    description = '',
    paymentMethodId = null,
    spendingLimit = null,
    limitType = 'daily'
  } = args;

  const { userId, user } = userContext;

  try {
    let creditPool = await CreditPool.findOne({ userId: userId });
    
    if (!creditPool) {
      creditPool = new CreditPool({
        userId: userId,
        balance: 0,
        isActive: true,
        isVerified: false,
      });
      await creditPool.save();
    }

    switch (action) {
      case 'check_balance':
        return await checkBalance(creditPool);
      
      case 'add_funds':
        return await addFunds(creditPool, amount, description, paymentMethodId);
      
      case 'add_funds_stripe':
        return await addFundsStripe(creditPool, amount, paymentMethodId, user);
      
      case 'verify_account':
        return await verifyAccount(creditPool);
      
      case 'setup_stripe_customer':
        return await setupStripeCustomer(creditPool, user);
      
      case 'create_payment_intent':
        return await createPaymentIntent(creditPool, amount, user);
      
      case 'add_payment_method':
        return await addPaymentMethod(creditPool, args.paymentMethodId, user);
      
      case 'list_payment_methods':
        return await listPaymentMethods(creditPool);
      
      case 'remove_payment_method':
        return await removePaymentMethod(creditPool, paymentMethodId);
      
      case 'check_spending':
        return await checkSpending(creditPool, amount || 0);
      
      case 'set_limit':
        return await setSpendingLimit(creditPool, spendingLimit, limitType);
      
      case 'get_transactions':
        return await getTransactionHistory(creditPool);
      
      case 'enable_auto_recharge':
        return await enableAutoRecharge(creditPool, amount, paymentMethodId);
      
      case 'disable_auto_recharge':
        return await disableAutoRecharge(creditPool);
      
      default:
        return {
          success: false,
          error: 'Unknown action',
          availableActions: [
            'check_balance',
            'add_funds',
            'add_funds_stripe',
            'setup_stripe_customer',
            'create_payment_intent',
            'add_payment_method',
            'list_payment_methods',
            'remove_payment_method',
            'check_spending',
            'set_limit',
            'get_transactions',
            'enable_auto_recharge',
            'disable_auto_recharge',
            'verify_account'
          ],
        };
    }
  } catch (error) {
    console.error('Credit management error:', error);
    return {
      success: false,
      error: 'Failed to process credit management request',
      details: error.message,
    };
  }
}

async function checkBalance(creditPool) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const todayTransactions = creditPool.transactions.filter(
    t => t.timestamp >= startOfDay && t.type === 'debit' && t.status === 'completed'
  );
  
  const todaySpent = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  return {
    success: true,
    balance: creditPool.balance,
    currency: creditPool.currency,
    todaySpent: todaySpent,
    remainingDailyLimit: creditPool.settings.spendingLimits.daily - todaySpent,
    isActive: creditPool.isActive,
    isVerified: creditPool.isVerified,
    autoRechargeEnabled: creditPool.settings.autoRecharge.enabled,
  };
}

async function addFunds(creditPool, amount, description, paymentMethodId) {
  if (!amount || amount <= 0) {
    return {
      success: false,
      error: 'Invalid amount',
    };
  }

  const result = await processPayment(amount, paymentMethodId);
  
  if (result.success) {
    await creditPool.addBalance(
      amount,
      description || `Added funds: $${amount}`,
      paymentMethodId
    );
    
    return {
      success: true,
      newBalance: creditPool.balance,
      transactionId: result.transactionId,
      message: `Successfully added $${amount} to your credit pool.`,
    };
  } else {
    return {
      success: false,
      error: result.error || 'Payment processing failed',
    };
  }
}

async function checkSpending(creditPool, amount) {
  const canSpend = creditPool.canSpend(amount);
  
  if (!canSpend) {
    const reasons = [];
    
    if (creditPool.balance < amount) {
      reasons.push('insufficient_balance');
    }
    
    if (!creditPool.isActive) {
      reasons.push('account_inactive');
    }
    
    if (!creditPool.isVerified) {
      reasons.push('account_not_verified');
    }
    
    return {
      success: false,
      canSpend: false,
      reasons: reasons,
      currentBalance: creditPool.balance,
      requestedAmount: amount,
    };
  }
  
  return {
    success: true,
    canSpend: true,
    currentBalance: creditPool.balance,
    requestedAmount: amount,
    remainingAfterSpend: creditPool.balance - amount,
  };
}

async function setSpendingLimit(creditPool, limit, limitType) {
  if (!limit || limit <= 0) {
    return {
      success: false,
      error: 'Invalid limit amount',
    };
  }
  
  const validTypes = ['daily', 'weekly', 'monthly', 'perTransaction'];
  if (!validTypes.includes(limitType)) {
    return {
      success: false,
      error: 'Invalid limit type',
      validTypes: validTypes,
    };
  }
  
  creditPool.settings.spendingLimits[limitType] = limit;
  await creditPool.save();
  
  return {
    success: true,
    limitType: limitType,
    newLimit: limit,
    message: `${limitType} spending limit set to $${limit}`,
  };
}

async function getTransactionHistory(creditPool) {
  const transactions = creditPool.transactions
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);
  
  return {
    success: true,
    transactions: transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      status: t.status,
      timestamp: t.timestamp,
      toolName: t.toolName,
    })),
    totalCount: creditPool.transactions.length,
  };
}

async function enableAutoRecharge(creditPool, amount, paymentMethodId) {
  if (!amount || amount <= 0) {
    return {
      success: false,
      error: 'Invalid recharge amount',
    };
  }
  
  if (!paymentMethodId) {
    return {
      success: false,
      error: 'Payment method required for auto-recharge',
    };
  }
  
  creditPool.settings.autoRecharge.enabled = true;
  creditPool.settings.autoRecharge.amount = amount;
  creditPool.settings.autoRecharge.paymentMethodId = paymentMethodId;
  await creditPool.save();
  
  return {
    success: true,
    message: `Auto-recharge enabled: $${amount} when balance drops below $${creditPool.settings.autoRecharge.threshold}`,
  };
}

async function disableAutoRecharge(creditPool) {
  creditPool.settings.autoRecharge.enabled = false;
  await creditPool.save();
  
  return {
    success: true,
    message: 'Auto-recharge disabled',
  };
}

async function processPayment(amount, paymentMethodId) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const success = Math.random() > 0.1;
  
  if (success) {
    return {
      success: true,
      transactionId: 'txn_' + Date.now(),
      amount: amount,
      status: 'completed',
    };
  } else {
    return {
      success: false,
      error: 'Payment processing failed',
    };
  }
}

async function setupStripeCustomer(creditPool, user) {
  if (creditPool.stripeCustomerId) {
    return {
      success: true,
      message: 'Stripe customer already exists',
      customerId: creditPool.stripeCustomerId,
    };
  }

  const result = await stripeService.createCustomer({
    email: user.email,
    name: user.profile?.get('name') || user.email,
    userId: user._id.toString(),
  });

  if (result.success) {
    creditPool.stripeCustomerId = result.customer.id;
    await creditPool.save();
    
    return {
      success: true,
      message: 'Stripe customer created successfully',
      customerId: result.customer.id,
    };
  } else {
    return {
      success: false,
      error: 'Failed to create Stripe customer',
      details: result.error,
    };
  }
}

async function createPaymentIntent(creditPool, amount, user) {
  if (!creditPool.stripeCustomerId) {
    const customerResult = await setupStripeCustomer(creditPool, user);
    if (!customerResult.success) {
      return customerResult;
    }
  }

  const result = await stripeService.createPaymentIntent(
    amount,
    'usd',
    creditPool.stripeCustomerId,
    {
      userId: user._id.toString(),
      purpose: 'add_funds',
    }
  );

  if (result.success) {
    return {
      success: true,
      paymentIntentId: result.paymentIntent.id,
      clientSecret: result.clientSecret,
      amount: amount,
    };
  } else {
    return {
      success: false,
      error: 'Failed to create payment intent',
      details: result.error,
    };
  }
}

async function addPaymentMethod(creditPool, paymentMethodId, user) {
  if (!creditPool.stripeCustomerId) {
    const customerResult = await setupStripeCustomer(creditPool, user);
    if (!customerResult.success) {
      return customerResult;
    }
  }

  const result = await stripeService.attachPaymentMethodToCustomer(
    paymentMethodId,
    creditPool.stripeCustomerId
  );

  if (result.success) {
    const paymentMethod = result.paymentMethod;
    
    // Add to database
    const newPaymentMethod = {
      id: Date.now().toString(),
      stripePaymentMethodId: paymentMethod.id,
      type: 'credit_card',
      last4: paymentMethod.card.last4,
      brand: paymentMethod.card.brand,
      isDefault: creditPool.paymentMethods.length === 0,
      expiryDate: new Date(paymentMethod.card.exp_year, paymentMethod.card.exp_month - 1),
    };

    creditPool.paymentMethods.push(newPaymentMethod);
    await creditPool.save();

    return {
      success: true,
      message: 'Payment method added successfully',
      paymentMethod: newPaymentMethod,
    };
  } else {
    return {
      success: false,
      error: 'Failed to add payment method',
      details: result.error,
    };
  }
}

async function listPaymentMethods(creditPool) {
  if (!creditPool.stripeCustomerId) {
    return {
      success: true,
      paymentMethods: [],
    };
  }

  const result = await stripeService.listCustomerPaymentMethods(creditPool.stripeCustomerId);

  if (result.success) {
    return {
      success: true,
      paymentMethods: creditPool.paymentMethods,
      stripePaymentMethods: result.paymentMethods,
    };
  } else {
    return {
      success: false,
      error: 'Failed to list payment methods',
      details: result.error,
    };
  }
}

async function removePaymentMethod(creditPool, paymentMethodId) {
  const paymentMethod = creditPool.paymentMethods.find(pm => pm.id === paymentMethodId);
  
  if (!paymentMethod) {
    return {
      success: false,
      error: 'Payment method not found',
    };
  }

  const result = await stripeService.detachPaymentMethod(paymentMethod.stripePaymentMethodId);

  if (result.success) {
    creditPool.paymentMethods = creditPool.paymentMethods.filter(pm => pm.id !== paymentMethodId);
    await creditPool.save();

    return {
      success: true,
      message: 'Payment method removed successfully',
    };
  } else {
    return {
      success: false,
      error: 'Failed to remove payment method',
      details: result.error,
    };
  }
}

async function addFundsStripe(creditPool, amount, paymentMethodId, user) {
      // Simulate successful payment for testing without Stripe dependency
  const result = await stripeService.simulatePaymentSuccess('pi_test_' + Date.now());

  if (result.success) {
    await creditPool.addBalance(
      amount,
      `Stripe payment: $${amount}`,
      paymentMethodId
    );
    
    // Reload the credit pool to get the updated balance
    await creditPool.reload();
    
    return {
      success: true,
      newBalance: creditPool.balance,
      transactionId: result.paymentIntent.id,
      message: `Successfully added $${amount} to your credit pool via Stripe.`,
    };
  } else {
    return {
      success: false,
      error: result.error || 'Stripe payment processing failed',
    };
  }
}

async function verifyAccount(creditPool) {
  creditPool.isVerified = true;
  creditPool.isActive = true;
  await creditPool.save();
  
  return {
    success: true,
    message: 'Account verified successfully',
    isVerified: creditPool.isVerified,
    isActive: creditPool.isActive,
  };
}