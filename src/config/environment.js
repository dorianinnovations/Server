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
  
  // AI Services
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  LLAMA_CPP_API_URL: process.env.LLAMA_CPP_API_URL || 'http://localhost:8000/completion',
  
  // Search APIs
  GOOGLE_SEARCH_API_KEY: process.env.GOOGLE_SEARCH_API_KEY,
  GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID,
  SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
  
  // Spotify Integration
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  
  // Stripe Payment Processing
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  
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
  
  // Additional API Keys
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
  GOOGLE_TRANSLATE_API_KEY: process.env.GOOGLE_TRANSLATE_API_KEY,
  
  // Security
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  HTTP_REFERER: process.env.HTTP_REFERER,
};

// Environment configuration loaded