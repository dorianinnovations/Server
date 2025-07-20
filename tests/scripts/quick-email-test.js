// Quick test of RESEND with verified email
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function quickTest() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ['dorianinnovations@gmail.com'],
      subject: 'Test Welcome Email',
      html: '<h1>Welcome to Numina!</h1><p>This is a test email.</p>'
    });

    if (error) {
      console.log('❌ Error:', error);
    } else {
      console.log('✅ Success! Email ID:', data.id);
    }
  } catch (err) {
    console.log('💥 Exception:', err.message);
  }
}

quickTest();