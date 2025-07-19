import nodemailer from 'nodemailer';

async function testEmailWithEthereal() {
  console.log('🧪 Testing Email with Ethereal...\n');
  
  try {
    // Create test account
    console.log('📧 Creating test account...');
    const testAccount = await nodemailer.createTestAccount();
    console.log('✅ Test account created:', testAccount.user);
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    // Send email
    console.log('📤 Sending welcome email...');
    const info = await transporter.sendMail({
      from: '"Numina Team" <noreply@numina.ai>',
      to: 'newuser@example.com',
      subject: '🎉 Welcome to Numina!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #10b981;">🎉 Welcome to Numina!</h1>
          <p>Thank you for signing up! We're excited to help you on your AI journey.</p>
          <p>Your account is ready to use.</p>
          <div style="margin: 20px 0; padding: 15px; background: #f0f9ff; border-radius: 8px;">
            <h3>🤖 What you can do:</h3>
            <ul>
              <li>Chat with AI assistant</li>
              <li>Use 25+ AI tools</li>
              <li>Track emotional analytics</li>
              <li>Get personalized insights</li>
            </ul>
          </div>
          <p>Welcome to the future of personal AI assistance!</p>
        </div>
      `,
      text: 'Welcome to Numina! Thank you for signing up. Your AI assistant is ready to help you grow.'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('🔗 Preview URL:', nodemailer.getTestMessageUrl(info));
    console.log('\n💡 Copy the preview URL to see the email in your browser!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEmailWithEthereal();