// Helper function to ensure all special markers are removed from text
export const sanitizeResponse = (text) => {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return "I'm sorry, I wasn't able to provide a proper response. Please try again.";
  }

  // Optimized single-pass sanitization with combined regex
  const SANITIZATION_REGEX = /(?:TASK_INFERENCE|EMOTION_LOG):?\s*(?:\{[\s\S]*?\})?\s*|\}+|[ ]{2,}|\n{2,}/gi;
  
  let sanitized = text
    .replace(SANITIZATION_REGEX, (match) => {
      if (match.match(/(?:TASK_INFERENCE|EMOTION_LOG)/i)) return ' ';
      if (match.match(/\}+/)) return ' ';
      if (match.match(/[ ]{2,}/)) return ' ';
      if (match.match(/\n{2,}/)) return '\n';
      return match;
    })
    // Final cleanup of leading/trailing spaces
    .replace(/^[ \n]+|[ \n]+$/g, '');

  if (!sanitized) {
    return "I'm sorry, I wasn't able to provide a proper response. Please try again.";
  }
  return sanitized;
}; 