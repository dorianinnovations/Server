import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';
// CreditPool model removed - using subscription system instead
import emailService from '../services/emailService.js';

const router = express.Router();

// Get subscription status
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const subscription = user.subscription || {};
    
    res.json({
      success: true,
      data: {
        subscription: {
          isActive: subscription.isActive || false,
          plan: subscription.plan || 'core',
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew || false,
          nextBillingDate: subscription.nextBillingDate,
          hasActiveSubscription: subscription.isActive && subscription.plan === 'aether'
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

// Subscribe to Numina Trace (now supports Core/Pro/Aether tiers)
router.post('/numina-trace/subscribe', protect, async (req, res) => {
  try {
    const { plan, paymentMethodId } = req.body;
    
    if (!['core', 'aether'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription plan. Must be core or aether.'
      });
    }

    const user = await User.findById(req.user.id);
    const now = new Date();
    
    // For Core tier, no payment is needed (free tier)
    if (plan === 'core') {
      // Just ensure user has basic tier set up
      user.subscription = user.subscription || {};
      user.subscription.plan = 'core';
      user.subscription.isActive = true;
      user.subscription.startDate = now;
      await user.save();
      
      return res.json({
        success: true,
        data: {
          message: 'Core tier activated successfully!',
          subscription: { plan: 'core', isActive: true, startDate: now }
        }
      });
    }
    
    // Calculate end date based on plan (monthly billing for Pro and Aether)
    let endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    let nextBillingDate = endDate;
    
    // Update user subscription (Pro/Aether tiers)
    user.subscription = user.subscription || {};
    user.subscription.plan = plan;
    user.subscription.isActive = true;
    user.subscription.startDate = now;
    user.subscription.endDate = endDate;
    user.subscription.paymentMethodId = paymentMethodId;
    user.subscription.autoRenew = true;
    user.subscription.cancelledAt = null;
    user.subscription.lastPaymentDate = now;
    user.subscription.nextBillingDate = nextBillingDate;
    
    await user.save();
    
    // Create or activate credit pool for new subscriber
    // CreditPool functionality replaced by subscription system
    /*
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
    */

    // Send payment confirmation email (non-blocking)
    const subscriptionDetails = {
      plan: plan,
      price: plan === 'aether' ? 99.99 : 0,
      currency: 'USD',
      nextBillingDate: nextBillingDate
    };

    emailService.sendPaymentConfirmationEmail(
      user.email,
      user.displayName || user.email.split('@')[0],
      subscriptionDetails
    )
    .then(result => {
      if (result.success) {
        console.log('✅ Payment confirmation email sent via', result.service, 'to:', user.email);
        if (result.messageId) {
          console.log('📧 Email ID:', result.messageId);
        }
      } else {
        console.warn('⚠️ Payment confirmation email failed:', result.error);
      }
    })
    .catch(err => console.error('❌ Payment confirmation email error:', err));

    res.json({
      success: true,
      data: {
        message: `Successfully subscribed to ${plan.charAt(0).toUpperCase() + plan.slice(1)} tier!`,
        subscription: {
          plan: user.subscription.plan,
          isActive: user.subscription.isActive,
          startDate: user.subscription.startDate,
          endDate: user.subscription.endDate,
          nextBillingDate: user.subscription.nextBillingDate
        },
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

// Cancel subscription
router.post('/numina-trace/cancel', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.subscription?.isActive || user.subscription?.plan === 'core') {
      return res.status(400).json({
        success: false,
        error: 'No active paid subscription to cancel'
      });
    }
    
    // Set cancellation date to end of current billing period
    user.subscription.cancelledAt = user.subscription.endDate || new Date();
    user.subscription.autoRenew = false;
    
    await user.save();

    res.json({
      success: true,
      data: {
        message: 'Subscription cancelled. Access will continue until the end of your billing period.',
        activeUntil: user.subscription.cancelledAt
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
          name: 'core',
          displayName: 'Core',
          price: 0,
          currency: 'USD',
          duration: '/month',
          features: [
            'Basic AI Chat',
            '1 Daily Request',
            'Standard Support'
          ]
        },
        {
          name: 'pro',
          displayName: 'Pro',
          price: 29.99,
          currency: 'USD',
          duration: '/month',
          savings: 'Most Popular',
          features: [
            'All AI Tools',
            '200 Daily Requests',
            'Emotional Analysis',
            'Personalized Insights',
            'Priority Support'
          ]
        },
        {
          name: 'aether',
          displayName: 'Aether',
          price: 99.99,
          currency: 'USD',
          duration: '/month',
          features: [
            'Everything in Pro',
            'Unlimited Requests',
            'Priority Processing',
            'Advanced Analytics',
            'Early Access Features'
          ]
        }
      ]
    }
  });
});

export default router;