import { createCache } from '../../src/utils/cache.js';

describe('Cache Utility', () => {
  let cache;

  beforeEach(() => {
    cache = createCache();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('test-key', 'test-value');
      const result = cache.get('test-key');
      expect(result).toBe('test-value');
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle custom TTL', () => {
      cache.set('test-key', 'test-value', 1000); // 1 second
      const result = cache.get('test-key');
      expect(result).toBe('test-value');
    });

    it('should expire items after TTL', async () => {
      cache.set('test-key', 'test-value', 10); // 10ms
      await new Promise(resolve => setTimeout(resolve, 20));
      const result = cache.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('cache operations', () => {
    it('should delete items', () => {
      cache.set('test-key', 'test-value');
      cache.delete('test-key');
      expect(cache.get('test-key')).toBeNull();
    });

    it('should clear all items', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should return correct size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined values', () => {
      cache.set('null-key', null);
      cache.set('undefined-key', undefined);

      expect(cache.get('null-key')).toBeNull();
      expect(cache.get('undefined-key')).toBeUndefined();
    });

    it('should handle complex objects', () => {
      const complexObject = {
        nested: {
          array: [1, 2, 3],
          string: 'test'
        }
      };

      cache.set('complex-key', complexObject);
      const result = cache.get('complex-key');
      expect(result).toEqual(complexObject);
    });
  });
});
