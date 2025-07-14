console.log("🧹 Initializing sanitization utilities...");

// Helper function to ensure all special markers are removed from text
export const sanitizeResponse = (text) => {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return "I'm sorry, I wasn't able to provide a proper response. Please try again.";
  }

  // Remove the metadata markers and their JSON content
  let sanitized = text
    .replace(/(?:TASK_INFERENCE|EMOTION_LOG):?\s*(?:\{[\s\S]*?\})?\s*/gi, ' ')
    .replace(/\}+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/^[ \n]+|[ \n]+$/g, '');

  if (!sanitized) {
    return "I'm sorry, I wasn't able to provide a proper response. Please try again.";
  }
  return sanitized;
};

console.log("✓Response sanitization function configured");
console.log("✓Sanitization utilities initialization completed"); 