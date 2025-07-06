// Production server entry point that uses the optimized modular structure
import app from './src/server.js';

// This file exists to maintain compatibility with deployment platforms
// that might expect server.js in the root directory

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`✓Production server running on port ${PORT}`);
    console.log(`✓All performance optimizations active`);
    console.log(`✓Using modular architecture from src/`);
  });
}

export default app;