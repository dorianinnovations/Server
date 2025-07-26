import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('✗ Missing required environment variables:', missingEnvVars);
  console.error('Please create a .env file with the required variables.');
  console.error('You can use .env.template as a starting point.');
  process.exit(1);
}

// Export environment configuration for easy access
export const env = {
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES || process.env.JWT_EXPIRES_IN || '1d',
  NODE_ENV: process.env.NODE_ENV || 'production', // SECURITY: Force production mode
  PORT: process.env.PORT || 5000,
  
  // SECURITY: Debug logging control
  ENABLE_DEBUG_LOGS: process.env.NODE_ENV === 'development' ? true : false,
  LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  
  // AWS Configuration for secure cloud storage
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'us-east-2',
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'numina-user-content',
  
  // FREE EMAIL SERVICE CONFIGURATION (Resend replacement)
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@aidorian.com',
  
  // Primary: Gmail SMTP (500 emails/day free)
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD,
  
  // Secondary: Brevo/Sendinblue (300 emails/day free)
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  
  // Tertiary: SendGrid (100 emails/day free)
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
};

// Environment configuration loaded