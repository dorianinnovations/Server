import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';
import CreditPool from '../models/CreditPool.js';

const router = express.Router();

// Get subscription status
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const trace = user.subscription?.numinaTrace || {};
    
    res.json({
      success: true,
      data: {
        numinaTrace: {
          isActive: trace.isActive || false,
          plan: trace.plan || null,
          startDate: trace.startDate,
          endDate: trace.endDate,
          autoRenew: trace.autoRenew || false,
          nextBillingDate: trace.nextBillingDate,
          hasActiveSubscription: user.hasActiveNuminaTrace()
        }
      }
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription status'
    });
  }
});

// Subscribe to Numina Trace
router.post('/numina-trace/subscribe', protect, async (req, res) => {
  try {
    const { plan, paymentMethodId } = req.body;
    
    if (!['monthly', 'yearly', 'lifetime'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription plan'
      });
    }

    const user = await User.findById(req.user.id);
    const now = new Date();
    
    // Calculate end date based on plan
    let endDate = null;
    let nextBillingDate = null;
    
    if (plan === 'monthly') {
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      nextBillingDate = endDate;
    } else if (plan === 'yearly') {
      endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
      nextBillingDate = endDate;
    }
    // lifetime plan has no end date
    
    // Update user subscription
    user.subscription = user.subscription || {};
    user.subscription.numinaTrace = {
      isActive: true,
      startDate: now,
      endDate: endDate,
      plan: plan,
      paymentMethodId: paymentMethodId,
      autoRenew: plan !== 'lifetime',
      cancelledAt: null,
      lastPaymentDate: now,
      nextBillingDate: nextBillingDate
    };
    
    await user.save();
    
    // Create or activate credit pool for new subscriber
    let creditPool = await CreditPool.findOne({ userId: user._id });
    if (!creditPool) {
      creditPool = new CreditPool({
        userId: user._id,
        balance: 0,
        isActive: true,
        isVerified: true // Auto-verify for Trace subscribers
      });
      await creditPool.save();
    } else {
      creditPool.isActive = true;
      creditPool.isVerified = true;
      await creditPool.save();
    }

    res.json({
      success: true,
      data: {
        message: 'Successfully subscribed to Numina Trace!',
        subscription: user.subscription.numinaTrace,
        creditPoolActivated: true
      }
    });

  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process subscription'
    });
  }
});

// Cancel Numina Trace subscription
router.post('/numina-trace/cancel', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.subscription?.numinaTrace?.isActive) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription to cancel'
      });
    }
    
    // Set cancellation date to end of current billing period
    user.subscription.numinaTrace.cancelledAt = user.subscription.numinaTrace.endDate || new Date();
    user.subscription.numinaTrace.autoRenew = false;
    
    await user.save();

    res.json({
      success: true,
      data: {
        message: 'Subscription cancelled. Access will continue until the end of your billing period.',
        activeUntil: user.subscription.numinaTrace.cancelledAt
      }
    });

  } catch (error) {
    console.error('Cancellation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

// Get subscription pricing
router.get('/pricing', async (req, res) => {
  res.json({
    success: true,
    data: {
      plans: [
        {
          name: 'monthly',
          displayName: 'Monthly',
          price: 19.99,
          currency: 'USD',
          duration: '1 month',
          features: [
            'All AI tools and features',
            'Restaurant reservations',
            'Playlist creation',
            'Travel planning',
            'Priority support'
          ]
        },
        {
          name: 'yearly',
          displayName: 'Yearly',
          price: 199.99,
          currency: 'USD',
          duration: '12 months',
          savings: 'Save $39.89',
          features: [
            'All AI tools and features',
            'Restaurant reservations', 
            'Playlist creation',
            'Travel planning',
            'Priority support',
            'Advanced analytics'
          ]
        },
        {
          name: 'lifetime',
          displayName: 'Lifetime',
          price: 499.99,
          currency: 'USD',
          duration: 'Forever',
          savings: 'Best Value',
          features: [
            'All AI tools and features',
            'Restaurant reservations',
            'Playlist creation', 
            'Travel planning',
            'Priority support',
            'Advanced analytics',
            'Beta feature access'
          ]
        }
      ]
    }
  });
});

export default router;