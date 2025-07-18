import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../config/environment.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.resend = null;
    this.isInitialized = false;
    this.initPromise = this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // Check if Resend API key is available for production use
      if (process.env.RESEND_API_KEY) {
        console.log('🚀 Using Resend for REAL email delivery');
        this.resend = new Resend(process.env.RESEND_API_KEY);
        this.isInitialized = true;
        console.log('✅ Resend email service initialized');
        return;
      }
      
      // Fallback to Gmail SMTP if configured
      if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
        console.log('📧 Using Gmail SMTP for real delivery');
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
          }
        });
        this.isInitialized = true;
        console.log('✅ Gmail SMTP email service initialized');
        return;
      }
      
      // Development fallback: Ethereal Email
      console.log('⚠️ No production email config found, using test service');
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('📧 Using Ethereal test account:', testAccount.user);
      this.isInitialized = true;
      console.log('✅ Test email service initialized');
      
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      this.isInitialized = false;
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

    try {
      // Use Resend if available (real delivery)
      if (this.resend) {
        const { data, error } = await this.resend.emails.send({
          from: process.env.FROM_EMAIL || 'Numina Team <noreply@numina.ai>',
          to: [userEmail],
          subject: '🎉 Welcome to Numina - Your AI Personal Assistant!',
          html: this.getWelcomeEmailTemplate(userName),
          text: this.getWelcomeEmailText(userName)
        });

        if (error) {
          console.error('❌ Resend email error:', error);
          return { success: false, error: error.message };
        }

        console.log('✅ REAL Welcome email sent via Resend:', {
          to: userEmail,
          messageId: data.id
        });

        return { 
          success: true, 
          messageId: data.id,
          service: 'resend'
        };
      }

      // Fallback to nodemailer (Gmail SMTP or test)
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@numina.ai',
        to: userEmail,
        subject: '🎉 Welcome to Numina - Your AI Personal Assistant!',
        html: this.getWelcomeEmailTemplate(userName),
        text: this.getWelcomeEmailText(userName)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Welcome email sent:', {
        to: userEmail,
        messageId: info.messageId,
        preview: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
      });

      return { 
        success: true, 
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null,
        service: 'nodemailer'
      };
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationEmail(toEmail, subject, message) {
    if (!this.isInitialized) {
      console.warn('Email service not initialized, skipping email');
      return { success: false, error: 'Email service not initialized' };
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'notifications@numina.ai',
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

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Notification email sent:', info.messageId);
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send notification email:', error);
      return { success: false, error: error.message };
    }
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
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
    `;
  }
}

// Export singleton instance
export default new EmailService();