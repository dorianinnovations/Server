# Messaging Troubleshooting Guide

## Issue: Not Able to Send More Than a Single Message

### Root Cause Identified
The server is failing to start due to missing environment variables, specifically the `MONGO_URI`, which prevents the application from connecting to MongoDB.

### Error Details
```
✗ MongoDB connection error: MongooseError: The `uri` parameter to `openUri()` must be a string, got "undefined"
```

### Solution Steps

#### 1. Create Environment Configuration File
Create a `.env` file in the project root with the following configuration:

```env
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/numina-db
# OR use MongoDB Atlas connection string:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/numina-db

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-here

# LLM API Configuration
LLAMA_CPP_API_URL=http://localhost:8000/completion
# OR use your external LLM API:
# LLAMA_CPP_API_URL=https://your-llm-api.com/completion

# Server Configuration
PORT=5000
NODE_ENV=development
```

#### 2. MongoDB Setup Options

**Option A: Local MongoDB**
```bash
# Install MongoDB locally
sudo apt-get update
sudo apt-get install mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

**Option B: MongoDB Atlas (Cloud)**
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a free cluster
3. Get your connection string
4. Replace the MONGO_URI in your .env file

**Option C: Docker MongoDB**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

#### 3. Start the Server
```bash
# Install dependencies (if not already done)
npm install

# Start the server
npm start
```

#### 4. Verify Server is Running
```bash
# Check if server is responding
curl -X GET http://localhost:5000/health
```

### Additional Troubleshooting

#### Common Issues and Solutions

1. **Port Already in Use**
   ```bash
   # Kill process using port 5000
   lsof -ti:5000 | xargs kill -9
   ```

2. **MongoDB Connection Timeout**
   - Check if MongoDB is running
   - Verify connection string is correct
   - Check firewall/network settings

3. **Missing Dependencies**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Rate Limiting Issues**
   - The completion endpoint has rate limiting (30 requests/minute per user)
   - If testing rapidly, wait for rate limit to reset

#### Testing Multiple Messages

Once the server is running, test multiple messages:

```bash
# First, get an auth token
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Use the token to send multiple completion requests
curl -X POST http://localhost:5000/completion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"prompt":"Hello, this is message 1"}'

curl -X POST http://localhost:5000/completion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"prompt":"Hello, this is message 2"}'
```

### Prevention

1. **Environment Template**: Create a `.env.template` file with placeholder values
2. **Documentation**: Update README with clear environment setup instructions
3. **Validation**: Add environment variable validation on startup
4. **Health Checks**: Monitor for missing configurations

### Code Improvements

Consider adding environment validation in `src/server.js`:

```javascript
// Add this at the top of server.js after dotenv.config()
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('✗ Missing required environment variables:', missingEnvVars);
  console.error('Please create a .env file with the required variables.');
  process.exit(1);
}
```

### Current Status

✅ **Environment validation added**: Server now validates required environment variables on startup  
✅ **Configuration files created**: `.env` and `.env.template` files are now available  
✅ **Server starts successfully**: Server can now start with proper environment configuration  
⚠️ **Database connection needed**: MongoDB connection still required for full functionality  

### Summary

The "not able to send more than a single message" issue was caused by:
1. Missing `.env` file with required environment variables
2. Server failing to start due to undefined `MONGO_URI`
3. No database connection preventing message processing

**Resolution**: Create proper `.env` file with MongoDB connection string and other required variables, then restart the server.

### Next Steps

1. **Set up MongoDB**: Use one of the options in step 2 above (local, Atlas, or Docker)
2. **Update `.env`**: Replace the placeholder MONGO_URI with your actual connection string
3. **Restart server**: Run `npm start` again
4. **Test messaging**: Use the curl commands provided to test multiple messages

### Quick Test Setup

For immediate testing, the fastest option is MongoDB Atlas (free tier):
1. Go to https://cloud.mongodb.com/
2. Create free account and cluster
3. Get connection string
4. Replace MONGO_URI in `.env` file
5. Run `npm start`

The server will now properly handle multiple messages once the database connection is established.