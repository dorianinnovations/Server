import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';

describe('WebSocket Authentication Fix', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  let socket;

  afterEach(() => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  });

  test('should connect with valid JWT token using id field', async () => {
    // Create token with 'id' field (like mobile app)
    const userId = '688538362cc9b6697c544f4c';
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });

    const connected = await new Promise((resolve) => {
      socket = io('http://localhost:5000', {
        auth: { token },
        autoConnect: false
      });

      socket.on('connect', () => {
        resolve(true);
      });

      socket.on('connect_error', (error) => {
        console.log('Connection error:', error.message);
        resolve(false);
      });

      socket.connect();

      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });

    expect(connected).toBe(true);
  }, 10000);

  test('should connect with valid JWT token using userId field', async () => {
    // Create token with 'userId' field (legacy format)
    const userId = '688538362cc9b6697c544f4c';
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });

    const connected = await new Promise((resolve) => {
      socket = io('http://localhost:5000', {
        auth: { token },
        autoConnect: false
      });

      socket.on('connect', () => {
        resolve(true);
      });

      socket.on('connect_error', (error) => {
        console.log('Connection error:', error.message);
        resolve(false);
      });

      socket.connect();

      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });

    expect(connected).toBe(true);
  }, 10000);

  test('should reject connection without token', async () => {
    const connected = await new Promise((resolve) => {
      socket = io('http://localhost:5000', {
        autoConnect: false
      });

      socket.on('connect', () => {
        resolve(true);
      });

      socket.on('connect_error', (error) => {
        expect(error.message).toContain('No token provided');
        resolve(false);
      });

      socket.connect();

      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });

    expect(connected).toBe(false);
  }, 10000);

  test('should reject connection with invalid token', async () => {
    const connected = await new Promise((resolve) => {
      socket = io('http://localhost:5000', {
        auth: { token: 'invalid-token' },
        autoConnect: false
      });

      socket.on('connect', () => {
        resolve(true);
      });

      socket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        resolve(false);
      });

      socket.connect();

      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });

    expect(connected).toBe(false);
  }, 10000);
});