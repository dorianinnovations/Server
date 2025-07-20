// Test final email with verified domain
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function testFinalEmail() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ['dorianinnovations@gmail.com'],
      subject: '🎉 Numina Welcome Email - RESEND Integration Working!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; text-align: center; padding: 30px; border-radius: 10px;">
            <h1>🎉 Welcome to Numina!</h1>
            <p>Your AI Personal Assistant is Ready</p>
          </div>
          
          <div style="padding: 30px 0;">
            <h2>RESEND Integration Successful!</h2>
            <p>This email confirms that RESEND welcome emails are now working correctly for Numina signup flow.</p>
            
            <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
              <h3>✅ Integration Status</h3>
              <p>• RESEND API Key: Valid and working</p>
              <p>• Email Service: Configured and operational</p>
              <p>• Welcome Emails: Ready for production</p>
            </div>
            
            <p style="text-align: center;">
              <a href="https://numina.ai" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;">Start Using Numina</a>
            </p>
          </div>
        </div>
      `
    });

    if (error) {
      console.log('❌ Error:', error);
    } else {
      console.log('🎉 SUCCESS! RESEND integration fully working!');
      console.log('📧 Email ID:', data.id);
      console.log('✅ Welcome email sent to dorianinnovations@gmail.com');
      console.log('📬 Check your Gmail inbox - welcome email should be there!');
    }
  } catch (err) {
    console.log('💥 Exception:', err.message);
  }
}

testFinalEmail();