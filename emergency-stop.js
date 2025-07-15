// Emergency script to stop all continuous API calls
console.log('🛑 EMERGENCY STOP - Clearing all intervals...');

// Clear any global intervals that might be running
if (typeof global !== 'undefined') {
  // Clear normal intervals
  if (global.numinaIntervals) {
    let count = 0;
    Object.keys(global.numinaIntervals).forEach(userId => {
      if (global.numinaIntervals[userId]) {
        clearInterval(global.numinaIntervals[userId]);
        count++;
      }
    });
    global.numinaIntervals = {};
    console.log(`✅ Cleared ${count} normal intervals`);
  }
  
  // Clear rapid intervals
  if (global.rapidNuminaIntervals) {
    let count = 0;
    Object.keys(global.rapidNuminaIntervals).forEach(userId => {
      if (global.rapidNuminaIntervals[userId]) {
        clearInterval(global.rapidNuminaIntervals[userId]);
        count++;
      }
    });
    global.rapidNuminaIntervals = {};
    console.log(`✅ Cleared ${count} rapid intervals`);
  }
  
  console.log('🛑 Emergency stop completed!');
} else {
  console.log('❌ No global object found');
}

// Monitor for any OpenRouter API calls and warn
const originalLog = console.log;
console.log = function(...args) {
  const message = args.join(' ');
  if (message.includes('OpenRouter API Response Status')) {
    originalLog('🚨 WARNING: OpenRouter API call detected!', ...args);
  } else {
    originalLog(...args);
  }
};

console.log('🔍 Monitoring for additional API calls...');