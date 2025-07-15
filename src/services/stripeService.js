import Stripe from 'stripe';
import { env } from '../config/environment.js';

class StripeService {
  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_dummy_key');
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
        env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy_secret'
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

  async simulatePaymentSuccess(paymentIntentId) {
    // For testing purposes only - simulates a successful payment
    return {
      success: true,
      paymentIntent: {
        id: paymentIntentId,
        status: 'succeeded',
        amount: 5000, // $50.00
        currency: 'usd',
        metadata: {},
      },
    };
  }
}

export default new StripeService();