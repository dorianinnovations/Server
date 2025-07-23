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
      console.log('🚀 Initializing FREE email services (Resend replacement)...');
      
      // PRIMARY: Gmail SMTP (500 emails/day free)
      if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
        console.log('📧 Setting up Gmail SMTP as PRIMARY service');
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
        console.log('✅ Gmail SMTP verified and ready (PRIMARY)');
      }
      
      // SECONDARY: Brevo (Sendinblue) API (300 emails/day free)
      if (process.env.BREVO_API_KEY) {
        console.log('📮 Setting up Brevo as SECONDARY service');
        this.brevoApi = {
          apiKey: process.env.BREVO_API_KEY,
          baseUrl: 'https://api.brevo.com/v3/smtp/email'
        };
        console.log('✅ Brevo API configured (SECONDARY)');
      }
      
      // TERTIARY: SendGrid API (100 emails/day free)
      if (process.env.SENDGRID_API_KEY) {
        console.log('📬 Setting up SendGrid as TERTIARY service');
        this.sendgridApi = {
          apiKey: process.env.SENDGRID_API_KEY,
          baseUrl: 'https://api.sendgrid.com/v3/mail/send'
        };
        console.log('✅ SendGrid API configured (TERTIARY)');
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
      console.log('✅ FREE email services initialized successfully!');
      this.logServiceStatus();
      
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      this.isInitialized = false;
    }
  }
  
  logServiceStatus() {
    console.log('📊 Email Service Status:');
    console.log(`  PRIMARY (Gmail): ${this.primaryTransporter ? '✅ Ready' : '❌ Not configured'}`);
    console.log(`  SECONDARY (Brevo): ${this.brevoApi ? '✅ Ready' : '❌ Not configured'}`);
    console.log(`  TERTIARY (SendGrid): ${this.sendgridApi ? '✅ Ready' : '❌ Not configured'}`);
    console.log(`  FALLBACK (Test): ${this.fallbackTransporter ? '✅ Ready' : '❌ Not needed'}`);
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
      subject: '🎉 Welcome to Numina - Your AI Personal Assistant!',
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
          console.log(`✅ Email sent via Gmail (${this.emailStats.serviceUsage.gmail}/450 today)`);
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
        <style>
          .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; text-align: center; padding: 30px; border-radius: 10px; }
          .content { padding: 30px 0; }
          .feature { margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
          .button { background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
          .free-badge { background: #059669; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="free-badge">✅ FREE EMAIL SERVICE</div>
            <h1>🎉 Welcome to Numina!</h1>
            <p>Your AI Personal Assistant is Ready</p>
          </div>
          
          <div class="content">
            <h2>Hi ${userName}!</h2>
            <p>Thank you for joining Numina! We're excited to help you on your personal growth journey with AI-powered insights and assistance.</p>
            
            <div class="feature">
              <h3>🤖 AI Chat Assistant</h3>
              <p>Get personalized responses with 25+ AI tools including web search, weather, calculations, and more.</p>
            </div>
            
            <div class="feature">
              <h3>📊 Emotional Analytics</h3>
              <p>Track your emotional patterns and get insights to improve your wellbeing.</p>
            </div>
            
            <div class="feature">
              <h3>🎯 Personalized Experience</h3>
              <p>The more you use Numina, the better it adapts to your communication style and preferences.</p>
            </div>
            
            <p style="text-align: center;">
              <a href="https://numina.ai" class="button">Start Using Numina</a>
            </p>
          </div>
          
          <div class="footer">
            <p>Welcome to the future of personal AI assistance!</p>
            <p>If you have any questions, just reply to this email.</p>
            <p><small>✨ Powered by free email services (no more expensive Resend!)</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWelcomeEmailText(userName) {
    return `
Welcome to Numina, ${userName}!

Thank you for joining Numina! We're excited to help you on your personal growth journey with AI-powered insights and assistance.

What you can do with Numina:
• AI Chat Assistant with 25+ tools (web search, weather, calculations, etc.)
• Emotional Analytics to track your emotional patterns
• Personalized Experience that adapts to your style

Get started at: https://numina.ai

Welcome to the future of personal AI assistance!
If you have any questions, just reply to this email.

- The Numina Team
✨ Powered by free email services
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