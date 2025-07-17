import { sanitizeResponse } from '../../src/utils/sanitize.js';

describe('sanitizeResponse', () => {
  it('should remove TASK_INFERENCE markers', () => {
    const input = 'Hello TASK_INFERENCE: {"taskType": "test"} world';
    const result = sanitizeResponse(input);
    expect(result).toBe('Hello world');
  });

  it('should remove EMOTION_LOG markers', () => {
    const input = 'Hello EMOTION_LOG: {"emotion": "happy"} world';
    const result = sanitizeResponse(input);
    expect(result).toBe('Hello world');
  });

  it('should remove both markers', () => {
    const input =
      'Hello TASK_INFERENCE: {"taskType": "test"} EMOTION_LOG: {"emotion": "happy"} world';
    const result = sanitizeResponse(input);
    expect(result).toBe('Hello world');
  });

  it('should handle case insensitive markers', () => {
    const input =
      'Hello task_inference: {"taskType": "test"} emotion_log: {"emotion": "happy"} world';
    const result = sanitizeResponse(input);
    expect(result).toBe('Hello world');
  });

  it('should handle incomplete markers', () => {
    const input = 'Hello TASK_INFERENCE: EMOTION_LOG: world';
    const result = sanitizeResponse(input);
    expect(result).toBe('Hello world');
  });

  it('should normalize multiple newlines', () => {
    const input = 'Hello\n\n\nworld\n\n\n';
    const result = sanitizeResponse(input);
    expect(result).toBe('Hello\nworld');
  });

  it('should return default message for empty input', () => {
    const result = sanitizeResponse('');
    expect(result).toBe("I'm sorry, I wasn't able to provide a proper response. Please try again.");
  });

  it('should return default message for null input', () => {
    const result = sanitizeResponse(null);
    expect(result).toBe("I'm sorry, I wasn't able to provide a proper response. Please try again.");
  });

  it('should handle complex JSON in markers', () => {
    const input =
      'Hello TASK_INFERENCE: {"taskType": "complex", "parameters": {"nested": {"value": "test"}}} world';
    const result = sanitizeResponse(input);
    expect(result).toBe('Hello world');
  });

  it('should preserve normal text without markers', () => {
    const input = 'Hello world, how are you today?';
    const result = sanitizeResponse(input);
    expect(result).toBe('Hello world, how are you today?');
  });
});
