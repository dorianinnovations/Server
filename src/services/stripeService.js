import Stripe from 'stripe';
import User from '../models/User.js';

class StripeService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('Stripe service disabled - no secret key configured');
      this.stripe = null;
      return;
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Numina Tier Pricing
    this.tiers = {
      core: {
        name: 'Core',
        price: 0,
        priceId: null, // Free tier
        features: ['Basic AI Chat', 'Limited Context', 'Standard Response Time']
      },
      aether: {
        name: 'Aether',
        price: 12.99,
        priceId: process.env.STRIPE_AETHER_PRICE_ID || 'price_aether_monthly',
        features: ['Advanced AI Chat', 'Extended Context', 'Vision Processing', 'Priority Support', 'Advanced Tools']
      }
    };
  }

  async createCustomer(userData) {
    try {
      const customer = await this.stripe.customers.create({
        email: userData.email,
        name: userData.name,
        metadata: {
          userId: userData.userId,
        },
      });

      return {
        success: true,
        customer: customer,
      };
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async createPaymentIntent(amount, currency = 'usd', customerId, metadata = {}) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency,
        customer: customerId,
        metadata: metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        success: true,
        paymentIntent: paymentIntent,
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async confirmPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      
      return {
        success: true,
        paymentIntent: paymentIntent,
      };
    } catch (error) {
      console.error('Error confirming payment intent:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async attachPaymentMethodToCustomer(paymentMethodId, customerId) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      return {
        success: true,
        paymentMethod: paymentMethod,
      };
    } catch (error) {
      console.error('Error attaching payment method:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async listCustomerPaymentMethods(customerId) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return {
        success: true,
        paymentMethods: paymentMethods.data,
      };
    } catch (error) {
      console.error('Error listing payment methods:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async detachPaymentMethod(paymentMethodId) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);

      return {
        success: true,
        paymentMethod: paymentMethod,
      };
    } catch (error) {
      console.error('Error detaching payment method:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async retrievePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        success: true,
        paymentIntent: paymentIntent,
      };
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async createSetupIntent(customerId) {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        success: true,
        setupIntent: setupIntent,
        clientSecret: setupIntent.client_secret,
      };
    } catch (error) {
      console.error('Error creating setup intent:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async refundPayment(paymentIntentId, amount = null) {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundData);

      return {
        success: true,
        refund: refund,
      };
    } catch (error) {
      console.error('Error processing refund:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  validateWebhookEvent(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy_secret'
      );

      return {
        success: true,
        event: event,
      };
    } catch (error) {
      console.error('Error validating webhook:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create subscription for Aether tier upgrade
   */
  async createAetherSubscription(userId, customerId = null) {
    try {
      // Get or create customer
      let customer;
      if (customerId) {
        customer = await this.stripe.customers.retrieve(customerId);
      } else {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');
        
        customer = await this.stripe.customers.create({
          email: user.email,
          name: user.name || user.email,
          metadata: { userId: userId.toString() }
        });
      }

      // Create subscription for Aether tier
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: this.tiers.aether.priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: userId.toString(),
          tier: 'aether'
        }
      });

      return {
        success: true,
        subscription,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        customerId: customer.id
      };
    } catch (error) {
      console.error('Error creating Aether subscription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle successful payment and upgrade user tier
   */
  async handleSuccessfulPayment(subscriptionId, userId) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      
      if (subscription.status === 'active') {
        // Update user tier in database
        await User.findByIdAndUpdate(userId, {
          'subscription.plan': 'aether',
          'subscription.status': 'active',
          'subscription.stripeSubscriptionId': subscriptionId,
          'subscription.stripeCustomerId': subscription.customer,
          'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
          'subscription.upgradedAt': new Date()
        });

        console.log(`✅ User ${userId} upgraded to Aether tier`);
        return { success: true, tier: 'aether' };
      }

      return { success: false, error: 'Subscription not active' };
    } catch (error) {
      console.error('Error handling successful payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get pricing information for frontend
   */
  getTierPricing() {
    return {
      core: {
        name: this.tiers.core.name,
        price: this.tiers.core.price,
        billing: 'Free Forever',
        features: this.tiers.core.features
      },
      aether: {
        name: this.tiers.aether.name,
        price: this.tiers.aether.price,
        billing: '$12.99/month',
        features: this.tiers.aether.features
      }
    };
  }

  async simulatePaymentSuccess(paymentIntentId) {
    // For testing purposes only - simulates a successful payment
    return {
      success: true,
      paymentIntent: {
        id: paymentIntentId,
        status: 'succeeded',
        amount: 1299, // $12.99
        currency: 'usd',
        metadata: {},
      },
    };
  }
}

export default new StripeService();