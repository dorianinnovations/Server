// Wrapper file for Render deployment
// This file exists because Render is configured to run 'node server.js'
// but the actual server is at src/server.js

import('./src/server.js');
