import emailService from '../src/services/emailService.js';

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');
  
  try {
    // Test welcome email
    console.log('📧 Sending welcome email...');
    const result = await emailService.sendWelcomeEmail('test@example.com', 'Test User');
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      
      if (result.previewUrl) {
        console.log('🔗 Preview URL (development):', result.previewUrl);
        console.log('\n💡 Copy the preview URL to see the email in your browser!');
      }
    } else {
      console.log('❌ Email failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEmailService();