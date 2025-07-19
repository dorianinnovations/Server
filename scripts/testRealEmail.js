import { Resend } from 'resend';

const resend = new Resend('re_QaYiH61w_FPpYK5BXUrcSSGt9i5T3qP3L');

async function testRealEmail() {
  console.log('🚀 Testing REAL email delivery to Gmail...\n');
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'Numina Team <onboarding@resend.dev>',
      to: ['dorianinnovations@gmail.com'],
      subject: '🎉 Welcome to Numina - Your AI Personal Assistant!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; text-align: center; padding: 30px; border-radius: 10px;">
            <h1>🎉 Welcome to Numina!</h1>
            <p>Your AI Personal Assistant is Ready</p>
          </div>
          
          <div style="padding: 30px 0;">
            <h2>Hi Isaiah!</h2>
            <p>Thank you for joining Numina! We're excited to help you on your personal growth journey with AI-powered insights and assistance.</p>
            
            <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
              <h3>🤖 AI Chat Assistant</h3>
              <p>Get personalized responses with 25+ AI tools including web search, weather, calculations, and more.</p>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
              <h3>📊 Emotional Analytics</h3>
              <p>Track your emotional patterns and get insights to improve your wellbeing.</p>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
              <h3>🎯 Personalized Experience</h3>
              <p>The more you use Numina, the better it adapts to your communication style and preferences.</p>
            </div>
            
            <p style="text-align: center;">
              <a href="https://numina.ai" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;">Start Using Numina</a>
            </p>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px;">
            <p>Welcome to the future of personal AI assistance!</p>
            <p>If you have any questions, just reply to this email.</p>
          </div>
        </div>
      `,
      text: `
Welcome to Numina, Isaiah!

Thank you for joining Numina! We're excited to help you on your personal growth journey with AI-powered insights and assistance.

What you can do with Numina:
• AI Chat Assistant with 25+ tools (web search, weather, calculations, etc.)
• Emotional Analytics to track your emotional patterns
• Personalized Experience that adapts to your style

Get started at: https://numina.ai

Welcome to the future of personal AI assistance!
If you have any questions, just reply to this email.

- The Numina Team
      `
    });

    if (error) {
      console.error('❌ Email failed:', error);
      return;
    }

    console.log('✅ REAL EMAIL SENT SUCCESSFULLY!');
    console.log('📧 Message ID:', data.id);
    console.log('📬 Delivered to: isaiah.vq@gmail.com');
    console.log('🎉 Check Gmail inbox now!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealEmail();