import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect as authMiddleware } from '../middleware/auth.js';
import toolExecutor from '../services/toolExecutor.js';
import CreditPool from '../models/CreditPool.js';

const router = express.Router();

/**
 * Direct wallet endpoints for mobile app
 * These endpoints wrap the existing credit management tool for simpler mobile integration
 */

// Get wallet balance
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Execute credit management tool to get balance
    const result = await toolExecutor.execute({
      toolName: 'credit_management',
      args: { action: 'check_balance' },
      userId
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to fetch balance'
      });
    }

    res.json({
      success: true,
      data: {
        balance: result.data.balance,
        currency: result.data.currency || 'USD',
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

      // Execute credit management tool to add funds
      const result = await toolExecutor.execute({
        toolName: 'credit_management',
        args: { 
          action: 'add_funds_stripe',
          amount,
          paymentMethodId
        },
        userId
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Failed to add funds'
        });
      }

      res.json({
        success: true,
        data: {
          transactionId: result.data.transactionId,
          amount: result.data.amount,
          newBalance: result.data.newBalance,
          status: result.data.status
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

    // Execute credit management tool to get transaction history
    const result = await toolExecutor.execute({
      toolName: 'credit_management',
      args: { 
        action: 'get_transactions',
        page: parseInt(page),
        limit: parseInt(limit)
      },
      userId
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to fetch transactions'
      });
    }

    res.json({
      success: true,
      data: {
        transactions: result.data.transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.data.total
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

    // Get balance and recent transactions in parallel
    const [balanceResult, transactionsResult] = await Promise.all([
      toolExecutor.execute({
        toolName: 'credit_management',
        args: { action: 'check_balance' },
        userId
      }),
      toolExecutor.execute({
        toolName: 'credit_management',
        args: { action: 'get_transactions', limit: 10 },
        userId
      })
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
        balance: balanceResult.data.balance,
        currency: balanceResult.data.currency || 'USD',
        recentTransactions: transactionsResult.data.transactions,
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