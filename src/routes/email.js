/**
 * EMAIL SERVICE ROUTES
 * Manage and monitor the free email service
 */

import express from 'express';
import emailService from '../services/emailService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /email/stats
 * Get email service statistics and status
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = emailService.getEmailStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        message: 'Free email service status',
        resendReplacement: true,
        costSavings: 'Unlimited - no per-email charges!'
      }
    });
  } catch (error) {
    console.error('Error getting email stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get email statistics'
    });
  }
});

/**
 * POST /email/test
 * Send a test email (admin only)
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { email, type = 'welcome', userName = 'Test User' } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }
    
    let result;
    
    switch (type) {
      case 'welcome':
        result = await emailService.sendWelcomeEmail(email, userName);
        break;
      case 'notification':
        result = await emailService.sendNotificationEmail(
          email,
          'Test Notification',
          'This is a test email from the free email service.'
        );
        break;
      case 'payment':
        result = await emailService.sendPaymentConfirmationEmail(email, userName, {
          plan: 'pro',
          price: 19.99,
          currency: 'USD',
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid email type. Use: welcome, notification, or payment'
        });
    }
    
    res.json({
      success: true,
      data: {
        emailSent: result.success,
        service: result.service,
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        type: type,
        recipient: email
      }
    });
    
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email'
    });
  }
});

/**
 * GET /email/services
 * Get available email services and setup instructions
 */
router.get('/services', async (req, res) => {
  try {
    const stats = emailService.getEmailStats();
    
    const services = [
      {
        name: 'Gmail SMTP',
        priority: 1,
        dailyLimit: 500,
        configured: stats.services.gmail,
        used: stats.serviceUsage?.gmail || 0,
        setupUrl: 'https://support.google.com/accounts/answer/185833',
        description: 'Primary email service - most reliable',
        envVars: ['EMAIL_USER', 'EMAIL_APP_PASSWORD']
      },
      {
        name: 'Brevo (Sendinblue)',
        priority: 2,
        dailyLimit: 300,
        configured: stats.services.brevo,
        used: stats.serviceUsage?.brevo || 0,
        setupUrl: 'https://www.brevo.com/',
        description: 'Secondary email service - excellent API',
        envVars: ['BREVO_API_KEY']
      },
      {
        name: 'SendGrid',
        priority: 3,
        dailyLimit: 100,
        configured: stats.services.sendgrid,
        used: stats.serviceUsage?.sendgrid || 0,
        setupUrl: 'https://sendgrid.com/',
        description: 'Tertiary email service - reliable delivery',
        envVars: ['SENDGRID_API_KEY']
      }
    ];
    
    const totalCapacity = services
      .filter(s => s.configured)
      .reduce((sum, s) => sum + s.dailyLimit, 0);
    
    res.json({
      success: true,
      data: {
        services,
        totalDailyCapacity: totalCapacity,
        replacedService: 'Resend',
        costSavings: 'FREE vs $0.001-0.002 per email',
        instructions: 'Check .env.template for setup guide'
      }
    });
    
  } catch (error) {
    console.error('Error getting email services info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get email services information'
    });
  }
});

export default router;