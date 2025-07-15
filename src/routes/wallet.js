import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect as authMiddleware } from '../middleware/auth.js';
import toolExecutor from '../services/toolExecutor.js';
import CreditPool from '../models/CreditPool.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * Direct wallet endpoints for mobile app
 * These endpoints wrap the existing credit management tool for simpler mobile integration
 */

// Get wallet balance
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user and credit pool for context
    const user = await User.findById(userId);
    const creditPool = await CreditPool.findOne({ userId: userId });
    
    const userContext = {
      userId: userId,
      user: user,
      creditPool: creditPool,
    };
    
    const toolCall = {
      function: {
        name: 'credit_management',
        arguments: { action: 'check_balance' },
      },
    };
    
    const result = await toolExecutor.executeToolCall(toolCall, userContext);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to fetch balance'
      });
    }

    res.json({
      success: true,
      data: {
        balance: result.result.balance,
        currency: result.result.currency || 'USD',
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Add funds via Stripe
router.post('/transactions', 
  authMiddleware,
  [
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('Amount must be at least $1'),
    body('paymentMethodId')
      .notEmpty()
      .withMessage('Payment method ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user.id;
      const { amount, paymentMethodId } = req.body;

      // Get user and credit pool for context
      const user = await User.findById(userId);
      const creditPool = await CreditPool.findOne({ userId: userId });
      
      const userContext = {
        userId: userId,
        user: user,
        creditPool: creditPool,
      };
      
      const toolCall = {
        function: {
          name: 'credit_management',
          arguments: { 
            action: 'add_funds_stripe',
            amount,
            paymentMethodId
          },
        },
      };

      const result = await toolExecutor.executeToolCall(toolCall, userContext);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Failed to add funds'
        });
      }

      res.json({
        success: true,
        data: {
          transactionId: result.result.transactionId,
          amount: result.result.amount,
          newBalance: result.result.newBalance,
          status: result.result.status
        }
      });

    } catch (error) {
      console.error('Add funds error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Get transaction history
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    // Get user and credit pool for context
    const user = await User.findById(userId);
    const creditPool = await CreditPool.findOne({ userId: userId });
    
    const userContext = {
      userId: userId,
      user: user,
      creditPool: creditPool,
    };
    
    const toolCall = {
      function: {
        name: 'credit_management',
        arguments: { 
          action: 'get_transactions',
          page: parseInt(page),
          limit: parseInt(limit)
        },
      },
    };

    const result = await toolExecutor.executeToolCall(toolCall, userContext);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to fetch transactions'
      });
    }

    res.json({
      success: true,
      data: {
        transactions: result.result.transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.result.total
        }
      }
    });

  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get wallet summary (balance + recent transactions)
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user and credit pool for context
    const user = await User.findById(userId);
    const creditPool = await CreditPool.findOne({ userId: userId });
    
    const userContext = {
      userId: userId,
      user: user,
      creditPool: creditPool,
    };

    // Get balance and recent transactions in parallel
    const [balanceResult, transactionsResult] = await Promise.all([
      toolExecutor.executeToolCall({
        function: {
          name: 'credit_management',
          arguments: { action: 'check_balance' },
        },
      }, userContext),
      toolExecutor.executeToolCall({
        function: {
          name: 'credit_management',
          arguments: { action: 'get_transactions', limit: 10 },
        },
      }, userContext)
    ]);

    if (!balanceResult.success || !transactionsResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch wallet summary'
      });
    }

    res.json({
      success: true,
      data: {
        balance: balanceResult.result.balance,
        currency: balanceResult.result.currency || 'USD',
        recentTransactions: transactionsResult.result.transactions,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Wallet summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;