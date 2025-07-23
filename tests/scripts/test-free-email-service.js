/**
 * COMPREHENSIVE FREE EMAIL SERVICE TEST
 * Tests the new email service that replaced Resend
 */

import emailService from '../../src/services/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testEmailService() {
  console.log('🧪 TESTING FREE EMAIL SERVICE (Resend Replacement)');
  console.log('==================================================');
  
  try {
    // Wait for email service initialization
    await emailService.initPromise;
    
    // Test 1: Service Status
    console.log('\n📊 EMAIL SERVICE STATUS:');
    const stats = emailService.getEmailStats();
    console.log('Services configured:', stats.services);
    console.log('Daily limits:', stats.dailyLimits);
    console.log('Usage stats:', stats);
    
    // Test 2: Welcome Email
    console.log('\n📧 TESTING WELCOME EMAIL...');
    const welcomeResult = await emailService.sendWelcomeEmail(
      'test@example.com', 
      'Test User'
    );
    
    if (welcomeResult.success) {
      console.log('✅ Welcome email sent successfully!');
      console.log(`  Service used: ${welcomeResult.service}`);
      console.log(`  Message ID: ${welcomeResult.messageId}`);
      console.log(`  Attempt: ${welcomeResult.attempt}`);
      if (welcomeResult.previewUrl) {
        console.log(`  Preview: ${welcomeResult.previewUrl}`);
      }
    } else {
      console.log('❌ Welcome email failed:', welcomeResult.error);
      if (welcomeResult.attempts) {
        console.log('  Failed attempts:', welcomeResult.attempts);
      }
    }
    
    // Test 3: Notification Email
    console.log('\n📬 TESTING NOTIFICATION EMAIL...');
    const notificationResult = await emailService.sendNotificationEmail(
      'test@example.com',
      'Test Notification',
      'This is a test notification to verify the free email service is working properly.'
    );
    
    if (notificationResult.success) {
      console.log('✅ Notification email sent successfully!');
      console.log(`  Service used: ${notificationResult.service}`);
      console.log(`  Message ID: ${notificationResult.messageId}`);
    } else {
      console.log('❌ Notification email failed:', notificationResult.error);
    }
    
    // Test 4: Payment Confirmation Email
    console.log('\n💳 TESTING PAYMENT CONFIRMATION EMAIL...');
    const paymentResult = await emailService.sendPaymentConfirmationEmail(
      'test@example.com',
      'Test User',
      {
        plan: 'pro',
        price: 19.99,
        currency: 'USD',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    );
    
    if (paymentResult.success) {
      console.log('✅ Payment confirmation email sent successfully!');
      console.log(`  Service used: ${paymentResult.service}`);
      console.log(`  Message ID: ${paymentResult.messageId}`);
    } else {
      console.log('❌ Payment confirmation email failed:', paymentResult.error);
    }
    
    // Test 5: Final Stats
    console.log('\n📈 FINAL EMAIL STATS:');
    const finalStats = emailService.getEmailStats();
    console.log('Total sent:', finalStats.sent);
    console.log('Total failed:', finalStats.failed);
    console.log('Daily count:', finalStats.dailyCount);
    console.log('Service usage:', finalStats.serviceUsage);
    
    // Test 6: Service Recommendations
    console.log('\n💡 EMAIL SERVICE RECOMMENDATIONS:');
    
    if (finalStats.services.gmail) {
      console.log('✅ Gmail SMTP configured (PRIMARY - 500 emails/day)');
    } else {
      console.log('⚠️  Gmail SMTP not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD');
      console.log('   Guide: https://support.google.com/accounts/answer/185833');
    }
    
    if (finalStats.services.brevo) {
      console.log('✅ Brevo configured (SECONDARY - 300 emails/day)');
    } else {
      console.log('💡 Consider adding Brevo for backup email delivery');
      console.log('   Sign up: https://www.brevo.com/ (300 free emails/day)');
    }
    
    if (finalStats.services.sendgrid) {
      console.log('✅ SendGrid configured (TERTIARY - 100 emails/day)');
    } else {
      console.log('💡 Consider adding SendGrid for additional capacity');
      console.log('   Sign up: https://sendgrid.com/ (100 free emails/day)');
    }
    
    const totalCapacity = (finalStats.services.gmail ? 500 : 0) +
                         (finalStats.services.brevo ? 300 : 0) +
                         (finalStats.services.sendgrid ? 100 : 0);
    
    console.log(`\n📊 TOTAL FREE EMAIL CAPACITY: ${totalCapacity} emails/day`);
    console.log('🎉 FREE EMAIL SERVICE TEST COMPLETED!');
    console.log('💰 Cost savings: $0 vs Resend pricing!');
    
  } catch (error) {
    console.error('❌ Email service test failed:', error);
    process.exit(1);
  }
}

// Configuration check
function checkConfiguration() {
  console.log('🔍 CHECKING EMAIL CONFIGURATION...');
  
  const configs = {
    'Gmail SMTP': !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD),
    'Brevo API': !!process.env.BREVO_API_KEY,
    'SendGrid API': !!process.env.SENDGRID_API_KEY,
    'From Email': !!process.env.FROM_EMAIL
  };
  
  Object.entries(configs).forEach(([service, configured]) => {
    console.log(`  ${service}: ${configured ? '✅ Configured' : '❌ Not configured'}`);
  });
  
  const configuredCount = Object.values(configs).filter(Boolean).length;
  console.log(`\n📊 ${configuredCount}/4 email services configured`);
  
  if (configuredCount === 0) {
    console.log('\n⚠️  WARNING: No email services configured!');
    console.log('   The system will use test email service only.');
    console.log('   Check .env.template for setup instructions.');
  }
  
  return configuredCount > 0;
}

// Run tests
async function main() {
  const hasConfig = checkConfiguration();
  
  if (hasConfig || process.env.NODE_ENV !== 'production') {
    await testEmailService();
  } else {
    console.log('❌ Cannot run tests without email configuration in production');
    process.exit(1);
  }
}

main().catch(console.error);