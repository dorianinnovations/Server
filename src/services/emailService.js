import nodemailer from 'nodemailer';
import { env } from '../config/environment.js';
import axios from 'axios';

/**
 * ENHANCED FREE EMAIL SERVICE
 * Replaces Resend with multiple free email providers
 * 
 * Services Priority:
 * 1. Gmail SMTP (500 emails/day free) - PRIMARY
 * 2. Brevo/Sendinblue (300 emails/day free) - SECONDARY  
 * 3. SendGrid (100 emails/day free) - TERTIARY
 * 4. Ethereal (test only) - FALLBACK
 */
class EmailService {
  constructor() {
    this.primaryTransporter = null;
    this.fallbackTransporter = null;
    this.brevoApi = null;
    this.sendgridApi = null;
    this.isInitialized = false;
    this.emailStats = { 
      sent: 0, 
      failed: 0, 
      dailyCount: 0, 
      lastReset: new Date(),
      serviceUsage: { gmail: 0, brevo: 0, sendgrid: 0, ethereal: 0 }
    };
    this.initPromise = this.initializeEmailServices();
  }

  async initializeEmailServices() {
    try {
      // Initializing FREE email services
      
      // PRIMARY: Gmail SMTP (500 emails/day free)
      if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
        // Setting up Gmail SMTP as PRIMARY
        this.primaryTransporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          rateDelta: 1000,
          rateLimit: 5
        });
        
        // Test Gmail connection
        await this.primaryTransporter.verify();
        // Gmail SMTP verified and ready
      }
      
      // SECONDARY: Brevo (Sendinblue) API (300 emails/day free)
      if (process.env.BREVO_API_KEY) {
        // Setting up Brevo as SECONDARY
        this.brevoApi = {
          apiKey: process.env.BREVO_API_KEY,
          baseUrl: 'https://api.brevo.com/v3/smtp/email'
        };
        // Brevo API configured
      }
      
      // TERTIARY: SendGrid API (100 emails/day free)
      if (process.env.SENDGRID_API_KEY) {
        // Setting up SendGrid as TERTIARY
        this.sendgridApi = {
          apiKey: process.env.SENDGRID_API_KEY,
          baseUrl: 'https://api.sendgrid.com/v3/mail/send'
        };
        // SendGrid API configured
      }
      
      // FALLBACK: Ethereal test for development
      if (!this.primaryTransporter && !this.brevoApi && !this.sendgridApi) {
        console.log('⚠️ No production email services configured, using test service');
        const testAccount = await nodemailer.createTestAccount();
        this.fallbackTransporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        console.log('📧 Using Ethereal test account:', testAccount.user);
      }
      
      this.isInitialized = true;
      // FREE email services initialized
      this.logServiceStatus();
      
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      this.isInitialized = false;
    }
  }
  
  logServiceStatus() {
    // Email service status logging disabled for cleaner startup
  }
  
  resetDailyCountIfNeeded() {
    const now = new Date();
    const lastReset = this.emailStats.lastReset;
    
    // Reset daily count if it's a new day
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.emailStats.dailyCount = 0;
      this.emailStats.serviceUsage = { gmail: 0, brevo: 0, sendgrid: 0, ethereal: 0 };
      this.emailStats.lastReset = now;
      console.log('📅 Daily email count reset');
    }
  }

  async sendWelcomeEmail(userEmail, userName = 'User') {
    // Wait for initialization if needed
    if (!this.isInitialized) {
      await this.initPromise;
    }
    
    if (!this.isInitialized) {
      console.warn('Email service not initialized, skipping email');
      return { success: false, error: 'Email service not initialized' };
    }

    this.resetDailyCountIfNeeded();
    
    const emailData = {
      to: userEmail,
      subject: 'Hey, welcome!',
      html: this.getWelcomeEmailTemplate(userName),
      text: this.getWelcomeEmailText(userName)
    };

    return await this.sendEmailWithFallback(emailData, 'welcome');
  }
  
  async sendEmailWithFallback(emailData, emailType = 'general') {
    const attempts = [];
    
    try {
      // ATTEMPT 1: Gmail SMTP (Primary - 500 emails/day)
      if (this.primaryTransporter && this.emailStats.serviceUsage.gmail < 450) { // Leave buffer
        try {
          const result = await this.sendViaGmail(emailData);
          this.emailStats.sent++;
          this.emailStats.dailyCount++;
          this.emailStats.serviceUsage.gmail++;
          // Email sent via Gmail
          return { ...result, service: 'gmail', attempt: 1 };
        } catch (error) {
          attempts.push({ service: 'gmail', error: error.message });
          console.warn('⚠️ Gmail failed, trying Brevo...', error.message);
        }
      }
      
      // ATTEMPT 2: Brevo API (Secondary - 300 emails/day)
      if (this.brevoApi && this.emailStats.serviceUsage.brevo < 250) { // Leave buffer
        try {
          const result = await this.sendViaBrevo(emailData);
          this.emailStats.sent++;
          this.emailStats.dailyCount++;
          this.emailStats.serviceUsage.brevo++;
          console.log(`✅ Email sent via Brevo (${this.emailStats.serviceUsage.brevo}/250 today)`);
          return { ...result, service: 'brevo', attempt: 2 };
        } catch (error) {
          attempts.push({ service: 'brevo', error: error.message });
          console.warn('⚠️ Brevo failed, trying SendGrid...', error.message);
        }
      }
      
      // ATTEMPT 3: SendGrid API (Tertiary - 100 emails/day)
      if (this.sendgridApi && this.emailStats.serviceUsage.sendgrid < 80) { // Leave buffer
        try {
          const result = await this.sendViaSendGrid(emailData);
          this.emailStats.sent++;
          this.emailStats.dailyCount++;
          this.emailStats.serviceUsage.sendgrid++;
          console.log(`✅ Email sent via SendGrid (${this.emailStats.serviceUsage.sendgrid}/80 today)`);
          return { ...result, service: 'sendgrid', attempt: 3 };
        } catch (error) {
          attempts.push({ service: 'sendgrid', error: error.message });
          console.warn('⚠️ SendGrid failed, using fallback...', error.message);
        }
      }
      
      // ATTEMPT 4: Ethereal test (Development fallback)
      if (this.fallbackTransporter) {
        try {
          const result = await this.sendViaFallback(emailData);
          this.emailStats.serviceUsage.ethereal++;
          console.log('✅ Email sent via test service (development)');
          return { ...result, service: 'ethereal-test', attempt: 4 };
        } catch (error) {
          attempts.push({ service: 'ethereal', error: error.message });
        }
      }
      
      // All services failed
      this.emailStats.failed++;
      console.error('❌ All email services failed:', attempts);
      return { 
        success: false, 
        error: 'All email services failed',
        attempts: attempts
      };
      
    } catch (error) {
      this.emailStats.failed++;
      console.error('❌ Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationEmail(toEmail, subject, message) {
    if (!this.isInitialized) {
      await this.initPromise;
    }
    
    if (!this.isInitialized) {
      console.warn('Email service not initialized, skipping email');
      return { success: false, error: 'Email service not initialized' };
    }

    const emailData = {
      to: toEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Numina Notification</h2>
          <p>${message}</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message from Numina AI.
          </p>
        </div>
      `,
      text: message
    };

    return await this.sendEmailWithFallback(emailData, 'notification');
  }
  
  async sendViaGmail(emailData) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'Numina Team <noreply@aidorian.com>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    };

    const info = await this.primaryTransporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
    };
  }
  
  async sendViaBrevo(emailData) {
    const brevoPayload = {
      sender: {
        name: 'Numina Team',
        email: process.env.FROM_EMAIL || 'noreply@aidorian.com'
      },
      to: [{ email: emailData.to }],
      subject: emailData.subject,
      htmlContent: emailData.html,
      textContent: emailData.text
    };

    const response = await axios.post(this.brevoApi.baseUrl, brevoPayload, {
      headers: {
        'api-key': this.brevoApi.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return {
      success: true,
      messageId: response.data.messageId || response.data.id,
      response: response.data
    };
  }
  
  async sendViaSendGrid(emailData) {
    const sendgridPayload = {
      personalizations: [{
        to: [{ email: emailData.to }],
        subject: emailData.subject
      }],
      from: {
        email: process.env.FROM_EMAIL || 'noreply@aidorian.com',
        name: 'Numina Team'
      },
      content: [
        {
          type: 'text/plain',
          value: emailData.text
        },
        {
          type: 'text/html',
          value: emailData.html
        }
      ]
    };

    const response = await axios.post(this.sendgridApi.baseUrl, sendgridPayload, {
      headers: {
        'Authorization': `Bearer ${this.sendgridApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return {
      success: true,
      messageId: response.headers['x-message-id'] || 'sendgrid-success',
      response: response.status
    };
  }
  
  async sendViaFallback(emailData) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@aidorian.com',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    };

    const info = await this.fallbackTransporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info)
    };
  }

  async sendPaymentConfirmationEmail(userEmail, userName, subscriptionDetails) {
    // Wait for initialization if needed
    if (!this.isInitialized) {
      await this.initPromise;
    }
    
    if (!this.isInitialized) {
      console.warn('Email service not initialized, skipping payment confirmation email');
      return { success: false, error: 'Email service not initialized' };
    }

    this.resetDailyCountIfNeeded();
    
    const emailData = {
      to: userEmail,
      subject: '🎉 Payment Confirmed - Welcome to Numina Premium!',
      html: this.getPaymentConfirmationEmailTemplate(userName, subscriptionDetails),
      text: this.getPaymentConfirmationEmailText(userName, subscriptionDetails)
    };

    return await this.sendEmailWithFallback(emailData, 'payment-confirmation');
  }
  
  getEmailStats() {
    return {
      ...this.emailStats,
      services: {
        gmail: !!this.primaryTransporter,
        brevo: !!this.brevoApi,
        sendgrid: !!this.sendgridApi,
        fallback: !!this.fallbackTransporter
      },
      dailyLimits: {
        gmail: { used: this.emailStats.serviceUsage.gmail, limit: 450 },
        brevo: { used: this.emailStats.serviceUsage.brevo, limit: 250 },
        sendgrid: { used: this.emailStats.serviceUsage.sendgrid, limit: 80 }
      }
    };
  }

  getWelcomeEmailTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hey, welcome!</title>
        <style>
          body { margin: 0; padding: 0; background: linear-gradient(135deg, #E6E6FA 0%, #DDA0DD 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          .email-container { width: 100%; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #9370DB 0%, #DA70D6 100%); text-align: center; padding: 50px 30px; position: relative; }
          .brand-text { font-size: 36px; font-weight: bold; color: #2d3748; font-style: italic; margin-bottom: 0; }
          .hero-illustration { width: 200px; height: 200px; margin: 30px auto; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
          .hero-emoji { font-size: 80px; }
          .main-title { font-size: 32px; font-weight: 600; color: #2d3748; margin: 30px 0 10px 0; }
          .main-description { font-size: 16px; color: #718096; line-height: 1.6; margin-bottom: 40px; max-width: 400px; margin-left: auto; margin-right: auto; }
          .cta-button { background: linear-gradient(135deg, #E91E63 0%, #FF1744 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 30px; font-weight: 600; font-size: 16px; display: inline-block; transition: transform 0.2s; }
          .cta-button:hover { transform: translateY(-2px); }
          .content { padding: 60px 40px; }
          .whats-next { margin-top: 60px; }
          .section-title { font-size: 24px; font-weight: 600; color: #2d3748; margin-bottom: 30px; text-align: center; }
          .feature { display: flex; align-items: flex-start; margin-bottom: 30px; }
          .feature-icon { width: 60px; height: 60px; border-radius: 15px; display: flex; align-items: center; justify-content: center; margin-right: 20px; font-size: 24px; }
          .feature-icon-1 { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .feature-icon-2 { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
          .feature-icon-3 { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
          .feature-content h3 { font-size: 18px; font-weight: 600; color: #2d3748; margin: 0 0 8px 0; }
          .feature-content p { font-size: 14px; color: #718096; margin: 0; line-height: 1.5; }
          .footer { background: #4a5568; color: #cbd5e0; text-align: center; padding: 40px; }
          .footer p { margin: 8px 0; font-size: 14px; }
          .social-links { margin: 20px 0; }
          .social-link { display: inline-block; margin: 0 10px; width: 40px; height: 40px; background: rgba(255,255,255,0.1); border-radius: 50%; text-decoration: none; }
          .unsubscribe { font-size: 12px; color: #a0aec0; margin-top: 20px; }
          @media (max-width: 600px) {
            .content { padding: 40px 20px; }
            .feature { flex-direction: column; text-align: center; }
            .feature-icon { margin: 0 auto 15px auto; }
          }
        </style>
      </head>
      <body>
        <div style="padding: 20px;">
          <div class="email-container">
            <div class="header">
              <div class="brand-text">numina</div>
              <div class="hero-illustration">
                <div class="hero-emoji">👋</div>
              </div>
            </div>
            
            <div class="content">
              <h1 class="main-title">Hey, welcome!</h1>
              <p class="main-description">
                You're all set up with Numina. Start having conversations that actually understand you.
              </p>
              
              <div style="text-align: center;">
                <a href="https://numina.ai" class="cta-button">GET STARTED</a>
              </div>
              
              <div class="whats-next">
                <h2 class="section-title">What's next</h2>
                
                <div class="feature">
                  <div class="feature-icon feature-icon-1">🤖</div>
                  <div class="feature-content">
                    <h3>Smart Conversations</h3>
                    <p>Chat with an AI that learns your communication style and provides personalized responses.</p>
                  </div>
                </div>
                
                <div class="feature">
                  <div class="feature-icon feature-icon-2">📊</div>
                  <div class="feature-content">
                    <h3>Personal Insights</h3>
                    <p>Track your emotional patterns and get insights to improve your wellbeing over time.</p>
                  </div>
                </div>
                
                <div class="feature">
                  <div class="feature-icon feature-icon-3">🎯</div>
                  <div class="feature-content">
                    <h3>Adaptive Experience</h3>
                    <p>The more you use Numina, the better it understands and adapts to your unique needs.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="social-links">
                <a href="#" class="social-link"></a>
                <a href="#" class="social-link"></a>
                <a href="#" class="social-link"></a>
                <a href="#" class="social-link"></a>
              </div>
              <p>Address: AI Labs, Tech District, Innovation City</p>
              <p>(555) 123-4567 - hello@numina.ai</p>
              <p class="unsubscribe">
                <a href="#" style="color: #a0aec0;">UNSUBSCRIBE</a> | 
                <a href="#" style="color: #a0aec0;">WEB VERSION</a> | 
                <a href="#" style="color: #a0aec0;">SEND TO A FRIEND</a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWelcomeEmailText(userName) {
    return `
Hey, welcome!

You're all set up with Numina. Start having conversations that actually understand you.

What's next:
• Smart Conversations - Chat with an AI that learns your communication style
• Personal Insights - Track emotional patterns and improve your wellbeing  
• Adaptive Experience - The more you use it, the better it gets

Get started at: https://numina.ai

Questions? Just reply to this email.

- The Numina Team
    `;
  }

  getPaymentConfirmationEmailTemplate(userName, subscriptionDetails) {
    const { plan, price, currency, nextBillingDate, features } = subscriptionDetails;
    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price || 0);

    const nextBilling = nextBillingDate ? 
      new Date(nextBillingDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      }) : 'N/A';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #add5fa, #0ea5e9); color: white; text-align: center; padding: 30px; border-radius: 10px; }
          .content { padding: 30px 0; }
          .subscription-details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .feature { margin: 15px 0; padding: 10px; background: #ffffff; border-left: 4px solid #add5fa; border-radius: 4px; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
          .button { background: #add5fa; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
          .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-badge">✅ PAYMENT CONFIRMED</div>
            <h1>🎉 Welcome to Numina Premium!</h1>
            <p>Your subscription is now active</p>
          </div>
          
          <div class="content">
            <h2>Hi ${userName}!</h2>
            <p>Thank you for upgrading to Numina Premium! Your payment has been successfully processed and your subscription is now active.</p>
            
            <div class="subscription-details">
              <h3>📋 Subscription Details</h3>
              <p><strong>Plan:</strong> ${plan.charAt(0).toUpperCase() + plan.slice(1)}</p>
              <p><strong>Amount:</strong> ${formattedPrice}</p>
              ${nextBillingDate ? `<p><strong>Next Billing:</strong> ${nextBilling}</p>` : '<p><strong>Billing:</strong> One-time payment</p>'}
            </div>

            <div class="feature">
              <h3>🚀 What's Now Available</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>🔧 All AI Tools & Advanced Features</li>
                <li>📊 Unlimited Daily Requests</li>
                <li>🧠 Enhanced Emotional Analytics</li>
                <li>⭐ Priority Support</li>
                <li>🎯 Personalized Insights</li>
                <li>🌟 Early Access to New Features</li>
              </ul>
            </div>
            
            <p style="text-align: center;">
              <a href="https://numina.ai" class="button">Start Using Your Premium Features</a>
            </p>
          </div>
          
          <div class="footer">
            <p>🔒 Your payment was processed securely</p>
            <p>Need help? Just reply to this email - we're here to help!</p>
            <p><small>✨ Delivered via free email services</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPaymentConfirmationEmailText(userName, subscriptionDetails) {
    const { plan, price, currency, nextBillingDate } = subscriptionDetails;
    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price || 0);

    const nextBilling = nextBillingDate ? 
      new Date(nextBillingDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      }) : 'One-time payment';

    return `
✅ PAYMENT CONFIRMED - Welcome to Numina Premium!

Hi ${userName}!

Thank you for upgrading to Numina Premium! Your payment has been successfully processed and your subscription is now active.

📋 Subscription Details:
• Plan: ${plan.charAt(0).toUpperCase() + plan.slice(1)}
• Amount: ${formattedPrice}
• Next Billing: ${nextBilling}

🚀 What's Now Available:
• All AI Tools & Advanced Features
• Unlimited Daily Requests  
• Enhanced Emotional Analytics
• Priority Support
• Personalized Insights
• Early Access to New Features

Get started at: https://numina.ai

🔒 Your payment was processed securely
Need help? Just reply to this email - we're here to help!

- The Numina Team
✨ Delivered via free email services
    `;
  }
}

// Export singleton instance
export default new EmailService();